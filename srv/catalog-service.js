import cds from '@sap/cds';
import { columnOf, decodeContent, readImportRows } from './lib/products-import.js';

const LOG = cds.log('catalog');

/** Upper bound of data rows per workbook (ADR-0021 decision 7). */
const MAX_IMPORT_ROWS = 1000;

/**
 * Handlers of CatalogService.
 * - READ Permissions: tells the Fiori UI whether the caller may edit. Enforcement is declarative
 *   (@requires / @restrict in catalog-service.cds); this is the signal behind UI.CreateHidden /
 *   UI.UpdateHidden / UI.DeleteHidden (ADR-0013).
 * - importProducts: creates active products from an xlsx workbook, all-or-nothing (ADR-0021).
 * - PATCH Products.drafts: clears a subcategory that does not belong to the new category
 *   (ADR-0024 decision 3); the pair itself is checked by the @assert constraint (decision 2).
 */
export default class CatalogService extends cds.ApplicationService {
  async init() {
    const { Products, Subcategories } = this.entities;

    this.before('PATCH', Products.drafts, (req) => resetStaleSubcategory(Subcategories, req));

    this.on('READ', 'Permissions', (req) =>
      req.reply({ ID: 'me', isEditor: req.user.is('CatalogEditor') })
    );

    this.on('importProducts', Products, (req) => importProducts(this, Products, req));

    return super.init();
  }
}

/**
 * Dependent field reset on a draft (ADR-0024 decision 3): when a draft PATCH changes the category
 * without carrying the subcategory, a stored subcategory that does not belong to the new category
 * is cleared, so the stale value neither stays visible nor fails at Save. A subcategory of the new
 * category is kept (for example one chosen before the category on a new draft). Silent: no message,
 * no rejection; active writes are not reset, there the @assert constraint rejects (decision 2).
 * @param {object} Subcategories the service entity of the code list
 * @param {cds.Request} req PATCH request on Products.drafts
 */
async function resetStaleSubcategory(Subcategories, req) {
  if (!('category_code' in req.data) || 'subcategory_code' in req.data) return;
  const draft = await SELECT.one.from(req.subject).columns('subcategory_code');
  const code = draft?.subcategory_code;
  if (!code) return;
  const match = await SELECT.one
    .from(Subcategories)
    .columns('code')
    .where({ code, category_code: req.data.category_code });
  if (!match) req.data.subcategory_code = null;
}

/**
 * One INSERT per row through the service, so @mandatory / @assert.* / data types are checked by
 * the framework (research 5.3, 5.3a) and attributed to the sheet row. Any error rejects the whole
 * request, which rolls back the rows already inserted (ADR-0021 decision 4).
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {object} Products the service entity
 * @param {cds.Request} req action request
 * @returns {Promise<number|undefined>} count of created products
 */
async function importProducts(srv, Products, req) {
  const { columns, rows, errors } = await readImportRows(decodeContent(req.data.file?.content));
  if (errors.length) return rejectImport(req, errors);
  if (rows.length > MAX_IMPORT_ROWS) {
    return rejectImport(req, [
      { code: 'PRODUCTS_IMPORT_TOO_MANY_ROWS', args: [rows.length, MAX_IMPORT_ROWS] },
    ]);
  }

  const order = (column) => columns.indexOf(column);
  const rowErrors = await duplicateNames(rows, order);
  for (const { row, entry } of rows) {
    try {
      await srv.run(INSERT.into(Products).entries(entry));
    } catch (err) {
      rowErrors.push(...validationErrors(err, row, req.locale, order));
    }
  }
  if (rowErrors.length) {
    rowErrors.sort((a, b) => a.row - b.row || a.order - b.order);
    return rejectImport(req, rowErrors);
  }

  LOG.info('products imported', { count: rows.length });
  // cds 10.0.6 writes sap-messages in the default language (ODataAdapter.sap_messages4 calls
  // normalized() but not localized()), so the text is resolved in the request locale here.
  const args = [rows.length];
  req.info({
    code: 'PRODUCTS_IMPORT_DONE',
    message: cds.i18n.messages.at('PRODUCTS_IMPORT_DONE', req.locale, args),
    args,
  });
  return rows.length;
}

/**
 * Collect the rejection: PRODUCTS_IMPORT_NOTHING_IMPORTED first, then every message, no field
 * target and no cap. The object form keeps the message key as `code` of every detail. The
 * framework rejects the request after the `on` phase (req.errors), which rolls back the inserts.
 * @param {cds.Request} req action request
 * @param {Array<{ code: string, args: Array<unknown> }>} messages structural or row messages
 */
function rejectImport(req, messages) {
  LOG.info('products import rejected', { messages: messages.length });
  req.error({ status: 400, code: 'PRODUCTS_IMPORT_NOTHING_IMPORTED' });
  for (const { code, args } of messages) req.error({ status: 400, code, args });
}

/**
 * Names repeated inside the file or equal to an existing active product (case-insensitive,
 * trimmed); the model has no uniqueness constraint (ADR-0021 decision 5).
 * @param {Array<{ row: number, entry: Record<string, unknown> }>} rows import rows
 * @param {(column: string) => number} order header position of a column
 * @returns {Promise<Array<{ row: number, order: number, code: string, args: Array<unknown> }>>}
 */
async function duplicateNames(rows, order) {
  const key = (name) => String(name).trim().toLowerCase();
  const named = rows.filter(({ entry }) => entry.name !== undefined);
  const keys = [...new Set(named.map(({ entry }) => key(entry.name)))];
  const { Products: Persisted } = cds.entities('my.catalog');
  const existing = keys.length
    ? await SELECT.from(Persisted).columns('name').where`lower(trim(name)) in ${keys}`
    : [];
  const seen = new Set(existing.map(({ name }) => key(name)));
  const errors = [];
  for (const { row, entry } of named) {
    const k = key(entry.name);
    if (seen.has(k)) {
      errors.push({
        row,
        order: order('name'),
        code: 'PRODUCTS_IMPORT_DUPLICATE_NAME',
        args: [row, entry.name],
      });
    }
    seen.add(k);
  }
  return errors;
}

/**
 * Map a rejected INSERT to row messages, one per column: the framework's input validation
 * reports ASSERT_* codes with the element as target (research 5.3). Anything else is rethrown.
 * @param {Error & { details?: Array<object>, code?: string, target?: string, args?: Array<unknown> }} err
 * @param {number} row sheet row, header = 1
 * @param {string} locale request locale for the framework's reason text
 * @param {(column: string) => number} order header position of a column
 * @returns {Array<{ row: number, order: number, code: string, args: Array<unknown> }>}
 */
function validationErrors(err, row, locale, order) {
  const details = err.details?.length ? err.details : [err];
  if (!details.every((d) => typeof d.code === 'string' && d.code.startsWith('ASSERT_'))) throw err;
  const byColumn = new Map();
  for (const { code, target, args } of details) {
    const column = columnOf(target);
    if (byColumn.has(column)) continue;
    const reason = cds.i18n.messages.at(code, locale, args) ?? code;
    byColumn.set(column, {
      row,
      order: order(column),
      code: 'PRODUCTS_IMPORT_ROW_INVALID',
      args: [row, column, reason],
    });
  }
  return [...byColumn.values()];
}
