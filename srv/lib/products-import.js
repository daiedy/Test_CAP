// Workbook parsing for CatalogService.importProducts (ADR-0021 decisions 1 and 7).
// Pure functions, no req/res and no cds.context: the handler owns messages and persistence.
// Value checks (@mandatory, @assert.range, @assert.target, data types) are NOT done here; the
// service's generic input validation runs them on the INSERT of every row (ADR-0021 decision 3).
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
 * Read the first sheet of an xlsx workbook and map it to import rows.
 * @param {Buffer} bytes workbook bytes
 * @returns {Promise<ReturnType<typeof toImportRows>>} as {@link toImportRows}, with the single
 *   error PRODUCTS_IMPORT_NOT_XLSX when the bytes are not a readable xlsx workbook
 */
export async function readImportRows(bytes) {
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
