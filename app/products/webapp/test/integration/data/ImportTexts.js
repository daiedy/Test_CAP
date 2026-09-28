/*
 * Expected values for the import journeys (products-excel-upload, PLAN step 9): the table action
 * identifier of the collection-bound action CatalogService.importProducts, the _i18n labels that
 * reach the action parameter dialog via $metadata, and the seeded row count of the List Report.
 * Ids of the dialog are measured on the running app (research 6.2 and 6.5) and live in
 * pages/ImportProductsDialog.js. Non-ASCII text is written as \u escapes (transliteration in the
 * comment) to keep the test sources ASCII-only.
 * The value-state text of an empty submit is a framework text of the unpinned UI5 CDN
 * (C_OPERATIONS_ACTION_PARAMETER_DIALOG_FILE_MISSING_MANDATORY_MSG); the journeys assert only that
 * it names the file label, never the whole sentence.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    // sap.fe.test ActionIdentifier: BaseAPI#createActionMatcher builds the id regex
    // "CatalogService.importProducts(::...)*$" from it, so the button is matched by id, not by text.
    action: { service: 'CatalogService', action: 'importProducts' },
    // Rows of db/data/my.catalog-Products.csv; the journeys never upload, so the count never changes.
    seededRows: 15,
    labels: {
      // _i18n key Products.action.import: toolbar button, dialog title and dialog OK button.
      action: {
        en: 'Import from Excel',
        ru: '\u0418\u043C\u043F\u043E\u0440\u0442 \u0438\u0437 Excel', // Import iz Excel
      },
      // _i18n key ProductsImportFile.content: label of the file field.
      file: {
        en: 'Excel File (.xlsx)',
        ru: '\u0424\u0430\u0439\u043B Excel (.xlsx)', // Fajl Excel (.xlsx)
      },
    },
  };
});
