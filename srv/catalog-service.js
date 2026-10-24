import cds from '@sap/cds';
import { columnOf, decodeContent, readImportRows } from './lib/products-import.js';

const LOG = cds.log('catalog');

/** Upper bound of data rows per workbook (ADR-0021 decision 7). */
const MAX_IMPORT_ROWS = 1000;

/**
 * Handlers of CatalogService.
 * - READ Permissions: tells the Fiori UI whether the caller may edit. Enforcement is declarative
 *   (`@requires` / `@restrict` in catalog-service.cds); this is the signal behind UI.CreateHidden /
 *   UI.UpdateHidden / UI.DeleteHidden (ADR-0013).
 * - importProducts: creates active products from an xlsx workbook, all-or-nothing (ADR-0021).
 * - PATCH Products.drafts: clears a subcategory that does not belong to the new category
 *   (ADR-0024 decision 3); the pair itself is checked by the `@assert` constraint (decision 2).
 *   Then a new subcategory reconciles the detail rows of the draft (ADR-0027 decision 3).
 * - EDIT Products: fills the detail rows a product without rows lacks (ADR-0027 decision 3, PLAN D13).
 */
export default class CatalogService extends cds.ApplicationService {
  /**
   * Registers the handlers of the service in the order before, on, after.
   * @returns {Promise<void>} the generic initialization of cds.ApplicationService
   */
  async init() {
    const { Products, Subcategories } = this.entities;

    this.before('PATCH', Products.drafts, async (req) => {
      await resetStaleSubcategory(Subcategories, req);
      await syncDetailRows(this, req);
    });

    this.on('READ', 'Permissions', (req) =>
      req.reply({ ID: 'me', isEditor: req.user.is('CatalogEditor') })
    );

    this.on('importProducts', Products, (req) => importProducts(this, Products, req));

    this.after('EDIT', Products, (result, req) => fillDetailRows(this, result, req));

    return super.init();
  }
}

/**
 * Dependent field reset on a draft (ADR-0024 decision 3): when a draft PATCH changes the category
 * without carrying the subcategory, a stored subcategory that does not belong to the new category
 * is cleared, so the stale value neither stays visible nor fails at Save. A subcategory of the new
 * category is kept (for example one chosen before the category on a new draft). Silent: no message,
 * no rejection; active writes are not reset, there the `@assert` constraint rejects (decision 2).
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
 * Rows generated from the assignment on a draft (ADR-0027 decision 3, U2, U3): a draft PATCH that
 * sets a subcategory reconciles the detail rows of the draft with the attributes of that
 * subcategory. Runs after resetStaleSubcategory, so a subcategory it clears arrives as null: an
 * absent or null subcategory keeps the rows unchanged until a new one is set (PLAN D10).
 * Active writes are never reconciled; the root constraint PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS
 * rejects them (PLAN D15).
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {cds.Request} req PATCH request on Products.drafts
 */
async function syncDetailRows(srv, req) {
  const subcategory = req.data.subcategory_code;
  if (!subcategory) return;
  const draft = await SELECT.one
    .from(req.subject)
    .columns('ID', 'DraftAdministrativeData_DraftUUID');
  if (draft) await reconcileDetailRows(srv, draft, subcategory, req);
}

/**
 * Fill at Edit (PLAN D13): a product created without detail rows (importProducts, the API) gets
 * one empty row per attribute of its subcategory in the new draft. The EDIT result carries no
 * DraftAdministrativeData_DraftUUID, so the draft is read back (research R6).
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {{ ID?: string }} result the new draft returned by EDIT
 * @param {cds.Request} req EDIT request on Products
 */
async function fillDetailRows(srv, result, req) {
  if (!result?.ID) return;
  const draft = await SELECT.one
    .from(srv.entities.Products.drafts)
    .columns('ID', 'subcategory_code', 'DraftAdministrativeData_DraftUUID')
    .where({ ID: result.ID });
  if (draft?.subcategory_code) await reconcileDetailRows(srv, draft, draft.subcategory_code, req);
}

