/* global QUnit */
// Journey "russian locale shows translated categories" (PLAN step 13): started with
// sap-ui-language=ru, the filter labels (Category, Rating), the column headers (Category, Rating), the dropdown items,
// the table cells and the object page show the Russian texts of _i18n and Categories.texts.
// products-excel-upload (PLAN step 9): the Import from Excel toolbar button and its action parameter
// dialog (title, file label, OK button) show the ru texts of _i18n; Cancel is a framework text and
// is not asserted.
// products-subcategories (PLAN step 10): the Subcategory column header and, on the object page, the
// Subcategory label and the localized name of Coffee Maker's subcategory (APPLIANCES) are Russian.
// products-details-section (plan revision 2, PLAN step 9): the Details form of Coffee Maker shows the
// Russian section title, counter and field labels and the ru decimal comma (the unit stays Latin);
// Wireless Mouse shows its Connectivity values with their Russian names (pages/ProductDetailsForm.js).
sap.ui.define(['sap/ui/test/opaQunit', './data/CategoryTexts', './data/RatingTexts', './data/ImportTexts', './data/SubcategoryTexts', './data/DetailAttributeTexts'], function (
  opaTest,
  CategoryTexts,
  RatingTexts,
  ImportTexts,
  SubcategoryTexts,
  DetailAttributeTexts
) {
  'use strict';

  const names = CategoryTexts.names.ru;
  const allNames = Object.keys(names).map(function (sCode) {
    return names[sCode];
  });
  const label = CategoryTexts.labels.category.ru;
  const ratingColumn = {};
  ratingColumn[RatingTexts.columnKey] = { header: RatingTexts.labels.ru };
  const subcategoryLabel = SubcategoryTexts.labels.subcategory.ru;

  return function () {
    QUnit.module('Russian locale shows translated categories');

    opaTest('The list report shows the Russian label and category names', function (Given, When, Then) {
      Given.iStartMyApp('products-display', { 'sap-ui-language': 'ru' });
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheCategoryDropdown.iSeeFilterFieldLabel('category_code', label);
      Then.onTheRatingRangeSlider.iSeeFilterLabel(RatingTexts.labels.ru);
      Then.onTheProductsList.onTable().iCheckColumns(undefined, { category_code: { header: label } });
      Then.onTheProductsList.onTable().iCheckColumns(undefined, ratingColumn);
      Then.onTheProductsList
        .onTable()
        .iCheckColumns(undefined, { subcategory_code: { header: subcategoryLabel } });
      Then.onTheProductsList.onTable().iCheckRows({ category_code: names.ELECTRONICS }, 4);
    });

    opaTest('The import action and its dialog show Russian texts', function (Given, When, Then) {
      const importLabel = ImportTexts.labels.action.ru;
      Then.onTheProductsList
        .onTable()
        .iCheckAction(ImportTexts.action, { visible: true, enabled: true, text: importLabel });
      When.onTheProductsList.onTable().iExecuteAction(ImportTexts.action);
      Then.onTheImportDialog.iSeeTheDialog(importLabel);
      Then.onTheImportDialog.iSeeTheFileField(ImportTexts.labels.file.ru);
      Then.onTheImportDialog.iSeeTheButtons(importLabel);
      When.onTheImportDialog.iPressCancel();
      Then.onTheImportDialog.iSeeTheDialogClosed();
    });

    opaTest('The category dropdown lists Russian names and filters the table', function (Given, When, Then) {
      When.onTheProductsList.onFilterBar().iOpenValueHelp({ property: 'category_code' });
      Then.onTheCategoryDropdown.iSeeItems(allNames);
      When.onTheCategoryDropdown.iSelectItem(names.KITCHEN);
      // liveMode (no Go button): the filter bar reloads the table on the change; iCheckRows polls until the new count.
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

    opaTest('The Object Page shows the subcategory in Russian', function (Given, When, Then) {
      // Still on the object page of Coffee Maker (KITCHEN / APPLIANCES) from the previous case.
      Then.onTheObjectPageForm.iSeeFormFieldLabel('subcategory_code', subcategoryLabel);
      Then.onTheProductsObjectPage
        .onForm({ section: 'GeneralInfo' })
        .iCheckField({ property: 'subcategory_code' }, SubcategoryTexts.names.ru.APPLIANCES);
    });

    opaTest('The Object Page shows the Details section in Russian', function (Given, When, Then) {
      // Still on the object page of Coffee Maker (APPLIANCES: Power 900 W, Capacity 1.2 l, Colour
      // empty in the seed).
      const detailLabels = DetailAttributeTexts.labels;
      const detailNames = DetailAttributeTexts.names.ru;
      const valueNames = DetailAttributeTexts.valueNames.ru;
      const nbsp = String.fromCharCode(0xa0);
      Then.onTheProductsObjectPage.iCheckSection({ section: 'Details' }, { title: detailLabels.section.ru });
      Then.onTheDetailsForm.iSeeTheCounter(
        detailLabels.filled.ru.replace('{0}', '2').replace('{1}', '3'),
        'Warning'
      );
      Then.onTheDetailsForm.iSeeTheFieldLabels(
        DetailAttributeTexts.bySubcategory.APPLIANCES.map(function (sCode) {
          return detailNames[sCode];
        })
      );
      // The ru decimal comma; the unit stays Latin, joined by a no-break space.
      Then.onTheDetailsForm.iSeeTheDisplayValue(
        detailNames.CAPACITY,
        '1,2' + nbsp + DetailAttributeTexts.units.CAPACITY
      );
      // A list value in Russian: the Connectivity of Wireless Mouse, joined in the list order.
      Given.iTearDownMyApp();
      Given.iStartMyApp('products-display', { 'sap-ui-language': 'ru' });
      When.onTheProductsList.onTable().iPressRow({ name: 'Wireless Mouse' });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheDetailsForm.iSeeTheDisplayValue(
        detailNames.CONNECTIVITY,
        valueNames.BLUETOOTH_5_0 + ', ' + valueNames.WIRELESS_2_4_GHZ
      );
    });

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
