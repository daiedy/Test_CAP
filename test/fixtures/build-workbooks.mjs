// Workbook fixtures of CatalogService.importProducts (ADR-0021), built with write-excel-file.
// Tests import the builders to create workbooks in memory; `node test/fixtures/build-workbooks.mjs`
// regenerates the committed files products-import-valid.xlsx and products-import-invalid.xlsx.
import writeXlsxFile from 'write-excel-file/node';
import { pathToFileURL } from 'node:url';

/** Header row in the documented column order (README "workbook columns"). */
export const HEADER = [
  'name',
  'description',
  'price',
  'currency',
  'stock',
  'category',
  'rating',
  'imageUrl',
];

/** The valid fixture: 3 rows, one per category and currency, every column filled. */
export const VALID_ROWS = [
  [
    'Import Desk Organizer',
    'Bamboo organizer with five compartments',
    24.5,
    'USD',
    40,
    'STATIONERY',
    4,
    'https://example.com/img/desk-organizer.png',
  ],
  [
    'Import Resistance Bands',
    'Set of three latex resistance bands',
    19.99,
    'EUR',
    120,
    'SPORTS',
    5,
    'https://example.com/img/resistance-bands.png',
  ],
  [
    'Import USB-C Hub',
    'Seven-port USB-C hub with HDMI output',
    49,
    'GBP',
    15,
    'ELECTRONICS',
    3,
    'https://example.com/img/usb-c-hub.png',
  ],
];

/**
 * The invalid fixture: one good row, then one row per failure (sheet rows, header = 1):
 * 3 missing name, 4 stock -1, 5 unknown category, 6 non-numeric price, 7 duplicate of the
 * seeded product "Yoga Mat" (different case, surrounding spaces).
 */
export const INVALID_ROWS = [
  ['Import Good Row', 'A valid row of the invalid file', 10, 'USD', 1, 'KITCHEN', 3, null],
  [null, 'Row without a name', 10, 'USD', 1, 'KITCHEN', null, null],
  ['Import Negative Stock', null, 10, 'USD', -1, 'KITCHEN', null, null],
  ['Import Unknown Category', null, 10, 'USD', 1, 'NOPE', null, null],
  ['Import Bad Price', null, 'abc', 'USD', 1, 'KITCHEN', null, null],
  ['  yoga MAT ', null, 10, 'USD', 1, 'SPORTS', null, null],
];

/**
 * A valid row with a unique name, for the generated large workbooks.
 * @param {number} i running number
 * @param {object} [overrides] cells to replace, by column name
 * @returns {Array<string|number|null>} row cells in HEADER order
 */
export function generatedRow(i, overrides = {}) {
  const row = {
    name: `Bulk Product ${String(i).padStart(4, '0')}`,
    description: null,
    price: 1.5,
    currency: 'USD',
    stock: 1,
    category: 'KITCHEN',
    rating: null,
    imageUrl: null,
    ...overrides,
  };
  return HEADER.map((column) => row[column]);
}

// Deterministic PRNG (mulberry32): the same seed always yields the same sequence.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fixed vocabulary of 900 pseudo-words built from syllables, so descriptions read like prose
// but compress poorly (each row's text differs).
const SYLLABLES = ['ka', 'lo', 'mi', 'ne', 'ru', 'sa', 'ti', 'vo', 'pe', 'da', 'gu', 'zo'];
const VOCABULARY = (() => {
  const next = seededRandom(7);
  return Array.from({ length: 900 }, () => {
    const count = 2 + Math.floor(next() * 3);
    return Array.from({ length: count }, () => SYLLABLES[Math.floor(next() * 12)]).join('');
  });
})();

/**
 * Deterministic prose of a fixed length, different for every seed.
 * @param {number} seed row number or any integer
 * @param {number} [length] characters, at most the 500 of `description`
 * @returns {string} words from a fixed vocabulary, cut to `length`
 */
export function proseDescription(seed, length = 500) {
  const next = seededRandom(seed + 1);
  let text = '';
  while (text.length < length) text += VOCABULARY[Math.floor(next() * VOCABULARY.length)] + ' ';
  return text.slice(0, length - 1) + '.';
}

/**
 * Write one sheet (header row first) into xlsx bytes.
 * @param {Array<Array<string|number|null>>} data rows including the header row
 * @returns {Promise<Buffer>} xlsx workbook
 */
export function workbook(data) {
  return writeXlsxFile(data).toBuffer();
}

/**
 * The `file` action parameter as a JSON client sends it: base64 content (research 5.2).
 * @param {Buffer} bytes file content
 * @param {string} [fileName] file name
 * @returns {{ content: string, mediaType: string, fileName: string }}
 */
export function fileParameter(bytes, fileName = 'products.xlsx') {
  return {
    content: bytes.toString('base64'),
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName,
  };
}

// Regenerate the committed fixtures when run as a script.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = import.meta.dirname;
  await writeXlsxFile([HEADER, ...VALID_ROWS]).toFile(`${dir}/products-import-valid.xlsx`);
  await writeXlsxFile([HEADER, ...INVALID_ROWS]).toFile(`${dir}/products-import-invalid.xlsx`);
}
