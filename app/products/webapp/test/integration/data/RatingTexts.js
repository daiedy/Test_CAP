/*
 * Expected values for the rating journeys: the stable keys Fiori Elements 1.152.0 renders for the
 * DataFieldForAnnotation record that targets @UI.DataPoint#Rating, the _i18n label Products.rating
 * and the seeded rating of db/data/my.catalog-Products.csv. Keys measured on the running app:
 * List Report column id "...::LineItem::C::DataPoint::Rating" with property key "rating"; object
 * page form element id "...::FormElement::DataFieldForAnnotation::DataPoint::Rating", which
 * sap/fe/test/api/BaseAPI resolves from { property: 'DataPoint::Rating' } (the typedef's
 * targetAnnotation is not read by that version). Non-ASCII text is written as \u escapes
 * (transliteration in the comment) to keep the test sources ASCII-only.
 * The slider scale, ranges and row counts of the rating filter (products-rating-filter, research
 * section 6) come from the same seeded ratings: 0 x1, 1 x1, 2 x2, 3 x3, 4 x4, 5 x4; Kitchen 4, 5, 5.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    // Property key of the List Report column (MdcTableBuilder matches getPropertyKey()).
    columnKey: 'rating',
    // FieldIdentifier of the General Information form element.
    field: { property: 'DataPoint::Rating' },
    maxValue: 5,
    seeded: { name: 'Laptop Pro 15', rating: 5 },
    // Custom filter field of the List Report filter bar (ADR-0020): sap.m.RangeSlider scale.
    slider: { min: 0, max: 5, step: 1 },
    ranges: {
      full: [0, 5],
      high: [4, 5],
      mid: [2, 4],
      top: [5, 5],
    },
    // Rows of the List Report per range; kitchenTop combines category KITCHEN with ranges.top.
    counts: {
      full: 15,
      high: 8,
      mid: 9,
      kitchen: 3,
      kitchenTop: 2,
    },
    labels: {
      en: 'Rating',
      ru: '\u0420\u0435\u0439\u0442\u0438\u043D\u0433', // Reyting
    },
  };
});
