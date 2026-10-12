/* global QUnit */
// Unit tests of the pure functions of the custom section "Details" (ADR-0027,
// webapp/ext/fragment/DetailsForm.js): the filled rules and the counter, the display texts
// (unit join, list names, list order), the write rules of the list fields (B6, B7), the draft
// check (B2) and the Decimal type settings (PLAN D19). The fragment wiring (form elements,
// bindings, messages) is covered end to end by ProductDetailsFormJourney.
sap.ui.define(
  [
    'products/ext/fragment/DetailsForm',
    'sap/ui/model/odata/type/Decimal',
    'sap/ui/model/ParseException',
    'sap/ui/model/ValidateException',
    'sap/ui/core/library',
  ],
  function (DetailsForm, Decimal, ParseException, ValidateException, coreLibrary) {
    'use strict';

    /** No-break space between a value and its unit (SCREENS "Fields per value type"). */
    const NBSP = String.fromCharCode(0xa0);

    /** Value states of the counter badge (SCREENS "Title, counter, layout"). */
    const ValueState = coreLibrary.ValueState;
    /** Counter icon when every field is filled. */
    const ICON_COMPLETE = 'sap-icon://sys-enter-2';
    /** Counter icon while a field is empty, zero filled included. */
    const ICON_INCOMPLETE = 'sap-icon://alert';

    /** Allowed values of CONNECTIVITY in their list order (db/data DetailListValues, position). */
    const CONNECTIVITY = [
      { code: 'BLUETOOTH_5_0', name: 'Bluetooth 5.0' },
      { code: 'BLUETOOTH_5_3', name: 'Bluetooth 5.3' },
      { code: 'WIRELESS_2_4_GHZ', name: 'Wireless 2.4 GHz' },
      { code: 'WIFI', name: 'Wi-Fi' },
    ];

    /** Seeded attributes (db/data DetailAttributes) as the OData model reads them. */
    const SCREEN_SIZE = {
      valueType_code: 'DECIMAL',
      scale: 1,
      minValue: '1',
      maxValue: '100',
    };
    const CAPACITY = { valueType_code: 'DECIMAL', scale: 2, minValue: '0.01', maxValue: '100' };
    const RAM = { valueType_code: 'INTEGER', scale: null, minValue: '1', maxValue: '1024' };
    const SENSOR = { valueType_code: 'INTEGER', scale: null, minValue: '100', maxValue: '50000' };

    /**
     * Detail row of one value type.
     *
     * @param {string} type value type code of the row's attribute
     * @param {object} [values] value fields of the row
     * @returns {object} the row as the section binding reads it
     */
    function row(type, values) {
      return Object.assign({ attribute: { valueType_code: type } }, values);
    }

    /**
     * The per-row Decimal type the fragment builds from the settings.
     *
     * @param {object} attribute the row's attribute
     * @returns {sap.ui.model.odata.type.Decimal} the type
     */
    function createType(attribute) {
      const settings = DetailsForm.numberTypeSettings(attribute);
      return new Decimal(settings.formatOptions, settings.constraints);
    }

    const hooks = {
      beforeEach: function () {
        this.form = DetailsForm;
      },
      afterEach: function () {
        this.form = null;
      },
    };

    QUnit.module('DetailsForm: filled rules and counter', hooks);

    QUnit.test('isFilled counts a TEXT row only with text left after trimming', function (assert) {
      const isFilled = this.form.isFilled;
      assert.strictEqual(
        isFilled(row('TEXT', { textValue: '30 x 20 x 10' })),
        true,
        'a text is filled'
      );
      assert.strictEqual(
        isFilled(row('TEXT', { textValue: '  30  ' })),
        true,
        'a padded text is filled'
      );
      assert.strictEqual(
        isFilled(row('TEXT', { textValue: '   ' })),
        false,
        'whitespace only is empty'
      );
      assert.strictEqual(isFilled(row('TEXT', { textValue: '' })), false, 'an empty text is empty');
      assert.strictEqual(isFilled(row('TEXT', { textValue: null })), false, 'null is empty');
      assert.strictEqual(isFilled(row('TEXT')), false, 'a missing text is empty');
    });

    QUnit.test(
      'isFilled counts an INTEGER or DECIMAL row with any number, 0 included',
      function (assert) {
        const isFilled = this.form.isFilled;
        assert.strictEqual(
          isFilled(row('INTEGER', { numberValue: '16' })),
          true,
          'an integer is filled'
        );
        assert.strictEqual(isFilled(row('INTEGER', { numberValue: '0' })), true, '"0" is filled');
        assert.strictEqual(
          isFilled(row('INTEGER', { numberValue: 0 })),
          true,
          'the number 0 is filled'
        );
        assert.strictEqual(
          isFilled(row('DECIMAL', { numberValue: '0.75' })),
          true,
          'a decimal is filled'
        );
        assert.strictEqual(isFilled(row('DECIMAL', { numberValue: null })), false, 'null is empty');
        assert.strictEqual(
          isFilled(row('DECIMAL', { numberValue: '' })),
          false,
          'an empty string is empty'
        );
        assert.strictEqual(isFilled(row('INTEGER')), false, 'a missing number is empty');
        assert.strictEqual(
          isFilled(row('INTEGER', { textValue: '12' })),
          false,
          'a text on a number row does not count'
        );
      }
    );

    QUnit.test('isFilled counts a LIST row with a list value', function (assert) {
      const isFilled = this.form.isFilled;
      assert.strictEqual(
        isFilled(row('LIST', { listValue_code: 'BLACK' })),
        true,
        'a list value is filled'
      );
      assert.strictEqual(isFilled(row('LIST', { listValue_code: null })), false, 'null is empty');
      assert.strictEqual(
        isFilled(row('LIST', { listValue_code: '' })),
        false,
        'an empty code is empty'
      );
      assert.strictEqual(isFilled(row('LIST')), false, 'a missing code is empty');
    });

    QUnit.test('isFilled counts a MULTI_LIST row with at least one selection', function (assert) {
      const isFilled = this.form.isFilled;
      const multi = row('MULTI_LIST');
      assert.strictEqual(isFilled(multi, 1), true, 'one selection is filled');
      assert.strictEqual(isFilled(multi, 3), true, 'three selections are filled');
      assert.strictEqual(isFilled(multi, 0), false, 'no selection is empty');
      assert.strictEqual(isFilled(multi), false, 'an unknown selection count is empty');
      assert.strictEqual(
        isFilled(row('MULTI_LIST', { listValue_code: 'WIFI' }), 0),
        false,
        'a list value on a multi-value row does not count'
      );
    });

    QUnit.test('isFilled treats a row without a known value type as empty', function (assert) {
      const isFilled = this.form.isFilled;
      assert.strictEqual(isFilled(null), false, 'no row');
      assert.strictEqual(isFilled({ textValue: 'x' }), false, 'a row without its attribute');
      assert.strictEqual(
        isFilled(row('BOOLEAN', { textValue: 'x' })),
        false,
        'an unknown value type'
      );
    });

    QUnit.test('countFilled returns N and M of "Filled N of M"', function (assert) {
      const countFilled = this.form.countFilled;
      const laptop = [
        row('DECIMAL', { numberValue: '15.6' }),
        row('INTEGER', { numberValue: '16' }),
        row('INTEGER', { numberValue: '512' }),
      ];
      const mouse = [
        row('MULTI_LIST'),
        row('INTEGER', { numberValue: '1600' }),
        row('INTEGER', { numberValue: null }),
      ];
      assert.deepEqual(countFilled(laptop), { filled: 3, total: 3 }, 'Laptop Pro 15: 3 of 3');
      assert.deepEqual(
        countFilled(mouse, [2, undefined, undefined]),
        { filled: 2, total: 3 },
        'Wireless Mouse: 2 of 3, the selections are read by the row index'
      );
      assert.deepEqual(
        countFilled(mouse, [0]),
        { filled: 1, total: 3 },
        'a multi-value row without selections is empty'
      );
      assert.deepEqual(
        countFilled(mouse),
        { filled: 1, total: 3 },
        'without selection counts a multi-value row is empty'
      );
      assert.deepEqual(countFilled([]), { filled: 0, total: 0 }, 'no rows: 0 of 0');
      assert.deepEqual(countFilled(undefined), { filled: 0, total: 0 }, 'rows not loaded: 0 of 0');
    });

    QUnit.test(
      'counterStatus is Success with a check mark when every field is filled',
      function (assert) {
        assert.deepEqual(
          this.form.counterStatus(3, 3),
          { state: ValueState.Success, icon: ICON_COMPLETE },
          'Filled 3 of 3'
        );
      }
    );

    QUnit.test(
      'counterStatus is Warning with an alert sign while a field is empty',
      function (assert) {
        const counterStatus = this.form.counterStatus;
        const incomplete = { state: ValueState.Warning, icon: ICON_INCOMPLETE };
        assert.deepEqual(counterStatus(2, 3), incomplete, 'Filled 2 of 3');
        assert.deepEqual(counterStatus(0, 3), incomplete, 'Filled 0 of 3, nothing filled');
      }
    );

    QUnit.test('counterStatus is Warning when there are no fields', function (assert) {
      assert.deepEqual(
        this.form.counterStatus(0, 0),
        { state: ValueState.Warning, icon: ICON_INCOMPLETE },
        '0 of 0 is not complete (the counter is hidden then)'
      );
    });

    QUnit.module('DetailsForm: display texts', hooks);

    QUnit.test(
      'joinValueAndUnit joins the value and its unit with a no-break space',
      function (assert) {
        const joinValueAndUnit = this.form.joinValueAndUnit;
        assert.strictEqual(joinValueAndUnit('15', 'in'), '15' + NBSP + 'in', 'value and unit');
        assert.notStrictEqual(joinValueAndUnit('15', 'in'), '15 in', 'not a breaking space');
        assert.strictEqual(
          joinValueAndUnit('1,600', 'dpi'),
          '1,600' + NBSP + 'dpi',
          'grouped value'
        );
        assert.strictEqual(joinValueAndUnit(0, 'h'), '0' + NBSP + 'h', '0 is a value');
        assert.strictEqual(joinValueAndUnit('120', ''), '120', 'no unit: the value alone');
        assert.strictEqual(joinValueAndUnit(120), '120', 'a missing unit: the value as text');
        assert.strictEqual(joinValueAndUnit('', 'in'), '', 'an empty value has no unit');
        assert.strictEqual(joinValueAndUnit(null, 'in'), '', 'null has no unit');
        assert.strictEqual(joinValueAndUnit(undefined, 'in'), '', 'undefined has no unit');
      }
    );

    QUnit.test('listValueName returns the name of the stored code', function (assert) {
      const listValueName = this.form.listValueName;
      assert.strictEqual(listValueName(CONNECTIVITY, 'WIFI'), 'Wi-Fi', 'the name of the code');
      assert.strictEqual(listValueName(CONNECTIVITY, 'NFC'), '', 'an unknown code has no name');
      assert.strictEqual(listValueName(CONNECTIVITY, null), '', 'no code has no name');
      assert.strictEqual(listValueName(CONNECTIVITY, ''), '', 'an empty code has no name');
      assert.strictEqual(listValueName(undefined, 'WIFI'), '', 'values not loaded: no name');
    });

    QUnit.test(
      'joinSelectedNames joins the names in the list order, not the selection order',
      function (assert) {
        const joinSelectedNames = this.form.joinSelectedNames;
        assert.strictEqual(
          joinSelectedNames(CONNECTIVITY, ['WIRELESS_2_4_GHZ', 'BLUETOOTH_5_0']),
          'Bluetooth 5.0, Wireless 2.4 GHz',
          'selected last to first, shown in the list order'
        );
        assert.strictEqual(
          joinSelectedNames(CONNECTIVITY, ['WIFI', 'BLUETOOTH_5_3', 'BLUETOOTH_5_0']),
          'Bluetooth 5.0, Bluetooth 5.3, Wi-Fi',
          'three values joined by a comma and a space'
        );
        assert.strictEqual(joinSelectedNames(CONNECTIVITY, ['WIFI']), 'Wi-Fi', 'one value');
        assert.strictEqual(
          joinSelectedNames(CONNECTIVITY, ['WIFI', 'NFC']),
          'Wi-Fi',
          'a code outside the list is left out'
        );
        assert.strictEqual(joinSelectedNames(CONNECTIVITY, []), '', 'no selection: empty');
        assert.strictEqual(joinSelectedNames(CONNECTIVITY, undefined), '', 'selections not loaded');
        assert.strictEqual(joinSelectedNames(undefined, ['WIFI']), '', 'values not loaded');
      }
    );

    QUnit.module('DetailsForm: list writes and draft check', hooks);

    QUnit.test(
      'resolveListText maps an item text to its key and an empty text to no value',
      function (assert) {
        const resolveListText = this.form.resolveListText;
        const black = { key: 'BLACK', text: 'Black' };
        assert.deepEqual(
          resolveListText('Black', black),
          { valid: true, key: 'BLACK' },
          'the text of the selected item stands for its key'
        );
        assert.deepEqual(
          resolveListText('', null),
          { valid: true, key: null },
          'an empty text clears the value'
        );
        assert.deepEqual(
          resolveListText('', black),
          { valid: true, key: null },
          'an empty text clears the value even with a selected item'
        );
        assert.deepEqual(
          resolveListText(undefined, null),
          { valid: true, key: null },
          'no text clears the value'
        );
      }
    );

    QUnit.test('resolveListText rejects a text that is not the text of an item', function (assert) {
      const resolveListText = this.form.resolveListText;
      const black = { key: 'BLACK', text: 'Black' };
      assert.deepEqual(
        resolveListText('Purple', null),
        { valid: false, key: null },
        'a typed text without a selected item'
      );
      assert.deepEqual(
        resolveListText('Blac', black),
        { valid: false, key: null },
        'a text that differs from the selected item'
      );
      assert.deepEqual(
        resolveListText('black', black),
        { valid: false, key: null },
        'the comparison is case-sensitive'
      );
    });

    QUnit.test(
      'diffSelections returns the codes to create and the codes to delete',
      function (assert) {
        const diffSelections = this.form.diffSelections;
        const seeded = ['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ'];
        assert.deepEqual(
          diffSelections(seeded, ['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ', 'BLUETOOTH_5_3']),
          { added: ['BLUETOOTH_5_3'], removed: [] },
          'an added value is created'
        );
        assert.deepEqual(
          diffSelections(['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ', 'BLUETOOTH_5_3'], seeded),
          { added: [], removed: ['BLUETOOTH_5_3'] },
          'a removed value is deleted'
        );
        assert.deepEqual(
          diffSelections(seeded, ['WIRELESS_2_4_GHZ', 'BLUETOOTH_5_0']),
          { added: [], removed: [] },
          'the same values in another order write nothing'
        );
        assert.deepEqual(
          diffSelections(seeded, ['WIFI']),
          { added: ['WIFI'], removed: seeded },
          'a replaced set creates the new and deletes the old values'
        );
        assert.deepEqual(
          diffSelections(seeded, []),
          { added: [], removed: seeded },
          'clearing deletes every value'
        );
        assert.deepEqual(diffSelections([], []), { added: [], removed: [] }, 'nothing to write');
      }
    );

    QUnit.test('isDifferentKey treats an empty key and no key as the same', function (assert) {
      const isDifferentKey = this.form.isDifferentKey;
      assert.strictEqual(isDifferentKey(null, null), false, 'null and null');
      assert.strictEqual(isDifferentKey(undefined, null), false, 'undefined and null');
      assert.strictEqual(isDifferentKey('', null), false, 'an empty stored key and null');
      assert.strictEqual(isDifferentKey(null, ''), false, 'null and an empty key');
      assert.strictEqual(isDifferentKey('BLACK', 'BLACK'), false, 'the same key');
      assert.strictEqual(isDifferentKey('BLACK', 'WHITE'), true, 'another key');
      assert.strictEqual(isDifferentKey(null, 'BLACK'), true, 'a first value');
      assert.strictEqual(isDifferentKey('BLACK', null), true, 'a cleared value');
    });

    QUnit.test(
      'isDraftWithSubcategory is true only for a loaded draft with a subcategory',
      function (assert) {
        const isDraftWithSubcategory = this.form.isDraftWithSubcategory;
        assert.strictEqual(
          isDraftWithSubcategory(false, 'MICE'),
          true,
          'a draft with a subcategory'
        );
        assert.strictEqual(isDraftWithSubcategory(true, 'MICE'), false, 'an active product');
        assert.strictEqual(
          isDraftWithSubcategory(undefined, 'MICE'),
          false,
          'IsActiveEntity not loaded'
        );
        assert.strictEqual(
          isDraftWithSubcategory('false', 'MICE'),
          false,
          'only the boolean false is a draft'
        );
        assert.strictEqual(
          isDraftWithSubcategory(false, null),
          false,
          'a draft without a subcategory'
        );
        assert.strictEqual(
          isDraftWithSubcategory(false, ''),
          false,
          'a draft with an empty subcategory'
        );
        assert.strictEqual(
          isDraftWithSubcategory(false, undefined),
          false,
          'the subcategory not loaded'
        );
      }
    );

    QUnit.module('DetailsForm: number type settings', hooks);

    QUnit.test(
      'numberTypeSettings gives an INTEGER attribute scale 0 and its bounds',
      function (assert) {
        const numberTypeSettings = this.form.numberTypeSettings;
        assert.deepEqual(
          numberTypeSettings(RAM),
          {
            formatOptions: { minFractionDigits: 0, maxFractionDigits: 0, preserveDecimals: false },
            constraints: { precision: 15, scale: 0, minimum: '1', maximum: '1024' },
          },
          'Memory (RAM): scale 0, bounds 1..1024'
        );
        assert.strictEqual(
          numberTypeSettings(Object.assign({}, RAM, { scale: 2 })).constraints.scale,
          0,
          'a scale on an INTEGER attribute is ignored'
        );
      }
    );

    QUnit.test(
      'numberTypeSettings gives a DECIMAL attribute its own scale and its bounds',
      function (assert) {
        const numberTypeSettings = this.form.numberTypeSettings;
        assert.deepEqual(
          numberTypeSettings(SCREEN_SIZE),
          {
            formatOptions: { minFractionDigits: 0, maxFractionDigits: 1, preserveDecimals: false },
            constraints: { precision: 15, scale: 1, minimum: '1', maximum: '100' },
          },
          'Screen Size: scale 1, bounds 1..100, no padding'
        );
        assert.deepEqual(
          numberTypeSettings({
            valueType_code: 'DECIMAL',
            scale: '2',
            minValue: 0.01,
            maxValue: 100,
          }),
          {
            formatOptions: { minFractionDigits: 0, maxFractionDigits: 2, preserveDecimals: false },
            constraints: { precision: 15, scale: 2, minimum: '0.01', maximum: '100' },
          },
          'a scale given as text and numeric bounds become a number and texts'
        );
        assert.strictEqual(
          numberTypeSettings({ valueType_code: 'DECIMAL', scale: null }).constraints.scale,
          0,
          'a DECIMAL attribute without a scale gets scale 0'
        );
      }
    );

    QUnit.test(
      'numberTypeSettings leaves out the bounds the attribute does not have',
      function (assert) {
        const numberTypeSettings = this.form.numberTypeSettings;
        const open = numberTypeSettings({ valueType_code: 'INTEGER', minValue: null });
        assert.deepEqual(
          open.constraints,
          { precision: 15, scale: 0 },
          'no minimum and no maximum'
        );
        const zero = numberTypeSettings({ valueType_code: 'INTEGER', minValue: 0, maxValue: null });
        assert.strictEqual(zero.constraints.minimum, '0', 'a minimum of 0 is a bound');
        assert.strictEqual('maximum' in zero.constraints, false, 'a null maximum is left out');
      }
    );

    QUnit.test('the Decimal type of the settings shows no padding zeros', function (assert) {
      const joinValueAndUnit = this.form.joinValueAndUnit;
      assert.strictEqual(
        createType(SCREEN_SIZE).formatValue('15.0', 'string'),
        '15',
        '"15", not "15.0"'
      );
      assert.strictEqual(
        createType(SCREEN_SIZE).formatValue('15.6', 'string'),
        '15.6',
        'one decimal'
      );
      assert.strictEqual(
        createType(CAPACITY).formatValue('0.75', 'string'),
        '0.75',
        'two decimals'
      );
      assert.strictEqual(
        createType(CAPACITY).formatValue('1.20', 'string'),
        '1.2',
        '"1.2", not "1.20"'
      );
      assert.strictEqual(
        createType(SENSOR).formatValue('1600', 'string'),
        '1,600',
        'grouping (en)'
      );
      assert.strictEqual(
        joinValueAndUnit(createType(SCREEN_SIZE).formatValue('15.0', 'string'), 'in'),
        '15' + NBSP + 'in',
        'the display text of Screen Size'
      );
    });

    QUnit.test(
      'the Decimal type of the settings rejects text, decimals and values out of bounds',
      function (assert) {
        const ram = createType(RAM);
        assert.throws(() => ram.parseValue('abc', 'string'), ParseException, '"abc" is no number');
        assert.throws(
          () => ram.validateValue('12.5'),
          ValidateException,
          'an INTEGER has no decimals'
        );
        assert.throws(() => ram.validateValue('2048'), ValidateException, 'above the maximum');
        assert.throws(() => ram.validateValue('0'), ValidateException, 'below the minimum');
        ram.validateValue('12');
        assert.strictEqual(ram.parseValue('12', 'string'), '12', '"12" is accepted as "12"');
        assert.throws(
          () => createType(CAPACITY).validateValue('0.125'),
          ValidateException,
          'a DECIMAL accepts no more decimals than its scale'
        );
      }
    );
  }
);
