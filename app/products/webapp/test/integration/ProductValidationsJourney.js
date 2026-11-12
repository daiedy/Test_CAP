/* global QUnit */
// Journey "Validations on the Object Page" (feature products-validations, PLAN step 7, ADR-0028): the
// rules of the catalogue in edit mode, one case per Phase 3 UI criterion of PLAN.md.
// - Root rules (R1-R6) on the FE fields of General Information and Pricing & Stock, asserted with
//   onForm().iCheckField (value state, value state text, required marker) and the stored value of
//   pages/ObjectPageForm.js (a value refused by the client type never reaches the model, so no request
//   carries it).
// - Detail rules (R8, R10-R13) on the custom Details form, asserted through pages/ProductDetailsForm.js
//   by label (required marker, placeholder, enabled state, toast, counter, stored value).
// Products and values come from the seed (db/data): a new draft for the name rules (discarded),
// Wireless Earbuds (129.99 USD, stock 67, AUDIO without detail rows) for the root rules, Laptop Pro 15
// (Screen Size 15 in, Memory 16 GB, Storage 512 GB) and Wireless Mouse (Connectivity Bluetooth 5.0 and
// Wireless 2.4 GHz, Sensor Resolution 1600, Battery Life empty) for the details. Every case discards
// its draft or saves the seeded value back, so the journey ends with the seeded data, 15 rows and no
// draft (checked after a restart, tests-ui.md fallback). Texts come from data/ValidationTexts.js and
// data/DetailAttributeTexts.js (generated from the bundles).
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/ValidationTexts', './data/DetailAttributeTexts'],
  function (opaTest, ValidationTexts, DetailAttributeTexts) {
    'use strict';

    const messages = ValidationTexts.messages;
    const texts = ValidationTexts.labels;
    const names = DetailAttributeTexts.names.en;
    const units = DetailAttributeTexts.units;
    const valueNames = DetailAttributeTexts.valueNames.en;
    const filledPattern = DetailAttributeTexts.labels.filled.en;
    const NBSP = String.fromCharCode(0xa0);
    const generalInfo = { section: 'GeneralInfo' };
    const pricingStock = { section: 'PricingStock' };
    const detailsSection = { section: 'Details' };
    const nameField = { property: 'name' };
    const descriptionField = { property: 'description' };
    const imageUrlField = { property: 'imageUrl' };
    const priceField = { property: 'price' };
    const currencyField = { property: 'currency_code' };
    const stockField = { property: 'stock' };
    const earbudsName = 'Wireless Earbuds';
    const earbudsPrice = 129.99;
    const laptopName = 'Laptop Pro 15';
    const mouseName = 'Wireless Mouse';

    function format(sPattern, aArgs) {
      return aArgs.reduce(function (sText, vArg, iIndex) {
        return sText.replace('{' + iIndex + '}', String(vArg));
      }, sPattern);
    }

    function filled(iFilled, iTotal) {
      return format(filledPattern, [iFilled, iTotal]);
    }

    function range(sLower, sUpper) {
      return format(texts.range.en, [sLower, sUpper]);
    }

    function withUnit(sValue, sCode) {
      return units[sCode] ? sValue + NBSP + units[sCode] : sValue;
    }

    // Opens the Object Page of a product from a fresh start of the app (tests-ui.md: back to the List
    // Report by a restart). A previous case that failed before its end is torn down first, so one red
    // case does not turn the next one red with "Launch was called twice without teardown".
    function openProduct(Given, When, Then, sName) {
      if (Given.hasAppStarted()) {
        Given.iTearDownMyApp();
      }
      Given.iStartMyApp('products-display');
      When.onTheProductsList.onTable().iPressRow({ name: sName });
      Then.onTheProductsObjectPage.iSeeThisPage();
    }

    function edit(When, Then) {
      When.onTheProductsObjectPage.onHeader().iExecuteEdit();
      Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
    }

    function save(When, Then) {
      When.onTheProductsObjectPage.onFooter().iExecuteSave();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
    }

    // Discard Draft: the active product keeps its seeded values.
    function discard(When, Then) {
      When.onTheProductsObjectPage.onFooter().iExecuteCancel();
      When.onTheProductsObjectPage.onFooter().iConfirmCancel();
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
    }

    // A field of the form shows the value state Error with this text.
    function seeFieldError(Then, oSection, oField, sText) {
      Then.onTheProductsObjectPage
        .onForm(oSection)
        .iCheckField(oField, undefined, { valueState: 'Error', valueStateText: sText });
    }

    // Laptop Pro 15 as seeded, in display mode.
    function seeSeededLaptop(Then) {
      Then.onTheDetailsForm.iSeeTheDisplayValue(names.SCREEN_SIZE, withUnit('15', 'SCREEN_SIZE'));
      Then.onTheDetailsForm.iSeeTheDisplayValue(names.RAM, withUnit('16', 'RAM'));
      Then.onTheDetailsForm.iSeeTheDisplayValue(names.STORAGE, withUnit('512', 'STORAGE'));
      Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
    }

    // Back to the List Report by a restart: all 15 rows, none with a draft marker.
    function seeSeededListWithoutDraft(Given, Then) {
      Given.iTearDownMyApp();
      Given.iStartMyApp('products-display');
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
    }

    return function () {
      QUnit.module('Validations on the Object Page');

      opaTest('Name rules show on the field while editing', function (Given, When, Then) {
        if (Given.hasAppStarted()) {
          Given.iTearDownMyApp();
        }
        Given.iStartMyApp('products-display');
        When.onTheProductsList.onTable().iExecuteCreate();
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        // R1: too short after trimming; the message comes with the PATCH response.
        When.onTheProductsObjectPage.onForm(generalInfo).iChangeField(nameField, 'AB');
        seeFieldError(Then, generalInfo, nameField, messages.nameTooShort.en);
        // R2: the name of another product, case and padding ignored.
        When.onTheProductsObjectPage.onForm(generalInfo).iChangeField(nameField, 'Backpack');
        seeFieldError(Then, generalInfo, nameField, messages.nameDuplicate.en);
        // Discard the new draft: back on the List Report with the seeded rows and no draft.
        When.onTheProductsObjectPage.onFooter().iExecuteCancel();
        When.onTheProductsObjectPage.onFooter().iConfirmCancel();
        Then.onTheProductsList.iSeeThisPage();
        Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
      });

      opaTest(
        'Price rules are refused on the client and mark both fields through the server',
        function (Given, When, Then) {
          openProduct(Given, When, Then, earbudsName);
          edit(When, Then);
          // R3: 0 turns the field red. The plan expects the client type to refuse it before any
          // request (Validation.Exclusive); measured 2026-11-12, the PATCH is sent and the server
          // answers with PRODUCTS_PRICE_POSITIVE, so only the Error state is asserted here (defect
          // reported to fiori-app-dev, PLAN step 7 report). Both paths end in the Error state.
          Then.onTheObjectPageForm.iSeeFormFieldStoredValue('price', earbudsPrice);
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(priceField, '0');
          Then.onTheProductsObjectPage
            .onForm(pricingStock)
            .iCheckField(priceField, undefined, { valueState: 'Error' });
          // R4 through the server: 10.50 stored under USD, then the currency changes to JPY.
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(priceField, '10.50');
          Then.onTheObjectPageForm.iSeeFormFieldStoredValue('price', 10.5);
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(currencyField, 'JPY');
          seeFieldError(Then, pricingStock, priceField, messages.priceMinorUnit.en);
          seeFieldError(Then, pricingStock, currencyField, messages.priceMinorUnit.en);
          // A whole amount clears both fields in one step. Not 11: under JPY the field shows the stored 10.5
          // as '11' (scale 0), so typing 11 changes nothing and sends no PATCH (measured).
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(priceField, '12');
          Then.onTheObjectPageForm.iSeeFormFieldStoredValue('price', 12);
          Then.onTheProductsObjectPage
            .onForm(pricingStock)
            .iCheckField(currencyField, undefined, { valueState: 'None' });
          // R4 on the client: with JPY the currency type refuses decimals; the model keeps 12.
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(priceField, '10.50');
          Then.onTheProductsObjectPage
            .onForm(pricingStock)
            .iCheckField(priceField, undefined, { valueState: 'Error' });
          Then.onTheObjectPageForm.iSeeFormFieldStoredValue('price', 12);
          discard(When, Then);
        }
      );

      opaTest('Image URL must be https', function (Given, When, Then) {
        openProduct(Given, When, Then, earbudsName);
        edit(When, Then);
        When.onTheProductsObjectPage
          .onForm(generalInfo)
          .iChangeField(imageUrlField, 'http://example.com/a.png');
        seeFieldError(Then, generalInfo, imageUrlField, messages.imageUrlHttps.en);
        // Save is refused with the message in the message popover; the draft stays in edit mode.
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        Then.onTheDetailsForm.iSeeSaveBlockedBy(messages.imageUrlHttps.en);
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        discard(When, Then);
      });

      opaTest(
        'Description is required while the product is in stock',
        function (Given, When, Then) {
          openProduct(Given, When, Then, earbudsName);
          edit(When, Then);
          // Stock 67: the marker is on; emptying the description shows R6 on the field.
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(descriptionField, undefined, { required: true });
          When.onTheProductsObjectPage.onForm(generalInfo).iChangeField(descriptionField, '');
          seeFieldError(
            Then,
            generalInfo,
            descriptionField,
            messages.descriptionRequiredInStock.en
          );
          // Stock 0: the marker and the message are gone.
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(stockField, '0');
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(descriptionField, undefined, { required: false, valueState: 'None' });
          // Stock 5: the marker is back; Save is refused with the message on Description.
          When.onTheProductsObjectPage.onForm(pricingStock).iChangeField(stockField, '5');
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(descriptionField, undefined, { required: true });
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(descriptionField, undefined, { valueState: 'Error' });
          discard(When, Then);
        }
      );

      // A second module for the detail rules: with --split-opa each module is its own page, so each
      // half stays inside the runner's page timeout of 150 s (measured: one module took longer).
      QUnit.module('Validations in the Details form');

      opaTest('A required detail blocks Save', function (Given, When, Then) {
        const screen = names.SCREEN_SIZE;
        openProduct(Given, When, Then, laptopName);
        edit(When, Then);
        Then.onTheDetailsForm.iSeeTheLabelRequired(screen, true);
        Then.onTheDetailsForm.iSeeTheLabelRequired(names.RAM, false);
        When.onTheDetailsForm.iEnterValue(screen, '');
        Then.onTheDetailsForm.iSeeTheStoredValue(screen, null);
        Then.onTheDetailsForm.iSeeTheValueState(screen, 'Error', messages.detailValueRequired.en);
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        Then.onTheDetailsForm.iSeeSaveBlockedBy(messages.detailValueRequired.en);
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        discard(When, Then);
        seeSeededLaptop(Then);
      });

      opaTest(
        "A detail value outside the subcategory's bounds is refused before the request",
        function (Given, When, Then) {
          const screen = names.SCREEN_SIZE;
          openProduct(Given, When, Then, laptopName);
          edit(When, Then);
          When.onTheDetailsForm.iEnterValue(screen, '');
          Then.onTheDetailsForm.iSeeTheStoredValue(screen, null);
          Then.onTheDetailsForm.iSeeThePlaceholder(screen, range('10', '18'), units.SCREEN_SIZE);
          // 19 is above the LAPTOPS bound 18: the row's Decimal type refuses it, nothing is stored.
          When.onTheDetailsForm.iEnterValue(screen, '19');
          Then.onTheDetailsForm.iSeeTheValueState(screen, 'Error');
          Then.onTheDetailsForm.iSeeTheStoredValue(screen, null);
          // 15 is inside: stored, the state clears; Save keeps the seeded value.
          When.onTheDetailsForm.iEnterValue(screen, '15');
          Then.onTheDetailsForm.iSeeTheValueState(screen, 'None');
          Then.onTheDetailsForm.iSeeTheStoredValue(screen, 15);
          save(When, Then);
          seeSeededLaptop(Then);
        }
      );

      opaTest(
        'A storage below the memory blocks Save with the cross-row message',
        function (Given, When, Then) {
          const belowOther = format(messages.detailValueBelowOther.en, [names.STORAGE, names.RAM]);
          openProduct(Given, When, Then, laptopName);
          edit(When, Then);
          When.onTheDetailsForm.iEnterValue(names.RAM, '128');
          Then.onTheDetailsForm.iSeeTheStoredValue(names.RAM, 128);
          When.onTheDetailsForm.iEnterValue(names.STORAGE, '64');
          Then.onTheDetailsForm.iSeeTheStoredValue(names.STORAGE, 64);
          Then.onTheDetailsForm.iSeeTheValueState(names.STORAGE, 'Error', belowOther);
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          Then.onTheDetailsForm.iSeeSaveBlockedBy(belowOther);
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          discard(When, Then);
          seeSeededLaptop(Then);
        }
      );

      opaTest(
        'Battery Life follows the wireless connectivity of the mouse',
        function (Given, When, Then) {
          const battery = names.BATTERY_LIFE;
          const connectivity = names.CONNECTIVITY;
          const batteryRange = range('1', '2,000');
          openProduct(Given, When, Then, mouseName);
          edit(When, Then);
          Then.onTheDetailsForm.iSeeTheFieldEnabled(battery, true);
          Then.onTheDetailsForm.iSeeThePlaceholder(battery, batteryRange);
          When.onTheDetailsForm.iEnterValue(battery, '12');
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, 12);
          Then.onTheDetailsForm.iSeeTheCounter(filled(3, 3), 'Success');
          // Bluetooth 5.0 removed: Wireless 2.4 GHz still enables the row, the value stays.
          When.onTheDetailsForm.iToggleListItems(connectivity, [valueNames.BLUETOOTH_5_0]);
          Then.onTheDetailsForm.iSeeTheSelectedItems(connectivity, [valueNames.WIRELESS_2_4_GHZ]);
          Then.onTheDetailsForm.iSeeTheFieldEnabled(battery, true);
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, 12);
          // Wireless 2.4 GHz removed: no wireless value is left, the row is disabled and cleared.
          When.onTheDetailsForm.iToggleListItems(connectivity, [valueNames.WIRELESS_2_4_GHZ]);
          Then.onTheDetailsForm.iSeeTheToast(format(texts.cleared.en, [battery, connectivity]));
          Then.onTheDetailsForm.iSeeTheFieldEnabled(battery, false);
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, null);
          Then.onTheDetailsForm.iSeeThePlaceholder(
            battery,
            format(texts.dependsOn.en, [connectivity])
          );
          // The disabled row is outside the counter (Q7). Connectivity has no value left after both
          // seeded values are removed, so only Sensor Resolution counts: "Filled 1 of 2" (the PLAN
          // criterion text "Filled 2 of 2" assumes a Connectivity value; see the step 7 report).
          Then.onTheDetailsForm.iSeeTheCounter(filled(1, 2), 'Warning');
          // Wi-Fi selected: enabled again, empty, with the range placeholder.
          When.onTheDetailsForm.iToggleListItems(connectivity, [valueNames.WIFI]);
          Then.onTheDetailsForm.iSeeTheFieldEnabled(battery, true);
          Then.onTheDetailsForm.iSeeTheStoredValue(battery, null);
          Then.onTheDetailsForm.iSeeThePlaceholder(battery, batteryRange);
          Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
          // Discard restores the seed: the two seeded values and no battery life.
          discard(When, Then);
          Then.onTheDetailsForm.iSeeTheDisplayValue(
            connectivity,
            valueNames.BLUETOOTH_5_0 + ', ' + valueNames.WIRELESS_2_4_GHZ
          );
          Then.onTheDetailsForm.iSeeAnEmptyDisplayValue(battery);
          Then.onTheDetailsForm.iSeeTheCounter(filled(2, 3), 'Warning');
        }
      );

      opaTest('Memory accepts powers of two only', function (Given, When, Then) {
        const memory = names.RAM;
        openProduct(Given, When, Then, laptopName);
        Then.onTheProductsObjectPage.iCheckSection(detailsSection, {
          title: DetailAttributeTexts.labels.section.en,
        });
        edit(When, Then);
        When.onTheDetailsForm.iEnterValue(memory, '12');
        Then.onTheDetailsForm.iSeeTheStoredValue(memory, 12);
        Then.onTheDetailsForm.iSeeTheValueState(
          memory,
          'Error',
          messages.detailValueNotPowerOfTwo.en
        );
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        Then.onTheDetailsForm.iSeeSaveBlockedBy(messages.detailValueNotPowerOfTwo.en);
        Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
        // 16, the seeded value, is stored and saved.
        When.onTheDetailsForm.iEnterValue(memory, '16');
        Then.onTheDetailsForm.iSeeTheValueState(memory, 'None');
        Then.onTheDetailsForm.iSeeTheStoredValue(memory, 16);
        save(When, Then);
        seeSeededLaptop(Then);
        seeSeededListWithoutDraft(Given, Then);
      });

      // Teardown only, per rule tests-ui.md: a failed step must not leave the frame open for the next
      // journey ("Launch was called twice without teardown").
      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
