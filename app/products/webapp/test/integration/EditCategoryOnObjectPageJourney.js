/* global QUnit */
// Journey "edit category on the object page" (feature products-draft-edit, PLAN step 7, ADR-0012):
// CatalogService.Products is draft-enabled, so the Object Page offers Edit. In edit mode the Category
// field is a mandatory dropdown of localized names; a saved change is shown by name in the field and
// in the header description; Cancel with a persisted change asks for confirmation and discards the
// draft; the original value is restored at the end so the in-memory data stays as seeded and no draft
// is left behind (a stray draft would show up in the List Report and break iCheckRows(15)).
// The display mode of the category field is covered by CategoryShownAsNameJourney.
// products-subcategories (PLAN step 10, ADR-0024): the change to Furniture empties the subcategory
// of the product; the restore step therefore picks its subcategory again after Electronics, so the
// seeded pair is back at the end.
// products-details-section (PLAN step 7, ADR-0026 D1): the journey edits Wireless Earbuds
// (Electronics / Audio), a product without detail rows. Laptop Pro 15 now carries seeded detail rows
// that fit only Laptops, so its Save with another subcategory is rejected by design
// (PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS) and would leave a draft behind.
// products-subcategory-cascade (PLAN step 6): Subcategory is @mandatory, so the Furniture save
// picks the Furniture subcategory Lighting first; the journey ends on the List Report with no draft.
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/CategoryTexts', './data/SubcategoryTexts'],
  function (opaTest, CategoryTexts, SubcategoryTexts) {
    'use strict';

    const names = CategoryTexts.names.en;
    const allNames = Object.keys(names).map(function (sCode) {
      return names[sCode];
    });
    const subcategoryNames = SubcategoryTexts.names.en;
    const SUBCATEGORY = 'subcategory_code';
    const generalInfo = { section: 'GeneralInfo' };
    const categoryField = { property: 'category_code' };
    const subcategoryField = { property: SUBCATEGORY };
    // Electronics / Audio, no detail rows (db/data/my.catalog-ProductDetails.csv).
    const productName = 'Wireless Earbuds';

    // Picks a category in the dropdown of the Category field and waits until the field shows it
    // (the selection sends the PATCH of the draft before the next footer action is pressed).
    function chooseCategory(When, Then, sName) {
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(categoryField);
      When.onTheCategoryDropdown.iSelectItem(sName);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sName);
    }

    // Same idiom for the Subcategory field, whose dropdown lists the subcategories of the category.
    function chooseSubcategory(When, Then, sName) {
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
      When.onTheCategoryDropdown.iSelectItem(sName, SUBCATEGORY);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(subcategoryField, sName);
    }

    function seeSavedCategory(Then, sName) {
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sName);
      Then.onTheProductsObjectPage.onHeader().iCheckTitle(productName, sName);
    }

    return function () {
      QUnit.module('Edit category on the object page');

      opaTest('The object page of Wireless Earbuds offers Edit', function (Given, When, Then) {
        Given.iStartMyApp('products-display');
        Then.onTheProductsList.iSeeThisPage();
        When.onTheProductsList.onTable().iPressRow({ name: productName });
        Then.onTheProductsObjectPage.iSeeThisPage();
        Then.onTheProductsObjectPage.onHeader().iCheckEdit({ visible: true, enabled: true });
        When.onTheProductsObjectPage.onHeader().iExecuteEdit();
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
      });

      opaTest(
        'In edit mode Category is a mandatory dropdown of the six names',
        function (Given, When, Then) {
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(categoryField, names.ELECTRONICS, { required: true });
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(categoryField);
          Then.onTheCategoryDropdown.iSeeItems(allNames);
          When.onTheCategoryDropdown.iSelectItem(names.FURNITURE);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(categoryField, names.FURNITURE);
        }
      );

      opaTest(
        'Saving shows the new name in the field and in the header',
        function (Given, When, Then) {
          // Audio is not a Furniture subcategory: the category change emptied it, and a
          // mandatory subcategory of the new category is chosen before Save.
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          chooseSubcategory(When, Then, subcategoryNames.LIGHTING);
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          seeSavedCategory(Then, names.FURNITURE);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, subcategoryNames.LIGHTING);
        }
      );

      opaTest('Cancel discards the change', function (Given, When, Then) {
        When.onTheProductsObjectPage.onHeader().iExecuteEdit();
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        chooseCategory(When, Then, names.KITCHEN);
        When.onTheProductsObjectPage.onFooter().iExecuteCancel();
        When.onTheProductsObjectPage.onFooter().iConfirmCancel();
        seeSavedCategory(Then, names.FURNITURE);
      });

      opaTest(
        'Restoring the original category leaves the data as seeded',
        function (Given, When, Then) {
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          chooseCategory(When, Then, names.ELECTRONICS);
          chooseSubcategory(When, Then, subcategoryNames.AUDIO);
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          seeSavedCategory(Then, names.ELECTRONICS);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, subcategoryNames.AUDIO);
          // Back to the List Report by a restart (fallback of tests-ui.md; display mode, nothing
          // pending): all 15 rows, none with a draft marker.
          Given.iTearDownMyApp();
          Given.iStartMyApp('products-display');
          Then.onTheProductsList.iSeeThisPage();
          Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
        }
      );

      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
