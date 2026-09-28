// Workbook parsing for CatalogService.importProducts (ADR-0021 decisions 1 and 7).
// Pure functions, no req/res and no cds.context: the handler owns messages and persistence.
// Value checks (@mandatory, @assert.range, @assert.target, data types) are NOT done here; the
// service's generic input validation runs them on the INSERT of every row (ADR-0021 decision 3).
import zlib from 'node:zlib';
import { readSheet } from 'read-excel-file/node';

/**
 * Workbook columns in their documented spelling, mapped to the element written by the INSERT.
 * Header cells match case-insensitively, in any order.
 */
export const IMPORT_COLUMNS = Object.freeze({
  name: 'name',
  description: 'description',
  price: 'price',
  currency: 'currency_code',
  stock: 'stock',
  category: 'category_code',
  rating: 'rating',
  imageUrl: 'imageUrl',
});

/** Columns a workbook must have; each missing one is its own structural error. */
export const MANDATORY_COLUMNS = Object.freeze(['name', 'price', 'currency', 'stock', 'category']);

// Columns whose cell text is converted to a number when it reads as one.
const NUMERIC_COLUMNS = new Set(['price', 'stock', 'rating']);

/**
 * Upper bound of the unpacked workbook in bytes (10 MiB), checked before the workbook is parsed:
 * 4x the largest legitimate 1,000-row workbook measured (ADR-0021 amendment D, research 8.2).
 */
export const MAX_UNZIPPED_BYTES = 10 * 2 ** 20;

// Zip record layout (APPNOTE 4.3), read the way the library's streaming reader reads it
// (unzipper-esm 0.13.3 lib/parse.js, research 8.3).
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const DATA_DESCRIPTOR_SIGNATURE = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
const LOCAL_FILE_HEADER_LENGTH = 30;
const CENTRAL_DIRECTORY_HEADER_LENGTH = 46;
const DATA_DESCRIPTOR_LENGTH = 16; // signature, CRC-32, compressed size, uncompressed size
const FLAG_DATA_DESCRIPTOR = 0x08;
const METHOD_STORED = 0;
const ZIP64_SIZE_MARKER = 0xffffffff;

/**
 * Decode the `content` of the action parameter into bytes. JSON clients send `Edm.Stream`
 * content of a complex parameter as a base64 string (research 5.2).
 * @param {string|Buffer|Uint8Array|null|undefined} content base64 string or raw bytes
 * @returns {Buffer} decoded bytes, empty when there is no content
 */
export function decodeContent(content) {
  if (content == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content === 'string') return Buffer.from(content, 'base64');
  return Buffer.alloc(0);
}

/**
 * Map the header row to workbook columns.
 * @param {Array<unknown>} header cells of the first sheet row
 * @returns {{ columns: Array<string|null>, errors: Array<{ code: string, args: Array<string> }> }}
 *   `columns[i]` is the documented column name of cell i (null for an empty or unknown header
 *   cell; a repeated column maps every one of its cells);
 *   `errors` holds, in header order, one PRODUCTS_IMPORT_UNKNOWN_COLUMN per unknown header
 *   (argument: the header text) and one PRODUCTS_IMPORT_DUPLICATE_COLUMN per documented column
 *   named more than once, case-insensitive (argument: the documented column name; reported at
 *   its second cell, once even for three cells); then one PRODUCTS_IMPORT_MISSING_COLUMN per
 *   missing mandatory column (ADR-0021 decision 7 and amendment C)
 */
export function mapHeader(header) {
  const byLowerName = new Map(Object.keys(IMPORT_COLUMNS).map((c) => [c.toLowerCase(), c]));
  const errors = [];
  const seen = new Set();
  const repeated = new Set();
  const columns = header.map((cell) => {
    const text = cell == null ? '' : String(cell).trim();
    if (!text) return null;
    const column = byLowerName.get(text.toLowerCase());
    if (!column) {
      errors.push({ code: 'PRODUCTS_IMPORT_UNKNOWN_COLUMN', args: [text] });
      return null;
    }
    if (seen.has(column) && !repeated.has(column)) {
      repeated.add(column);
      errors.push({ code: 'PRODUCTS_IMPORT_DUPLICATE_COLUMN', args: [column] });
    }
    seen.add(column);
    return column;
  });
  for (const column of MANDATORY_COLUMNS) {
    if (!columns.includes(column)) {
      errors.push({ code: 'PRODUCTS_IMPORT_MISSING_COLUMN', args: [column] });
    }
  }
  return { columns, errors };
}

