// Template: reusable module in srv/lib/<topic>.js. Pure functions, named exports, JSDoc on every export,
// no access to req/res or cds.context. Check docs/registry/REUSE-CATALOG.md before adding a new module.

/**
 * Calculate the total of an order.
 * @param {number} quantity number of ordered units, must be positive
 * @param {number} unitPrice price of one unit
 * @returns {number} total, rounded to two decimals
 * @throws {RangeError} when quantity is not a positive integer
 */
export function orderTotal(quantity, unitPrice) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`quantity must be a positive integer, got ${quantity}`);
  }
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * Normalize a free-text category name to the code list convention.
 * @param {string} name user-entered category name
 * @returns {string} UPPER_SNAKE code, max 20 chars
 */
export function toCategoryCode(name) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}
