/* global QUnit */
// Journey "category is shown as a name" (PLAN step 13): the table column, the object page header
// description and the General Information field show the category name, never the code.
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts'], function (opaTest, CategoryTexts) {
  'use strict';

  const names = CategoryTexts.names.en;

  return function () {
    QUnit.module('Category is shown as a name');

    opaTest('The Category column of the list report shows names', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList
        .onTable()
        .iCheckColumns(undefined, { category_code: { header: CategoryTexts.labels.category.en } });
      Then.onTheProductsList.onTable().iCheckRows({ category_code: names.ELECTRONICS }, 4);
      Then.onTheProductsList.onTable().iCheckRows({ name: 'Laptop Pro 15', category_code: names.ELECTRONICS }, 1);
    });

    opaTest('The object page shows the name in the header and in General Information', function (
      Given,
      When,
      Then
    ) {
      When.onTheProductsList.onTable().iPressRow({ name: 'Laptop Pro 15' });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.onHeader().iCheckTitle('Laptop Pro 15', names.ELECTRONICS);
      Then.onTheProductsObjectPage
        .onForm({ section: 'GeneralInfo' })
        .iCheckField({ property: 'category_code' }, names.ELECTRONICS);
    });

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
