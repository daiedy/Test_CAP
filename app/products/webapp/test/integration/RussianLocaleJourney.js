/* global QUnit */
// Journey "russian locale shows translated categories" (PLAN step 13): started with
// sap-ui-language=ru, the filter label, the column header, the dropdown items, the table cells and
// the object page show the Russian texts of _i18n and Categories.texts.
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts'], function (opaTest, CategoryTexts) {
  'use strict';

  const names = CategoryTexts.names.ru;
  const allNames = Object.keys(names).map(function (sCode) {
    return names[sCode];
  });
  const label = CategoryTexts.labels.category.ru;

  return function () {
    QUnit.module('Russian locale shows translated categories');

    opaTest('The list report shows the Russian label and category names', function (Given, When, Then) {
      Given.iStartMyApp('products-display', { 'sap-ui-language': 'ru' });
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheCategoryDropdown.iSeeFilterFieldLabel('category_code', label);
      Then.onTheProductsList.onTable().iCheckColumns(undefined, { category_code: { header: label } });
      Then.onTheProductsList.onTable().iCheckRows({ category_code: names.ELECTRONICS }, 4);
    });

    opaTest('The category dropdown lists Russian names and filters the table', function (Given, When, Then) {
      When.onTheProductsList.onFilterBar().iOpenValueHelp({ property: 'category_code' });
      Then.onTheCategoryDropdown.iSeeItems(allNames);
      When.onTheCategoryDropdown.iSelectItem(names.KITCHEN);
      When.onTheProductsList.onFilterBar().iExecuteSearch();
      Then.onTheCategoryDropdown.iSeeFilterTokens('category_code', [names.KITCHEN]);
      Then.onTheProductsList.onTable().iCheckRows(3);
    });

    opaTest('The object page shows the Russian category name', function (Given, When, Then) {
      When.onTheProductsList.onTable().iPressRow({ name: 'Coffee Maker' });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.onHeader().iCheckTitle('Coffee Maker', names.KITCHEN);
      Then.onTheProductsObjectPage
        .onForm({ section: 'GeneralInfo' })
        .iCheckField({ property: 'category_code' }, names.KITCHEN);
    });

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
