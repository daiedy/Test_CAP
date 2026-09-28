// Unit tests of srv/lib/products-import.js (ADR-0021 decision 7 and amendment D): header mapping,
// numeric coercion, skipping of empty rows, the sheet row numbering and the decompression guard.
// Pure functions, no server.
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import {
  IMPORT_COLUMNS,
  columnOf,
  coerceCell,
  decodeContent,
  mapHeader,
  readImportRows,
  toImportRows,
  unzippedSize,
} from '../srv/lib/products-import.js';
import { HEADER, VALID_ROWS, generatedRow, workbook } from './fixtures/build-workbooks.mjs';

describe('products-import mapHeader', () => {
  it('maps header cells case-insensitively and in any order', () => {
    const { columns, errors } = mapHeader([
      ' STOCK ',
      'Category',
      'imageurl',
      'Name',
      'PRICE',
      'currency',
    ]);
    expect(errors).toEqual([]);
    expect(columns).toEqual(['stock', 'category', 'imageUrl', 'name', 'price', 'currency']);
  });

  it('accepts a header without the optional columns', () => {
    const { errors } = mapHeader(['name', 'price', 'currency', 'stock', 'category']);
    expect(errors).toEqual([]);
  });

  it('ignores empty header cells', () => {
    const { columns, errors } = mapHeader([
      'name',
      null,
      'price',
      '  ',
      'currency',
      'stock',
      'category',
    ]);
    expect(errors).toEqual([]);
    expect(columns).toEqual(['name', null, 'price', null, 'currency', 'stock', 'category']);
  });

  it('reports an unknown column and each missing mandatory column', () => {
    const { errors } = mapHeader(['name', 'Color', 'currency']);
    expect(errors).toEqual([
      { code: 'PRODUCTS_IMPORT_UNKNOWN_COLUMN', args: ['Color'] },
      { code: 'PRODUCTS_IMPORT_MISSING_COLUMN', args: ['price'] },
      { code: 'PRODUCTS_IMPORT_MISSING_COLUMN', args: ['stock'] },
      { code: 'PRODUCTS_IMPORT_MISSING_COLUMN', args: ['category'] },
    ]);
  });

  it('reports a column that appears twice in the header', () => {
    const twice = mapHeader(['name', 'price', 'currency', 'stock', 'category', 'Name']);
    expect(twice.errors).toEqual([{ code: 'PRODUCTS_IMPORT_DUPLICATE_COLUMN', args: ['name'] }]);

    const threeTimes = mapHeader([
      'NAME',
      'price',
      'name',
      'currency',
      'stock',
      'category',
      'Name',
    ]);
    expect(threeTimes.errors).toEqual([
      { code: 'PRODUCTS_IMPORT_DUPLICATE_COLUMN', args: ['name'] },
    ]);

    // In header order together with unknown columns, before the missing mandatory columns.
    const mixed = mapHeader(['stock', 'Color', 'STOCK', 'name', 'price', 'currency']);
    expect(mixed.errors).toEqual([
      { code: 'PRODUCTS_IMPORT_UNKNOWN_COLUMN', args: ['Color'] },
      { code: 'PRODUCTS_IMPORT_DUPLICATE_COLUMN', args: ['stock'] },
      { code: 'PRODUCTS_IMPORT_MISSING_COLUMN', args: ['category'] },
    ]);
  });
});

describe('products-import coerceCell', () => {
  it('converts numeric text in the numeric columns to numbers', () => {
    expect(coerceCell('price', ' 12.50 ')).toBe(12.5);
    expect(coerceCell('stock', '7')).toBe(7);
    expect(coerceCell('rating', '4')).toBe(4);
    expect(coerceCell('price', 3.25)).toBe(3.25);
  });

  it('keeps non-numeric text of a numeric column for the service to reject', () => {
    expect(coerceCell('price', 'abc')).toBe('abc');
  });

  it('keeps text columns as trimmed text, numbers included', () => {
    expect(coerceCell('name', '  Lamp  ')).toBe('Lamp');
    expect(coerceCell('name', 42)).toBe('42');
  });

  it('treats empty cells as missing', () => {
    expect(coerceCell('name', null)).toBe(undefined);
    expect(coerceCell('name', undefined)).toBe(undefined);
    expect(coerceCell('description', '   ')).toBe(undefined);
    expect(coerceCell('stock', '')).toBe(undefined);
  });
});

describe('products-import toImportRows', () => {
  it('numbers rows as in the sheet (header = 1) and skips empty rows', () => {
    const { rows, errors } = toImportRows([
      ['Name', 'Price', 'Currency', 'Stock', 'Category'],
      ['Lamp', '10', 'USD', 5, 'FURNITURE'],
      [null, null, null, null, null],
      [],
      ['Pen', 1.5, 'EUR', '3', 'STATIONERY'],
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        row: 2,
        entry: {
          name: 'Lamp',
          price: 10,
          currency_code: 'USD',
          stock: 5,
          category_code: 'FURNITURE',
        },
      },
      {
        row: 5,
        entry: {
          name: 'Pen',
          price: 1.5,
          currency_code: 'EUR',
          stock: 3,
          category_code: 'STATIONERY',
        },
      },
    ]);
  });

  it('leaves empty cells out of the entry, so @mandatory reports them', () => {
    const { rows } = toImportRows([
      HEADER,
      [null, 'Nameless', 10, 'USD', 1, 'KITCHEN', null, null],
    ]);
    expect(rows).toEqual([
      {
        row: 2,
        entry: {
          description: 'Nameless',
          price: 10,
          currency_code: 'USD',
          stock: 1,
          category_code: 'KITCHEN',
        },
      },
    ]);
  });

  it('reports an empty workbook and a header without data rows', () => {
    const empty = { code: 'PRODUCTS_IMPORT_EMPTY', args: [] };
    expect(toImportRows([]).errors).toEqual([empty]);
    expect(toImportRows([HEADER]).errors).toEqual([empty]);
    expect(toImportRows([HEADER, [null, null]]).errors).toEqual([empty]);
  });

  it('returns no rows when the header is invalid', () => {
    const { rows, errors } = toImportRows([['name'], ['Lamp']]);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(4);
  });
});

