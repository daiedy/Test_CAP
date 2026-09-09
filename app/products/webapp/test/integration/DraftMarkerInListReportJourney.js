/* global QUnit */
// Journey "draft marker in the list report" (feature products-draft-marker, PLAN step 5, ADR-0015):
// with Common.SemanticKey: [ name ] the responsive table renders the editing status as a
// sap.m.ObjectMarker inside the Product Name cell, so a row that has an own draft is recognizable
// without opening it. The journey creates exactly one draft, asserts the marker, narrows the list
// with the framework Editing Status filter and discards the draft again, so the seeded data and the
// row count the other journeys rely on stay untouched. It is registered last in opaTests.qunit.js
// for that reason. The lock marker of another user's draft cannot be reached from one OPA5 session
// and is a ui-verifier scenario instead.
// The journey leaves the object page by tearing the app down and starting it again with the same
// intent, because the breadcrumb link is not reachable in edit mode; see the comment in case 2.
sap.ui.define(
  ['sap/ui/test/opaQunit', 'sap/fe/test/api/EditState', './data/CategoryTexts'],
  function (opaTest, EditState, CategoryTexts) {
    'use strict';

    const names = CategoryTexts.names.en;
    const generalInfo = { section: 'GeneralInfo' };
    const categoryField = { property: 'category_code' };
    const laptopName = 'Laptop Pro 15';
    const laptopRow = { name: laptopName };

    // Same idiom as EditCategoryOnObjectPageJourney: selecting a value in the dropdown sends the
    // PATCH of the draft, so the draft is persisted before the journey leaves the object page.
    function chooseCategory(When, Then, sName) {
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(categoryField);
      When.onTheCategoryDropdown.iSelectItem(sName);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sName);
    }

    return function () {
      QUnit.module('Draft marker in the list report');

      opaTest('An unchanged product shows no editing-status marker', function (Given, When, Then) {
        Given.iStartMyApp('products-display');
        Then.onTheProductsList.iSeeThisPage();
        Then.onTheProductsList.onTable().iCheckRows(15);
        // Third argument of iCheckRows is the row state; isDraft matches a sap.m.ObjectMarker
        // inside the row, so false means the seeded row carries no editing status at all.
        Then.onTheProductsList.onTable().iCheckRows(laptopRow, 1, { isDraft: false });
      });

      opaTest(
        'Editing the product on the object page commits a draft',
        function (Given, When, Then) {
          When.onTheProductsList.onTable().iPressRow(laptopRow);
          Then.onTheProductsObjectPage.iSeeThisPage();
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          chooseCategory(When, Then, names.FURNITURE);
          // Documented fallback of PLAN step 5 instead of onHeader().iNavigateByBreadcrumb():
          // measured on 2026-09-09, the breadcrumb link is not reachable while the object page is
          // in edit mode. iNavigateByBreadcrumb('Products') passes without navigating (its
          // doOnAggregation finds no matching link), and the next assertion then times out on the
          // object page. A restart is used instead of shell or browser Back, which would open the
          // Save / Keep Draft / Discard Draft dialog; it is dialog-free because the draft change
          // is already persisted server-side ("Draft updated" in the footer).
          Given.iTearDownMyApp();
        }
      );

      opaTest('The own draft is marked in the list report row', function (Given, When, Then) {
        Given.iStartMyApp('products-display');
        Then.onTheProductsList.iSeeThisPage();
        // In the default "All" editing status the draft replaces its active sibling, so the row
        // count stays the same and only the marker changes.
        Then.onTheProductsList.onTable().iCheckRows(15);
        Then.onTheProductsList.onTable().iCheckRows(laptopRow, 1, { isDraft: true });
      });

      opaTest(
        'The Editing Status filter Own Draft narrows the list to that row',
        function (Given, When, Then) {
          When.onTheProductsList.onFilterBar().iChangeEditingStatus(EditState.OwnDraft);
          When.onTheProductsList.onFilterBar().iExecuteSearch();
          Then.onTheProductsList.onTable().iCheckRows(1);
          Then.onTheProductsList.onTable().iCheckRows(laptopRow, 1, { isDraft: true });
          // Back to the default editing status, so the next case works on the whole list again.
          When.onTheProductsList.onFilterBar().iChangeEditingStatus(EditState.All);
          When.onTheProductsList.onFilterBar().iExecuteSearch();
          Then.onTheProductsList.onTable().iCheckRows(15);
        }
      );

      opaTest('Discarding the draft removes the marker', function (Given, When, Then) {
        // An own draft opens in edit mode directly.
        When.onTheProductsList.onTable().iPressRow(laptopRow);
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        When.onTheProductsObjectPage.onFooter().iExecuteCancel();
        When.onTheProductsObjectPage.onFooter().iConfirmCancel();
        Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
        // The discard restores the seeded values: the field and the header description show
        // Electronics again, not the Furniture of the draft.
        Then.onTheProductsObjectPage
          .onForm(generalInfo)
          .iCheckField(categoryField, names.ELECTRONICS);
        Then.onTheProductsObjectPage.onHeader().iCheckTitle(laptopName, names.ELECTRONICS);
        // Same fallback as at the end of case 2, for the same reason.
        Given.iTearDownMyApp();
        Given.iStartMyApp('products-display');
        Then.onTheProductsList.iSeeThisPage();
        Then.onTheProductsList.onTable().iCheckRows(15);
        Then.onTheProductsList.onTable().iCheckRows(laptopRow, 1, { isDraft: false });
      });

      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
