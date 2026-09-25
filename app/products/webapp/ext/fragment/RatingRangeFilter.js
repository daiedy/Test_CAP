sap.ui.define([], function () {
    "use strict";

    /** Filter bar key and property path of the custom filter field (manifest `filterFields.rating`). */
    const PROPERTY = "rating";
    /** Scale of the slider; equals `@assert.range [0, 5]` of `Products.rating`. */
    const MIN = 0;
    const MAX = 5;

    /**
     * Turns one bound or event value into an integer inside the scale.
     *
     * @param {any} value raw value (number, numeric string, null, out of range)
     * @param {number} fallback value used when `value` is not a finite number
     * @returns {number} integer in [MIN, MAX]
     */
    function clamp(value, fallback) {
        const number = value === null || value === undefined || value === "" ? NaN : Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        return Math.min(MAX, Math.max(MIN, Math.round(number)));
    }

    /**
     * Normalizes a range to two ascending integers inside the scale.
     *
     * @param {any} range array of two values, or anything else for "no range"
     * @returns {number[]} `[lo, hi]` with MIN <= lo <= hi <= MAX
     */
    function normalize(range) {
        const values = Array.isArray(range) ? range : [];
        const lo = clamp(values[0], MIN);
        const hi = clamp(values[1], MAX);
        return lo <= hi ? [lo, hi] : [hi, lo];
    }

    /**
     * Display formatter of the one-way `range` binding: keeps the slider inside 0..5.
     * The `Range` filter type formats an empty condition to `[MIN_SAFE_INTEGER, max]`;
     * without this clamp the RangeSlider would log "not in the range" on render (ADR-0020).
     *
     * @param {any} value the value formatted by `sap/fe/macros/filter/type/Range`
     * @returns {number[]} `[lo, hi]` inside 0..5; `[0, 5]` for an empty or invalid value
     */
    function formatRange(value) {
        return normalize(value);
    }

    /**
     * Maps a slider range to a filter bar condition.
     *
     * @param {any} range the slider range `[lo, hi]`
     * @returns {{operator: string, values: number[]}|null} `BT [lo, hi]` for a band,
     *   `null` ("clear the condition") for the full range 0..5, so products without a rating stay visible
     */
    function toCondition(range) {
        const [lo, hi] = normalize(range);
        if (lo === MIN && hi === MAX) {
            return null;
        }
        return { operator: "BT", values: [lo, hi] };
    }

    /**
     * `change` handler of the RangeSlider (fired on handle release or a keyboard step, not while dragging).
     * `this` is the List Report ExtensionAPI (custom filter field handler wired with `core:require`).
     *
     * @param {sap.ui.base.Event} event the `change` event with parameter `range`
     * @returns {Promise<void>} resolves when the filter bar condition is set or cleared
     */
    function onRangeChange(event) {
        const condition = toCondition(event.getParameter("range"));
        if (!condition) {
            return this.setFilterValues(PROPERTY);
        }
        return this.setFilterValues(PROPERTY, condition.operator, condition.values);
    }

    return {
        toCondition: toCondition,
        formatRange: formatRange,
        onRangeChange: onRangeChange
    };
});