/**
 * After the call the draft holds exactly one row per attribute assigned to the subcategory, the
 * common ones unchanged (ADR-0027 decision 3): rows of assigned attributes keep their values and
 * selections and get the assignment's position; the other rows are deleted (their draft selections
 * go with them, research R8); each missing attribute gets an empty row. Rows are written to the
 * draft table directly, so they carry the parent's DraftAdministrativeData_DraftUUID (research
 * R10: the insert fails without it). When deleted rows held a value, the warning
 * PRODUCTS_DETAILS_VALUES_REMOVED goes to the response (PLAN D16).
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {{ ID: string, DraftAdministrativeData_DraftUUID: string }} draft the product draft
 * @param {string} subcategory code of the subcategory whose attributes the rows must match
 * @param {cds.Request} req the PATCH or EDIT request, receives the warning
 */
async function reconcileDetailRows(srv, draft, subcategory, req) {
  const { ProductDetails, SubcategoryAttributes } = srv.entities;
  const assigned = await SELECT.from(SubcategoryAttributes)
    .columns('attribute_code', 'position')
    .where({ subcategory_code: subcategory });
  const rows = await SELECT.from(ProductDetails.drafts)
    .columns('ID', 'attribute_code', 'position', 'textValue', 'numberValue', 'listValue_code')
    .where({ product_ID: draft.ID });

  const positionOf = new Map(assigned.map((a) => [a.attribute_code, a.position]));
  const present = new Set(rows.map((row) => row.attribute_code));
  const stale = rows.filter((row) => !positionOf.has(row.attribute_code));
  const missing = assigned.filter((a) => !present.has(a.attribute_code));
  const moved = rows.filter(
    (row) =>
      positionOf.has(row.attribute_code) && positionOf.get(row.attribute_code) !== row.position
  );

  if (stale.length) {
    const filled = await filledRows(srv, stale);
    await DELETE.from(ProductDetails.drafts).where({ ID: { in: stale.map((row) => row.ID) } });
    if (filled.length) await warnValuesRemoved(srv, filled, req);
  }
  if (missing.length) {
    await INSERT.into(ProductDetails.drafts).entries(
      missing.map((a) => ({
        ID: cds.utils.uuid(),
        product_ID: draft.ID,
        attribute_code: a.attribute_code,
        position: a.position,
        IsActiveEntity: false,
        HasActiveEntity: false,
        HasDraftEntity: false,
        DraftAdministrativeData_DraftUUID: draft.DraftAdministrativeData_DraftUUID,
      }))
    );
  }
  for (const row of moved) {
    await UPDATE(ProductDetails.drafts)
      .set({ position: positionOf.get(row.attribute_code) })
      .where({ ID: row.ID });
  }
  LOG.debug('detail rows reconciled', {
    product: draft.ID,
    subcategory,
    kept: rows.length - stale.length,
    removed: stale.length,
    created: missing.length,
  });
}

/**
 * Rows that hold a value: a text, a number or a list value, or at least one selection (MULTI_LIST).
 * An empty text counts as no value.
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {Array<{ ID: string, textValue?: string, numberValue?: unknown, listValue_code?: string }>} rows draft rows
 * @returns {Promise<Array<object>>} the filled rows, in the given order
 */
async function filledRows(srv, rows) {
  const selected = await SELECT.from(srv.entities.ProductDetailSelections.drafts)
    .columns('detail_ID')
    .where({ detail_ID: { in: rows.map((row) => row.ID) } });
  const withSelections = new Set(selected.map((s) => s.detail_ID));
  return rows.filter(
    (row) =>
      (row.textValue != null && row.textValue !== '') ||
      row.numberValue != null ||
      row.listValue_code != null ||
      withSelections.has(row.ID)
  );
}

/**
 * Warning of U3 (PLAN D16, SCREENS "Subcategory change"): {0} the number of removed filled values,
 * {1} their localized attribute names in the old field order, joined by ", ". The warning travels
 * in the sap-messages header only and is not persisted as a draft message (research R7). cds 10
 * writes sap-messages in the default language (see importProducts), so the text is resolved in the
 * request locale here; SELECT.localized reads the names in that locale.
 * @param {cds.ApplicationService} srv this CatalogService
 * @param {Array<{ attribute_code: string, position?: number }>} removed the deleted filled rows
 * @param {cds.Request} req the request that receives the warning
 */
