/* global QUnit */
// Unit tests of the pure functions of the custom rating filter field (ADR-0020,
// webapp/ext/fragment/RatingRangeFilter.js): the mapping of a slider range to a filter bar
// condition and the display formatter of the one-way range binding. onRangeChange only
// forwards the result of toCondition to the ExtensionAPI and is covered by the OPA5 journey.
sap.ui.define(['products/ext/fragment/RatingRangeFilter'], function (RatingRangeFilter) {
  'use strict';

  QUnit.module('RatingRangeFilter', {
    beforeEach: function () {
      this.toCondition = RatingRangeFilter.toCondition;
      this.formatRange = RatingRangeFilter.formatRange;
    },
    afterEach: function () {
      this.toCondition = null;
      this.formatRange = null;
    },
  });

  QUnit.test('toCondition maps a band to BT and the full range to clear', function (assert) {
    assert.deepEqual(
      this.toCondition([4, 5]),
      { operator: 'BT', values: [4, 5] },
      '4..5 is BT 4..5'
    );
    assert.deepEqual(
      this.toCondition([2, 4]),
      { operator: 'BT', values: [2, 4] },
      '2..4 is BT 2..4'
    );
    assert.deepEqual(
      this.toCondition([5, 5]),
      { operator: 'BT', values: [5, 5] },
      'a single value is BT 5..5'
    );
    assert.deepEqual(
      this.toCondition([0, 4]),
      { operator: 'BT', values: [0, 4] },
      'a lower bound of 0 is a band'
    );
    assert.deepEqual(
      this.toCondition([1, 5]),
      { operator: 'BT', values: [1, 5] },
      'an upper bound of 5 is a band'
    );
    assert.strictEqual(this.toCondition([0, 5]), null, 'the full range 0..5 clears the condition');
    assert.deepEqual(
      this.toCondition([4, 2]),
      { operator: 'BT', values: [2, 4] },
      'reversed handles are sorted'
    );
    assert.deepEqual(
      this.toCondition([3.6, '4']),
      { operator: 'BT', values: [4, 4] },
      'values are rounded to integers'
    );
    assert.strictEqual(this.toCondition(undefined), null, 'no range clears the condition');
    assert.strictEqual(
      this.toCondition([-3, 9]),
      null,
      'a range beyond the scale is clamped to 0..5 and clears'
    );
  });

  QUnit.test('formatRange keeps the slider inside 0..5', function (assert) {
    assert.deepEqual(this.formatRange(undefined), [0, 5], 'undefined shows the full range');
    assert.deepEqual(this.formatRange(null), [0, 5], 'null shows the full range');
    assert.deepEqual(this.formatRange([]), [0, 5], 'an empty array shows the full range');
    assert.deepEqual(this.formatRange(['', '']), [0, 5], 'empty strings show the full range');
    assert.deepEqual(
      this.formatRange([Number.MIN_SAFE_INTEGER, 5]),
      [0, 5],
      'the empty-condition value of the Range filter type is clamped to 0..5'
    );
    assert.deepEqual(this.formatRange([-1, 7]), [0, 5], 'out-of-range bounds are clamped');
    assert.deepEqual(this.formatRange([4, 5]), [4, 5], 'a band inside the scale is kept');
    assert.deepEqual(this.formatRange(['2', '4']), [2, 4], 'numeric strings become numbers');
    assert.deepEqual(this.formatRange([5, 3]), [3, 5], 'reversed bounds are sorted');
  });
});