describe('products-import readImportRows', () => {
  it('reads the first sheet of an xlsx workbook', async () => {
    const { rows, errors } = await readImportRows(await workbook([HEADER, ...VALID_ROWS]));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      row: 2,
      entry: {
        name: 'Import Desk Organizer',
        description: 'Bamboo organizer with five compartments',
        price: 24.5,
        currency_code: 'USD',
        stock: 40,
        category_code: 'STATIONERY',
        rating: 4,
        imageUrl: 'https://example.com/img/desk-organizer.png',
      },
    });
  });

  it('reports bytes that are not an xlsx workbook', async () => {
    const { errors } = await readImportRows(Buffer.from('name;price'));
    expect(errors).toEqual([{ code: 'PRODUCTS_IMPORT_NOT_XLSX', args: [] }]);
  });
});

describe('products-import decodeContent and columnOf', () => {
  it('decodes base64 content and passes bytes through', () => {
    expect(decodeContent(Buffer.from('xlsx').toString('base64')).toString()).toBe('xlsx');
    const bytes = Buffer.from('raw');
    expect(decodeContent(bytes)).toBe(bytes);
    expect(decodeContent(new Uint8Array([1, 2]))).toEqual(Buffer.from([1, 2]));
    expect(decodeContent(null)).toHaveLength(0);
  });

  it('maps an element back to its workbook column', () => {
    for (const [column, element] of Object.entries(IMPORT_COLUMNS)) {
      expect(columnOf(element)).toBe(column);
    }
    expect(columnOf('ID')).toBe('ID');
    expect(columnOf(undefined)).toBe('');
  });
});

describe('products-import unzippedSize', () => {
  const limit = 64 * 2 ** 10;

  /**
   * A one-entry zip archive whose local header carries the sizes (research 8.5): write-excel-file
   * always uses data descriptors, so the declared-size branch of the walk needs a hand-built one.
   * @param {Buffer} content unpacked bytes of the entry, deflated into the archive
   * @param {number} declaredSize uncompressed size written into the local header
   * @returns {Buffer} local file header, name and deflated data (no central directory)
   */
  const zipEntry = (content, declaredSize) => {
    const name = Buffer.from('xl/worksheets/sheet1.xml');
    const data = deflateRawSync(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed to extract
    header.writeUInt16LE(0, 6); // flags: no data descriptor, the sizes below are known
    header.writeUInt16LE(8, 8); // method: deflate
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(declaredSize, 22); // uncompressed size
    header.writeUInt16LE(name.length, 26); // file name length
    return Buffer.concat([header, name, data]);
  };

  it('counts the unzipped bytes of a workbook and rejects one above the limit', async () => {
    const valid = readFileSync(`${import.meta.dirname}/fixtures/products-import-valid.xlsx`);
    const { size } = unzippedSize(valid, limit);
    expect(size).toBeGreaterThan(valid.length);
    expect(size).toBeLessThan(limit);

    // write-excel-file writes data descriptors: rejected by the inflate cap of the walk.
    const large = await workbook([HEADER, generatedRow(1, { description: 'a'.repeat(4 * limit) })]);
    expect(large.length).toBeLessThan(limit);
    expect(unzippedSize(large, limit)).toEqual({ error: 'TOO_LARGE' });
  });

  it('rejects an entry that declares too much or understates its size', () => {
    // Positive control: the hand-built archive is readable when its sizes are honest.
    const honest = Buffer.alloc(1000, 'a');
    expect(unzippedSize(zipEntry(honest, honest.length), limit)).toEqual({ size: 1000 });

    // Declares more than the limit: refused on the header, before any inflate.
    expect(unzippedSize(zipEntry(Buffer.from('x'), limit + 1), limit)).toEqual({
      error: 'TOO_LARGE',
    });

    // Declares 0 but inflates to 256 KiB: the declared size is not trusted.
    expect(unzippedSize(zipEntry(Buffer.alloc(4 * limit, 'a'), 0), limit)).toEqual({
      error: 'TOO_LARGE',
    });

    // The budget spans the archive: two honest entries of 40,000 bytes exceed 64 KiB together.
    const entry = zipEntry(Buffer.alloc(40_000, 'a'), 40_000);
    expect(unzippedSize(entry, limit)).toEqual({ size: 40_000 });
    expect(unzippedSize(Buffer.concat([entry, entry]), limit)).toEqual({ error: 'TOO_LARGE' });
  });

  it('reports bytes that are not a zip archive', () => {
    expect(unzippedSize(Buffer.from('name;price'), limit)).toEqual({ error: 'INVALID' });
    // A local header cut off after its signature.
    expect(unzippedSize(zipEntry(Buffer.from('x'), 1).subarray(0, 10), limit)).toEqual({
      error: 'INVALID',
    });
    // Empty input is not a bomb; readSheet reports it as PRODUCTS_IMPORT_NOT_XLSX.
    expect(unzippedSize(Buffer.alloc(0), limit)).toEqual({ size: 0 });
  });
});
