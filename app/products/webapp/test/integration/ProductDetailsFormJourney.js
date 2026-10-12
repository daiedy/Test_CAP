/* global QUnit */
// Journey "Details form of a product" (feature products-details-section, plan revision 2, PLAN step 9,
// ADR-0027 decision 5): the custom section "Details" of the Object Page is a form generated from the
// subcategory by ext/fragment/DetailsForm: one labelled field per detail row in the position order of
// the subcategory, the value with its unit in display mode, a typed control in edit mode (Input with
// the per-row Decimal type, ComboBox for a single list value, MultiComboBox for several) and the
// counter "Filled N of M". sap.fe.test has no API for the content of a custom section; the fields are
// asserted through pages/ProductDetailsForm.js by label and binding path.
// The products and the values come from the seed (db/data): Laptop Pro 15 (Laptops, all three
// filled), Wireless Mouse (Mice: Connectivity Bluetooth 5.0 and Wireless 2.4 GHz, Sensor Resolution
// 1600, Battery Life empty), Bluetooth Speaker (Audio: Colour empty). Every case that saves a change
// saves the seeded value back, and every draft is saved or discarded inside its case, so the journey
// ends with the seeded data, 15 rows and no draft (checked after a restart, tests-ui.md fallback).
// The role half of "display only" (a CatalogViewer never reaches edit mode, ADR-0013) cannot be run
// here: the whole OPA suite authenticates as alice (ui5-test-runner.json); it is a ui-verifier
// criterion. This journey asserts the fragment half: in display mode the section renders no edit
// control.
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/DetailAttributeTexts', './data/SubcategoryTexts'],
  function (opaTest, DetailAttributeTexts, SubcategoryTexts) {
    'use strict';

    const names = DetailAttributeTexts.names.en;
    const units = DetailAttributeTexts.units;
    const valueNames = DetailAttributeTexts.valueNames.en;
    const labels = DetailAttributeTexts.labels;
    const NBSP = String.fromCharCode(0xa0);
    const generalInfo = { section: 'GeneralInfo' };
    const detailsSection = { section: 'Details' };
    const SUBCATEGORY = 'subcategory_code';
    const subcategoryField = { property: SUBCATEGORY };
    const laptopName = 'Laptop Pro 15';
    const mouseName = 'Wireless Mouse';
    const speakerName = 'Bluetooth Speaker';
    // The two seeded selections of Wireless Mouse's Connectivity (my.catalog-ProductDetailSelections.csv).
    const seededConnectivity = ['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ'];

    function format(sPattern, aArgs) {
      return aArgs.reduce(function (sText, vArg, iIndex) {
        return sText.replace('{' + iIndex + '}', String(vArg));
      }, sPattern);
    }

    function filled(iFilled, iTotal) {
      return format(labels.filled.en, [iFilled, iTotal]);
    }

    // The display text of a number: the formatted value and the unit, joined by a no-break space.
    function withUnit(sValue, sCode) {
      return units[sCode] ? sValue + NBSP + units[sCode] : sValue;
    }

    function labelsOf(sSubcategoryCode) {
      return DetailAttributeTexts.bySubcategory[sSubcategoryCode].map(function (sCode) {
        return names[sCode];
      });
    }

    // The names of the given value codes in the list order of the attribute, joined like the display.
    function joinedNames(sAttributeCode, aCodes) {
      return DetailAttributeTexts.valuesByAttribute[sAttributeCode]
        .filter(function (sCode) {
          return aCodes.indexOf(sCode) >= 0;
        })
        .map(function (sCode) {
          return valueNames[sCode];
        })
        .join(', ');
    }

    function namesOf(aCodes) {
      return aCodes.map(function (sCode) {
        return valueNames[sCode];
      });
    }

    // Opens the Object Page of a product from a fresh start of the app (tests-ui.md: back to the
    // List Report by a restart). The previous case ends with the app running, or failed before its
    // end; either way it is torn down first, so one red case does not turn the next one red with
    // "Launch was called twice without teardown". Evaluated when the case starts, after the queue of
    // the previous case has run.
    function openProduct(Given, When, Then, sName) {
      if (Given.hasAppStarted()) {
        Given.iTearDownMyApp();
      }
      Given.iStartMyApp('products-display');
      When.onTheProductsList.onTable().iPressRow({ name: sName });
      Then.onTheProductsObjectPage.iSeeThisPage();
      Then.onTheProductsObjectPage.iCheckSection(detailsSection, { title: labels.section.en });
    }

    function edit(When, Then) {
      When.onTheProductsObjectPage.onHeader().iExecuteEdit();
      Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
    }

    function save(When, Then) {
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
    }

    // Wireless Mouse as seeded, in display mode.
    function seeSeededMouse(Then) {
      Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
      Then.onTheDetailsForm.iSeeTheFieldLabels(labelsOf('MICE'));
      Then.onTheDetailsForm.iSeeTheDisplayValue(
        names.CONNECTIVITY,
        joinedNames('CONNECTIVITY', seededConnectivity)
      );
      Then.onTheDetailsForm.iSeeTheDisplayValue(names.DPI, withUnit('1,600', 'DPI'));
      Then.onTheDetailsForm.iSeeAnEmptyDisplayValue(names.BATTERY_LIFE);
    }

    // Back to the List Report by a restart (tests-ui.md fallback; the page is in display mode and
    // every change is saved or discarded, so no dialog): all 15 rows, none with a draft marker.
    function seeSeededListWithoutDraft(Given, Then) {
      Given.iTearDownMyApp();
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
    }

    return function () {
      QUnit.module('Details form of a product');

      opaTest('The Object Page shows the details as form fields', function (Given, When, Then) {
        openProduct(Given, When, Then, laptopName);
        Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
        Then.onTheDetailsForm.iSeeTheFieldLabels(labelsOf('LAPTOPS'));
        Then.onTheDetailsForm.iSeeTheDisplayValue(names.SCREEN_SIZE, withUnit('15', 'SCREEN_SIZE'));
        Then.onTheDetailsForm.iSeeTheDisplayValue(names.RAM, withUnit('16', 'RAM'));
        Then.onTheDetailsForm.iSeeTheDisplayValue(names.STORAGE, withUnit('512', 'STORAGE'));
        labelsOf('LAPTOPS').forEach(function (sLabel) {
          Then.onTheDetailsForm.iSeeTheLabelAboveTheValue(sLabel);
        });
        Then.onTheDetailsForm.iSeeNoEditControls();
        Then.onTheDetailsForm.iSeeNoDetailsTable();
      });

      opaTest(
        'Empty values and multi-value lists are shown in display mode',
        function (Given, When, Then) {
          openProduct(Given, When, Then, mouseName);
          // Connectivity joins the names in the list order of the attribute, not the selection order.
          seeSeededMouse(Then);
          Then.onTheDetailsForm.iSeeNoEditControls();
        }
      );

      opaTest(
        'Typed inputs validate on the client and Save stores the value',
        function (Given, When, Then) {
          // Still on Wireless Mouse in display mode. Battery Life is INTEGER, 1 to 10000 hours.
          const battery = names.BATTERY_LIFE;
          edit(When, Then);
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, null);
          // Not a number, a fraction of a whole number, above the maximum: the Decimal type of the
          // row rejects each on commit; the model keeps no value, so no PATCH can carry one.
          ['abc', '12.5', '20000'].forEach(function (sTyped) {
            When.onTheDetailsForm.iEnterValue(battery, sTyped);
            Then.onTheDetailsForm.iSeeTheValueState(battery, 'Error');
            Then.onTheDetailsForm.iSeeTheStoredValue(battery, null);
          });
          When.onTheDetailsForm.iEnterValue(battery, '12');
          Then.onTheDetailsForm.iSeeTheValueState(battery, 'None');
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, 12);
          Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
          save(When, Then);
          Then.onTheDetailsForm.iSeeTheDisplayValue(battery, withUnit('12', 'BATTERY_LIFE'));
          Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
          // Restore the seed: Battery Life empty again.
          edit(When, Then);
          When.onTheDetailsForm.iEnterValue(battery, '');
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, null);
          Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
          save(When, Then);
          seeSeededMouse(Then);
        }
      );

      opaTest('A list field accepts only its values', function (Given, When, Then) {
        const colour = names.COLOUR;
        const notInList = labels.valueNotInList.en;
        openProduct(Given, When, Then, speakerName);
        Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
        edit(When, Then);
        Then.onTheDetailsForm.iSeeTheListItems(
          colour,
          namesOf(DetailAttributeTexts.valuesByAttribute.COLOUR)
        );
        Then.onTheDetailsForm.iSeeTheStoredValue(colour, null);
        // A text that is no item of the list: Error on the field, the stored value stays.
        When.onTheDetailsForm.iEnterValue(colour, 'Purple');
        Then.onTheDetailsForm.iSeeTheValueState(colour, 'Error', notInList);
        Then.onTheDetailsForm.iSeeTheStoredValue(colour, null);
        // Save is refused on the client with the error in the message popover; the draft stays.
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        Then.onTheDetailsForm.iSeeSaveBlockedBy(notInList);
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        Then.onTheDetailsForm.iSeeTheStoredValue(colour, null);
        // An item of the list clears the error and is stored by its code.
        When.onTheDetailsForm.iEnterValue(colour, valueNames.BLACK);
        Then.onTheDetailsForm.iSeeTheValueState(colour, 'None');
        Then.onTheDetailsForm.iSeeTheStoredValue(colour, 'BLACK');
        Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
        save(When, Then);
        Then.onTheDetailsForm.iSeeTheDisplayValue(colour, valueNames.BLACK);
        Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
        // Restore the seed: Colour empty again.
        edit(When, Then);
        When.onTheDetailsForm.iEnterValue(colour, '');
        Then.onTheDetailsForm.iSeeTheStoredValue(colour, null);
        save(When, Then);
        Then.onTheDetailsForm.iSeeAnEmptyDisplayValue(colour);
        Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
      });

      opaTest('A multi-value field adds and removes values', function (Given, When, Then) {
        const connectivity = names.CONNECTIVITY;
        const withBluetooth53 = seededConnectivity.concat(['BLUETOOTH_5_3']);
        openProduct(Given, When, Then, mouseName);
        edit(When, Then);
        Then.onTheDetailsForm.iSeeTheSelectedItems(connectivity, namesOf(seededConnectivity));
        Then.onTheDetailsForm.iSeeTheStoredValue(connectivity, seededConnectivity);
        // Typing the name of an item and Enter adds it as a token; the fragment creates the selection.
        When.onTheDetailsForm.iEnterValue(connectivity, valueNames.BLUETOOTH_5_3);
        Then.onTheDetailsForm.iSeeTheSelectedItems(connectivity, namesOf(withBluetooth53));
        Then.onTheDetailsForm.iSeeTheStoredValue(connectivity, withBluetooth53);
        Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
        save(When, Then);
        Then.onTheDetailsForm.iSeeTheDisplayValue(
          connectivity,
          joinedNames('CONNECTIVITY', withBluetooth53)
        );
        Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
        // Unchecking it in the list removes the selection again: the seeded two are back.
        edit(When, Then);
        When.onTheDetailsForm.iToggleListItems(connectivity, [valueNames.BLUETOOTH_5_3]);
        Then.onTheDetailsForm.iSeeTheSelectedItems(connectivity, namesOf(seededConnectivity));
        Then.onTheDetailsForm.iSeeTheStoredValue(connectivity, seededConnectivity);
        save(When, Then);
        seeSeededMouse(Then);
      });

      opaTest(
        'A subcategory change replaces the fields and keeps common values',
        function (Given, When, Then) {
          const warning = format(DetailAttributeTexts.messages.valuesRemoved.en, [1, names.DPI]);
          openProduct(Given, When, Then, mouseName);
          edit(When, Then);
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
          When.onTheCategoryDropdown.iSelectItem(SubcategoryTexts.names.en.AUDIO, SUBCATEGORY);
          // U3: the filled Sensor Resolution is removed, so the server warns on the Subcategory field.
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, SubcategoryTexts.names.en.AUDIO, {
              valueState: 'Warning',
              valueStateText: warning,
            });
          // The fields of Audio in their order; Connectivity and Battery Life are kept rows.
          Then.onTheDetailsForm.iSeeTheFieldLabels(labelsOf('AUDIO'));
          Then.onTheDetailsForm.iSeeTheSelectedItems(
            names.CONNECTIVITY,
            namesOf(seededConnectivity)
          );
          Then.onTheDetailsForm.iSeeTheStoredValue(names.CONNECTIVITY, seededConnectivity);
          Then.onTheDetailsForm.iSeeTheStoredValue(names.BATTERY_LIFE, null);
          Then.onTheDetailsForm.iSeeTheStoredValue(names.COLOUR, null);
          Then.onTheDetailsForm.iSeeTheCounter(filled(1, 3), 'Warning');
          // Discard Draft restores the seeded Mice fields with their values.
          When.onTheProductsObjectPage.onFooter().iExecuteCancel();
          When.onTheProductsObjectPage.onFooter().iConfirmCancel();
          Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
          seeSeededMouse(Then);
          seeSeededListWithoutDraft(Given, Then);
        }
      );

      // Teardown only, per rule tests-ui.md: a failed step must not leave the frame open for the next
      // journey ("Launch was called twice without teardown").
      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