/**
 * Normalize one cell: trimmed text, empty text as undefined, numeric text as a number in the
 * numeric columns. Text that is not a number stays unchanged, so the service rejects it with
 * ASSERT_DATA_TYPE (research 5.3a).
 * @param {string} column documented column name
 * @param {unknown} value cell value from read-excel-file (string, number, boolean, Date or null)
 * @returns {string|number|undefined} value for the INSERT, undefined for an empty cell
 */
export function coerceCell(column, value) {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return NUMERIC_COLUMNS.has(column) ? value : String(value);
  const text = String(value).trim();
  if (!text) return undefined;
  if (NUMERIC_COLUMNS.has(column)) {
    const number = Number(text);
    if (Number.isFinite(number)) return number;
  }
  return text;
}

/**
 * Turn sheet data (header row first) into INSERT entries with their sheet row number.
 * Empty rows are skipped; the header row is row 1.
 * @param {Array<Array<unknown>>} data rows of the sheet as returned by read-excel-file
 * @returns {{ columns: Array<string|null>, rows: Array<{ row: number, entry: Record<string, string|number> }>,
 *   errors: Array<{ code: string, args: Array<string> }> }} `columns` as of {@link mapHeader};
 *   rows only when `errors` is empty
 */
export function toImportRows(data) {
  if (!data.length) {
    return { columns: [], rows: [], errors: [{ code: 'PRODUCTS_IMPORT_EMPTY', args: [] }] };
  }
  const { columns, errors } = mapHeader(data[0]);
  if (errors.length) return { columns, rows: [], errors };
  const rows = [];
  data.slice(1).forEach((cells, index) => {
    const entry = {};
    columns.forEach((column, i) => {
      if (!column) return;
      const value = coerceCell(column, cells[i]);
      if (value !== undefined) entry[IMPORT_COLUMNS[column]] = value;
    });
    if (Object.keys(entry).length) rows.push({ row: index + 2, entry });
  });
  if (!rows.length) return { columns, rows, errors: [{ code: 'PRODUCTS_IMPORT_EMPTY', args: [] }] };
  return { columns, rows, errors: [] };
}

/**
 * Count the unpacked bytes of a zip archive without keeping them, so that a small upload cannot
 * unpack into gigabytes inside the parser (ADR-0021 amendment D). The walk follows the records in
 * the order the streaming reader of read-excel-file reads them, not the central directory it
 * ignores (research 8.3, 8.4):
 * - local file headers from offset 0; the entry data runs for the compressed size of the header,
 *   or, when flag bit 3 is set and that size is 0, up to the data-descriptor signature, followed
 *   by the 16 descriptor bytes;
 * - central-directory records are skipped by their lengths;
 * - the walk stops at the end record, or at the first unknown record after the central directory.
 * Every entry is inflated with `maxOutputLength` set to the remaining budget, so the function's own
 * memory never exceeds `limit`; a stored entry counts its length.
 * @param {Buffer} bytes zip archive
 * @param {number} limit budget of unpacked bytes for the whole archive
 * @returns {{ size: number } | { error: 'TOO_LARGE' | 'INVALID' }} the unpacked size;
 *   `TOO_LARGE` for a declared size above the remaining budget (the reader allocates it), a zip64
 *   size marker, or inflated bytes above the budget; `INVALID` for an unreadable record (unknown
 *   signature before the central directory, truncated header, missing data descriptor, zlib data
 *   error). Empty input gives `{ size: 0 }`.
 */
