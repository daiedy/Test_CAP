/* global QUnit */
// Journey "edit category on the object page" (feature products-draft-edit, PLAN step 7, ADR-0012):
// CatalogService.Products is draft-enabled, so the Object Page offers Edit. In edit mode the Category
// field is a mandatory dropdown of localized names; a saved change is shown by name in the field and
// in the header description; Cancel with a persisted change asks for confirmation and discards the
// draft; the original value is restored at the end so the in-memory data stays as seeded and no draft
// is left behind (a stray draft would show up in the List Report and break iCheckRows(15)).
// The display mode of the category field is covered by CategoryShownAsNameJourney.
// products-subcategories (PLAN step 10, ADR-0024): the change to Furniture empties the subcategory
// of Laptop Pro 15 and the empty value is saved (D2, optional); the restore step therefore picks
// Laptops again after Electronics, so the seeded pair Electronics / Laptops is back at the end.
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts', './data/SubcategoryTexts'], function (
  opaTest,
  CategoryTexts,
  SubcategoryTexts
) {
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
    Then.onTheProductsObjectPage.onHeader().iCheckTitle('Laptop Pro 15', sName);
  }

  return function () {
    QUnit.module('Edit category on the object page');

    opaTest('The object page of Laptop Pro 15 offers Edit', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      When.onTheProductsList.onTable().iPressRow({ name: 'Laptop Pro 15' });
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
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        seeSavedCategory(Then, names.FURNITURE);
        // Laptops is not a Furniture subcategory: the category change emptied it and the empty
        // value was saved.
        Then.onTheCategoryDropdown.iSeeFormFieldEmpty(SUBCATEGORY);
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
        chooseSubcategory(When, Then, subcategoryNames.LAPTOPS);
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        seeSavedCategory(Then, names.ELECTRONICS);
        Then.onTheProductsObjectPage
          .onForm(generalInfo)
          .iCheckField(subcategoryField, subcategoryNames.LAPTOPS);
      }
    );

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
