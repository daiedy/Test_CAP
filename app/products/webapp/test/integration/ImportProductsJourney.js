/* global QUnit */
// Journey "import products from Excel" (feature products-excel-upload, PLAN step 9, ADR-0021):
// UI.DataFieldForAction for the collection-bound action CatalogService.importProducts in UI.LineItem
// renders a table toolbar button, hidden for non-editors through the Permissions singleton; the
// button opens the Fiori Elements action parameter dialog with a file field for the parameter
// "file" (complex type ProductsImportFile, Edm.Stream element "content"). @mandatory on "file"
// (amendment B) marks the field label required and makes the dialog reject an empty submit on the
// client. The whole OPA suite authenticates as alice (CatalogEditor, app/products/ui5-test-runner.json),
// so this journey asserts the editor half; the viewer half (no button) is covered by the backend
// tests (403) and ui-verifier. OPA5 cannot choose a file in the browser's file dialog (PLAN risks):
// the upload itself, the success message and the refresh to 18 rows are covered by the backend
// tests and ui-verifier; this journey covers the button, the dialog, the required file and Cancel,
// and never sends the action, so it changes no data.
sap.ui.define(['sap/ui/test/opaQunit', './data/ImportTexts'], function (opaTest, ImportTexts) {
  'use strict';

  const importAction = ImportTexts.action;
  const actionLabel = ImportTexts.labels.action.en;
  const fileLabel = ImportTexts.labels.file.en;
  const seededRows = ImportTexts.seededRows;

  return function () {
    QUnit.module('Import products from Excel');

    opaTest('The import button opens the upload dialog', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckRows(seededRows);

      // The action is bound to the collection, so the button is enabled with no row selected.
      Then.onTheProductsList
        .onTable()
        .iCheckAction(importAction, { visible: true, enabled: true, text: actionLabel });
      When.onTheProductsList.onTable().iExecuteAction(importAction);

      Then.onTheImportDialog.iSeeTheDialog(actionLabel);
      Then.onTheImportDialog.iSeeTheFileField(fileLabel);
      Then.onTheImportDialog.iSeeTheButtons(actionLabel);

      When.onTheImportDialog.iPressCancel();
      Then.onTheImportDialog.iSeeTheDialogClosed();
      // Nothing was sent: the seeded rows only, none of them with a draft marker.
      Then.onTheProductsList.onTable().iCheckRows({}, seededRows, { isDraft: false });
    });

    opaTest('The import dialog requires a file', function (Given, When, Then) {
      When.onTheProductsList.onTable().iExecuteAction(importAction);
      Then.onTheImportDialog.iSeeTheDialog(actionLabel);
      // The required marker is on the label; the field is empty and without an error before the submit.
      Then.onTheImportDialog.iSeeTheFileField(fileLabel);

      When.onTheImportDialog.iPressImport();
      Then.onTheImportDialog.iSeeTheFileFieldInError(fileLabel);

      When.onTheImportDialog.iPressCancel();
      Then.onTheImportDialog.iSeeTheDialogClosed();
      Then.onTheProductsList.onTable().iCheckRows({}, seededRows, { isDraft: false });
    });

    // Teardown only, per rule tests-ui.md: a failed step must not leave the frame open for the next
    // journey ("Launch was called twice without teardown").
    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