export function unzippedSize(bytes, limit) {
  let offset = 0;
  let total = 0;
  let reachedCentralDirectory = false;
  while (offset + 4 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (signature === LOCAL_FILE_SIGNATURE) {
      if (offset + LOCAL_FILE_HEADER_LENGTH > bytes.length) return { error: 'INVALID' };
      const flags = bytes.readUInt16LE(offset + 6);
      const method = bytes.readUInt16LE(offset + 8);
      const compressedSize = bytes.readUInt32LE(offset + 18);
      const declaredSize = bytes.readUInt32LE(offset + 22);
      const nameLength = bytes.readUInt16LE(offset + 26);
      const extraLength = bytes.readUInt16LE(offset + 28);
      const start = offset + LOCAL_FILE_HEADER_LENGTH + nameLength + extraLength;
      if (compressedSize === ZIP64_SIZE_MARKER || declaredSize === ZIP64_SIZE_MARKER) {
        return { error: 'TOO_LARGE' };
      }
      const sizeKnown = !(flags & FLAG_DATA_DESCRIPTOR) || compressedSize > 0;
      if (sizeKnown && declaredSize > limit - total) return { error: 'TOO_LARGE' };
      const end = sizeKnown
        ? start + compressedSize
        : bytes.indexOf(DATA_DESCRIPTOR_SIGNATURE, start);
      if (end < 0 || end > bytes.length) return { error: 'INVALID' };
      const data = bytes.subarray(start, end);
      let size = data.length;
      if (method !== METHOD_STORED && data.length) {
        try {
          size = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, limit - total) }).length;
        } catch (err) {
          return { error: err.code === 'ERR_BUFFER_TOO_LARGE' ? 'TOO_LARGE' : 'INVALID' };
        }
      }
      total += size;
      if (total > limit) return { error: 'TOO_LARGE' };
      offset = sizeKnown ? end : end + DATA_DESCRIPTOR_LENGTH;
    } else if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
      if (offset + CENTRAL_DIRECTORY_HEADER_LENGTH > bytes.length) return { error: 'INVALID' };
      reachedCentralDirectory = true;
      offset +=
        CENTRAL_DIRECTORY_HEADER_LENGTH +
        bytes.readUInt16LE(offset + 28) +
        bytes.readUInt16LE(offset + 30) +
        bytes.readUInt16LE(offset + 32);
    } else if (signature === END_OF_CENTRAL_DIRECTORY_SIGNATURE || reachedCentralDirectory) {
      break; // the reader ends at the end record; after the central directory it skips to it
    } else {
      return { error: 'INVALID' };
    }
  }
  return { size: total };
}

/**
 * Read the first sheet of an xlsx workbook and map it to import rows. The unpacked size is
 * checked first with {@link unzippedSize} against {@link MAX_UNZIPPED_BYTES}.
 * @param {Buffer} bytes workbook bytes
 * @returns {Promise<ReturnType<typeof toImportRows>>} as {@link toImportRows}, with the single
 *   error PRODUCTS_IMPORT_TOO_LARGE (argument: the limit in MB) when the workbook unpacks to more
 *   than the limit, or PRODUCTS_IMPORT_NOT_XLSX when the bytes are not a readable xlsx workbook
 */
export async function readImportRows(bytes) {
  const unpacked = unzippedSize(bytes, MAX_UNZIPPED_BYTES);
  if (unpacked.error === 'TOO_LARGE') {
    const limitMb = MAX_UNZIPPED_BYTES / 2 ** 20;
    return {
      columns: [],
      rows: [],
      errors: [{ code: 'PRODUCTS_IMPORT_TOO_LARGE', args: [limitMb] }],
    };
  }
  if (unpacked.error) {
    return { columns: [], rows: [], errors: [{ code: 'PRODUCTS_IMPORT_NOT_XLSX', args: [] }] };
  }
  let data;
  try {
    data = await readSheet(bytes);
  } catch {
    return { columns: [], rows: [], errors: [{ code: 'PRODUCTS_IMPORT_NOT_XLSX', args: [] }] };
  }
  return toImportRows(data);
}

/**
 * Map an element name reported by the service's input validation back to the workbook column.
 * @param {string|undefined} element element of the INSERT (`category_code`, `stock`, ...)
 * @returns {string} documented column name, or the element itself when it is not a column
 */
export function columnOf(element) {
  const found = Object.entries(IMPORT_COLUMNS).find(([, el]) => el === element);
  return found ? found[0] : (element ?? '');
}
