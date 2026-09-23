/* global QUnit */
// Journey "role-aware actions" (feature catalog-authorization, PLAN step 11, ADR-0013 part 8):
// UI.CreateHidden, UI.UpdateHidden and UI.DeleteHidden on CatalogService.Products are bound with
// $edmJson to /CatalogService.EntityContainer/Permissions/isEditor, the singleton served by
// srv/catalog-service.js. This journey is the regression guard for plan risk R6: if that path ever
// stops resolving, the annotations evaluate to "hidden" and the four standard actions disappear for
// editors too, silently, with no error anywhere. The whole OPA suite authenticates as exactly one
// user (page.authenticate from app/products/ui5-test-runner.json), and that user is alice, a
// CatalogEditor, so this journey asserts the editor half of decision 6. The viewer half - the same
// actions absent for a CatalogViewer - is covered by the backend tests and by the blocking
// ui-verifier criteria, not here (PLAN, "Open questions for the user", answered 2026-09-10).
// It is registered last in opaTests.qunit.js: it only reads and selects, so it changes no data, and
// running last keeps it independent of the draft the marker journey creates and discards.
sap.ui.define(['sap/ui/test/opaQunit'], function (opaTest) {
  'use strict';

  const laptopRow = { name: 'Laptop Pro 15' };

  return function () {
    QUnit.module('Role-aware actions');

    opaTest('An editor still sees the editing actions', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckRows(15);

      // UI.CreateHidden must evaluate to false for a CatalogEditor: the Create button of the table
      // toolbar is rendered and ready. iCheckCreate matches the standard action by its identifier
      // ({ service: 'StandardAction', action: 'Create' }), not by its label, so it is language
      // independent.
      Then.onTheProductsList.onTable().iCheckCreate({ visible: true, enabled: true });

      // UI.DeleteHidden on the list report: the Delete button is rendered from the start and the
      // framework enables it once a row is selected. Both states are asserted, so a run in which
      // the selection silently failed cannot pass as "Delete is there".
      Then.onTheProductsList.onTable().iCheckDelete({ visible: true });
      When.onTheProductsList.onTable().iSelectRows(laptopRow);
      Then.onTheProductsList.onTable().iCheckDelete({ visible: true, enabled: true });

      // UI.UpdateHidden and UI.DeleteHidden on the object page header. The row selection above does
      // not block the navigation; pressing the row opens the object page in display mode.
      When.onTheProductsList.onTable().iPressRow(laptopRow);
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onHeader().iCheckEdit({ visible: true, enabled: true });
      Then.onTheProductsObjectPage.onHeader().iCheckDelete({ visible: true, enabled: true });
    });

    // Teardown only, per rule tests-ui.md: a failed step must not leave the frame open for the next
    // journey ("Launch was called twice without teardown"). Nothing has to be cleaned up in the
    // data: the journey never left display mode and created no draft.
    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
