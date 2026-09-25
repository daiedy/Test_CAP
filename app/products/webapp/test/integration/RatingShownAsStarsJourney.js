/* global QUnit */
// Journey "rating shown as stars" (products-rating-column, PLAN step 4): the List Report has a fifth
// column Rating whose cell is a sap.m.RatingIndicator, and General Information on the object page
// shows the same stars in display mode. Cells and fields are asserted by control state (value,
// maxValue): a RatingIndicator has no text, so iCheckRows by value cannot match it.
sap.ui.define(['sap/ui/test/opaQunit', './data/RatingTexts'], function (opaTest, RatingTexts) {
  'use strict';

  const column = {};
  column[RatingTexts.columnKey] = { header: RatingTexts.labels.en };
  const cell = {};
  // The "editor" cell state unwraps the Fiori Elements field wrappers down to the main control
  // (sap/fe/test/builder/MdcTableBuilder Cell.Matchers, MacroFieldBuilder), here the RatingIndicator.
  cell[RatingTexts.columnKey] = {
    editor: {
      controlType: 'sap.m.RatingIndicator',
      value: RatingTexts.seeded.rating,
      maxValue: RatingTexts.maxValue,
    },
  };

  return function () {
    QUnit.module('Rating shown as stars');

    opaTest('The list report shows the rating column as stars', function (Given, When, Then) {
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckColumns(5, column);
      Then.onTheProductsList.onTable().iCheckCells({ name: RatingTexts.seeded.name }, cell);
    });

    opaTest(
      'The object page shows the rating in General Information',
      function (Given, When, Then) {
        When.onTheProductsList.onTable().iPressRow({ name: RatingTexts.seeded.name });
        Then.onTheProductsObjectPage.iSeeThisPage();
        Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
        Then.onTheProductsObjectPage
          .onForm({ section: 'GeneralInfo' })
          .iCheckField(RatingTexts.field, undefined, {
            controlType: 'sap.m.RatingIndicator',
            value: RatingTexts.seeded.rating,
            maxValue: RatingTexts.maxValue,
            editable: false,
          });
      }
    );

    opaTest('Teardown', function (Given) {
      Given.iTearDownMyApp();
    });
  };
});
