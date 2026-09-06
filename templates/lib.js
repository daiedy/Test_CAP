// Template: reusable module in srv/lib/<topic>.js. Pure functions, named exports, JSDoc on every export,
// no access to req/res or cds.context. Check docs/registry/REUSE-CATALOG.md before adding a new module.

/**
 * Calculate the stock level after a reorder.
 * @param {number} currentStock current quantity on hand
 * @param {number} amount quantity to add, must be positive
 * @returns {number} new stock level
 * @throws {RangeError} when amount is not a positive integer
 */
export function reorderQuantity(currentStock, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(`amount must be a positive integer, got ${amount}`);
  }
  return currentStock + amount;
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