async function warnValuesRemoved(srv, removed, req) {
  const codes = removed.map((row) => row.attribute_code);
  const named = await SELECT.localized
    .from(srv.entities.DetailAttributes)
    .columns('code', 'name')
    .where({ code: { in: codes } });
  const nameOf = new Map(named.map(({ code, name }) => [code, name]));
  const last = Number.MAX_SAFE_INTEGER;
  const names = [...removed]
    .sort((a, b) => (a.position ?? last) - (b.position ?? last))
    .map((row) => nameOf.get(row.attribute_code) ?? row.attribute_code);
  const args = [removed.length, names.join(', ')];
  req.warn({
    code: 'PRODUCTS_DETAILS_VALUES_REMOVED',
    target: 'subcategory_code',
    message: cds.i18n.messages.at('PRODUCTS_DETAILS_VALUES_REMOVED', req.locale, args),
    args,
  });
}

/**
 * One INSERT per row through the service, so `@mandatory` / `@assert.*` / data types are checked by
 * the framework (research 5.3, 5.3a) and attributed to the sheet row. Duplicate names and the
 * subcategory-category pair are checked before the inserts, because no annotation reports them per
 * row (ADR-0021 decision 5, amendment 4 E). Any error rejects the whole request, which rolls back
 * the rows already inserted (ADR-0021 decision 4).
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
  rowErrors.push(...(await subcategoryMismatches(rows, order, req.locale)));
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
 *   one PRODUCTS_IMPORT_DUPLICATE_NAME per row whose name an earlier row or an active product has
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
 * Rows whose subcategory belongs to a category other than the row's own (ADR-0021 amendment 4 E).
 * The ADR-0024 `@assert` constraint PRODUCTS_SUBCATEGORY_MISMATCH is checked once at commit and its
 * error names no row, so the same pair rule is checked here per row, before the inserts; the
 * constraint stays the guard of every write. Rows with an empty category, an empty subcategory or
 * an unknown subcategory code are skipped: `@mandatory` and `@assert.target` report them on the
 * row's INSERT.
 * @param {Array<{ row: number, entry: Record<string, unknown> }>} rows import rows
 * @param {(column: string) => number} order header position of a column
 * @param {string} locale request locale for the reason text
 * @returns {Promise<Array<{ row: number, order: number, code: string, args: Array<unknown> }>>}
 *   one PRODUCTS_IMPORT_ROW_INVALID per mismatched row, column `subcategory`
 */
async function subcategoryMismatches(rows, order, locale) {
  const paired = rows.filter(
    ({ entry }) => entry.category_code !== undefined && entry.subcategory_code !== undefined
  );
  const codes = [...new Set(paired.map(({ entry }) => entry.subcategory_code))];
  if (!codes.length) return [];
  const { Subcategories } = cds.entities('my.catalog');
  const known = await SELECT.from(Subcategories).columns('code', 'category_code')
    .where`code in ${codes}`;
  const categoryOf = new Map(known.map(({ code, category_code }) => [code, category_code]));
  const reason =
    cds.i18n.messages.at('PRODUCTS_SUBCATEGORY_MISMATCH', locale) ??
    'PRODUCTS_SUBCATEGORY_MISMATCH';
  return paired
    .filter(({ entry }) => {
      const category = categoryOf.get(entry.subcategory_code);
      return category !== undefined && category !== entry.category_code;
    })
    .map(({ row }) => ({
      row,
      order: order('subcategory'),
      code: 'PRODUCTS_IMPORT_ROW_INVALID',
      args: [row, 'subcategory', reason],
    }));
}

/**
 * Map a rejected INSERT to row messages, one per column: the framework's input validation
 * reports ASSERT_* codes with the element as target (research 5.3). Anything else is rethrown.
 * @param {Error & { details?: Array<object>, code?: string, target?: string, args?: Array<unknown> }} err
 *   error of the rejected INSERT, with the framework's messages in `details` when there are several
 * @param {number} row sheet row, header = 1
 * @param {string} locale request locale for the framework's reason text
 * @param {(column: string) => number} order header position of a column
 * @returns {Array<{ row: number, order: number, code: string, args: Array<unknown> }>}
 *   one PRODUCTS_IMPORT_ROW_INVALID per rejected column of the row
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
