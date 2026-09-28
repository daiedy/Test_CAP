// Unit tests of srv/lib/products-import.js (ADR-0021 decision 7): header mapping, numeric
// coercion, skipping of empty rows and the sheet row numbering. Pure functions, no server.
import {
  IMPORT_COLUMNS,
  columnOf,
  coerceCell,
  decodeContent,
  mapHeader,
  readImportRows,
  toImportRows,
} from '../srv/lib/products-import.js';
import { HEADER, VALID_ROWS, workbook } from './fixtures/build-workbooks.mjs';

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
