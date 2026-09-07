/* global QUnit */
// Journey "edit category on the object page" (PLAN step 13): in edit mode the Category field is a
// mandatory dropdown of names; a saved change is shown by name in the field and in the header, and
// the original value is restored at the end so the in-memory data stays as seeded.
//
// SKIPPED (known limitation): Products is not draft-enabled, so SAP Fiori elements for OData V4
// renders no Edit action on the object page (checked on 2026-09-07: the header offers
// StandardAction::Delete only, EasyEdit stays invisible). The intended flow is kept below and is
// switched from opaTest.skip to opaTest once editing exists; see docs/STATE.md, open debt.
// The display mode of the category field is covered by CategoryShownAsNameJourney.
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts'], function (opaTest, CategoryTexts) {
  'use strict';

  const editTest = opaTest.skip;
  const names = CategoryTexts.names.en;
  const allNames = Object.keys(names).map(function (sCode) {
    return names[sCode];
  });
  const generalInfo = { section: 'GeneralInfo' };
  const categoryField = { property: 'category_code' };

  return function () {
    QUnit.module('Edit category on the object page');

    editTest('The object page of Laptop Pro 15 offers Edit', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      When.onTheProductsList.onTable().iPressRow({ name: 'Laptop Pro 15' });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.onHeader().iCheckEdit({ visible: true, enabled: true });
      When.onTheProductsObjectPage.onHeader().iExecuteEdit();
      Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
    });

    editTest('In edit mode Category is a mandatory dropdown of the six names', function (Given, When, Then) {
      Then.onTheProductsObjectPage
        .onForm(generalInfo)
        .iCheckField(categoryField, names.ELECTRONICS, { required: true });
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(categoryField);
      Then.onTheCategoryDropdown.iSeeItems(allNames);
      When.onTheCategoryDropdown.iSelectItem(names.FURNITURE);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, names.FURNITURE);
    });

    editTest('Saving shows the new name in the field and in the header', function (Given, When, Then) {
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, names.FURNITURE);
      Then.onTheProductsObjectPage.onHeader().iCheckTitle('Laptop Pro 15', names.FURNITURE);
    });

    editTest('Restoring the original category leaves the data as seeded', function (Given, When, Then) {
      When.onTheProductsObjectPage.onHeader().iExecuteEdit();
      Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
      When.onTheProductsObjectPage.onForm(generalInfo).iChangeField(categoryField, names.ELECTRONICS);
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, names.ELECTRONICS);
      Then.onTheProductsObjectPage.onHeader().iCheckTitle('Laptop Pro 15', names.ELECTRONICS);
    });

    editTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
