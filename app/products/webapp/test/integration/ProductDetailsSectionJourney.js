/* global QUnit */
// Journey "Details section of a product" (feature products-details-section, PLAN step 7, ADR-0026):
// the Object Page shows the composition Products.details as the table section "Details" with the
// columns Attribute, Value and Unit; in edit mode Create adds an inline row whose Attribute dropdown
// lists only the attributes assigned to the product's subcategory (ValueList on SubcategoryAttributes
// with the navigation-path In parameter product/subcategory_code); choosing an attribute fills the
// Unit cell (Common.SideEffects #AttributeChanged); Save stores the row, and Delete plus Save restores
// the seeded rows. Wireless Mouse (MICE: Connectivity and Sensor Resolution seeded, Battery Life free)
// is restored to its two seeded rows and no draft is left, so the journeys after this one see seeded
// data.
// Ids measured on the running app (FE 1.153.0, PLAN step 7 probe): table
// ...--fe::table::details::LineItem, column property keys attribute_code, value and attribute/unit,
// section ...--fe::FacetSection::Details; the row created inline is the first row (index 0); Delete
// asks "Delete this object?" in a confirmation dialog; a press
// on the Attribute cell does not open the dropdown, F4 does, and the dropdown is the typeahead table
// ...--FieldValueHelp::ProductDetails::details::attribute_code::Popover::qualifier::::SuggestTable,
// matched by pages/CategoryDropdown.js with the property attribute_code.
// The new row is identified by its typed value before its dropdown is opened: all its cells are empty,
// an empty expected cell value matches every row (sap/fe/test/builder/MdcFieldBuilder, _equalish),
// and iExecuteKeyboardShortcut ignores the row index 0 (it tests vRowValues && vColumn, so 0 is
// falsy and the shortcut goes to the table). iChangeRow accepts the 0-based index.
sap.ui.define(['sap/ui/test/opaQunit', './data/DetailAttributeTexts'], function (opaTest, DetailAttributeTexts) {
  'use strict';

  const names = DetailAttributeTexts.names.en;
  const units = DetailAttributeTexts.units;
  const labels = DetailAttributeTexts.labels;
  const ATTRIBUTE = 'attribute_code';
  const VALUE = 'value';
  const UNIT = 'attribute/unit';
  const details = { property: 'details' };
  const detailsSection = { section: 'Details' };
  const laptopName = 'Laptop Pro 15';
  const mouseName = 'Wireless Mouse';
  // The value typed into the new row of Wireless Mouse (PLAN D7: Battery Life is the free attribute).
  const newValue = '12';

  function namesOf(sSubcategoryCode) {
    return DetailAttributeTexts.bySubcategory[sSubcategoryCode].map(function (sCode) {
      return names[sCode];
    });
  }

  // One detail row as the table shows it: the attribute name (never the code), the value as typed
  // and the unit of the attribute. An attribute without a unit gets no unit entry, because an empty
  // expected cell value matches any cell.
  function row(sCode, sValue) {
    const mRow = {};
    mRow[ATTRIBUTE] = names[sCode];
    mRow[VALUE] = sValue;
    if (units[sCode]) {
      mRow[UNIT] = units[sCode];
    }
    return mRow;
  }

  function newRow() {
    const mRow = {};
    mRow[VALUE] = newValue;
    return mRow;
  }

  function seeRows(Then, aRows) {
    Then.onTheProductsObjectPage.onTable(details).iCheckRows(aRows.length);
    aRows.forEach(function (mRow) {
      Then.onTheProductsObjectPage.onTable(details).iCheckRows(mRow, 1);
    });
  }

  // The two seeded rows of Wireless Mouse (db/data/my.catalog-ProductDetails.csv).
  function seeSeededMouseRows(Then) {
    seeRows(Then, [row('CONNECTIVITY', 'Wireless 2.4 GHz'), row('DPI', '1600')]);
  }

  // Restart instead of the breadcrumb (tests-ui.md fallback): all 15 rows, none with a draft marker.
  function seeSeededListWithoutDraft(Given, Then) {
    Given.iTearDownMyApp();
    Given.iStartMyApp('products-display');
    Then.onTheProductsList.iSeeThisPage();
    Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
  }

  return function () {
    QUnit.module('Details section of a product');

    opaTest('The Object Page shows the Details section with the seeded rows', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      When.onTheProductsList.onTable().iPressRow({ name: laptopName });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.iCheckSection(detailsSection, { title: labels.section.en });
      const mColumns = {};
      mColumns[ATTRIBUTE] = { header: labels.attribute.en };
      mColumns[VALUE] = { header: labels.value.en };
      mColumns[UNIT] = { header: labels.unit.en };
      Then.onTheProductsObjectPage.onTable(details).iCheckColumns(3, mColumns);
      seeRows(Then, [row('SCREEN_SIZE', '15'), row('RAM', '16'), row('STORAGE', '512')]);
    });

    opaTest(
      'In edit mode Create adds a row whose attribute dropdown lists only the attributes of the subcategory',
      function (Given, When, Then) {
        // Back to the List Report by a restart (the page is in display mode, no dialog).
        Given.iTearDownMyApp();
        Given.iStartMyApp('products-display');
        When.onTheProductsList.onTable().iPressRow({ name: mouseName });
        Then.onTheProductsObjectPage.iSeeThisPage();
        seeSeededMouseRows(Then);
        When.onTheProductsObjectPage.onHeader().iExecuteEdit();
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        When.onTheProductsObjectPage.onTable(details).iExecuteCreate();
        // The inline row is added on top of the two seeded rows.
        Then.onTheProductsObjectPage.onTable(details).iCheckRows(3);
        When.onTheProductsObjectPage.onTable(details).iChangeRow(0, newRow());
        When.onTheProductsObjectPage.onTable(details).iExecuteKeyboardShortcut('F4', newRow(), ATTRIBUTE);
        // Names only, and only the three attributes of MICE (not all 20): the In parameter
        // product/subcategory_code is read late from the draft row.
        Then.onTheCategoryDropdown.iSeeItems(namesOf('MICE'), ATTRIBUTE);
      }
    );

    opaTest('Choosing an attribute shows its unit and Save stores the row', function (Given, When, Then) {
      When.onTheCategoryDropdown.iSelectItem(names.BATTERY_LIFE, ATTRIBUTE);
      // Polls until the #AttributeChanged read has brought the name and the unit of the attribute.
      Then.onTheProductsObjectPage.onTable(details).iCheckRows(row('BATTERY_LIFE', newValue), 1);
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      seeRows(Then, [
        row('CONNECTIVITY', 'Wireless 2.4 GHz'),
        row('DPI', '1600'),
        row('BATTERY_LIFE', newValue),
      ]);
    });

    opaTest('Deleting the added row restores the seeded state', function (Given, When, Then) {
      When.onTheProductsObjectPage.onHeader().iExecuteEdit();
      Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
      When.onTheProductsObjectPage.onTable(details).iSelectRows(row('BATTERY_LIFE', newValue));
      When.onTheProductsObjectPage.onTable(details).iExecuteDelete();
      // Framework confirmation "Delete this object?": Delete is its first footer button.
      When.onTheProductsObjectPage.onConfirmationDialog().iConfirm();
      seeSeededMouseRows(Then);
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      seeSeededMouseRows(Then);
      seeSeededListWithoutDraft(Given, Then);
    });

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
