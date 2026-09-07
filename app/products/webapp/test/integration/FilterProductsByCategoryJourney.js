/* global QUnit */
// Journey "filter products by category" (PLAN step 13): the Category filter is a dropdown of
// localized names, a selected value filters the table and two values combine with OR.
// The last test tears the app down; it runs even when an earlier test failed
// (sap.fe.test iTearDownMyApp asserts "Tearing down my app").
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts'], function (opaTest, CategoryTexts) {
  'use strict';

  const names = CategoryTexts.names.en;
  const allNames = Object.keys(names).map(function (sCode) {
    return names[sCode];
  });

  return function () {
    QUnit.module('Filter products by category');

    opaTest('The list report starts with all 15 products', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheCategoryDropdown.iSeeFilterFieldLabel('category_code', CategoryTexts.labels.category.en);
      Then.onTheProductsList.onTable().iCheckRows(15);
    });

    opaTest('The category filter is a dropdown of names and filters by one category', function (
      Given,
      When,
      Then
    ) {
      When.onTheProductsList.onFilterBar().iOpenValueHelp({ property: 'category_code' });
      Then.onTheCategoryDropdown.iSeeItems(allNames);
      When.onTheCategoryDropdown.iSelectItem(names.KITCHEN);
      When.onTheProductsList.onFilterBar().iExecuteSearch();
      Then.onTheProductsList.onFilterBar().iCheckFilterField({ property: 'category_code' }, 'KITCHEN');
      Then.onTheCategoryDropdown.iSeeFilterTokens('category_code', [names.KITCHEN]);
      Then.onTheProductsList.onTable().iCheckRows(3);
      Then.onTheProductsList.onTable().iCheckRows({ category_code: names.KITCHEN }, 3);
    });

    opaTest('Two selected categories widen the result', function (Given, When, Then) {
      When.onTheProductsList.onFilterBar().iChangeFilterField({ property: 'category_code' }, names.SPORTS);
      When.onTheProductsList.onFilterBar().iExecuteSearch();
      Then.onTheProductsList.onFilterBar().iCheckFilterField({ property: 'category_code' }, [
        'KITCHEN',
        'SPORTS',
      ]);
      Then.onTheCategoryDropdown.iSeeFilterTokens('category_code', [names.KITCHEN, names.SPORTS]);
      Then.onTheProductsList.onTable().iCheckRows(4);
    });

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
