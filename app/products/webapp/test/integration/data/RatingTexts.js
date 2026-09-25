/*
 * Expected values for the rating journeys: the stable keys Fiori Elements 1.152.0 renders for the
 * DataFieldForAnnotation record that targets @UI.DataPoint#Rating, the _i18n label Products.rating
 * and the seeded rating of db/data/my.catalog-Products.csv. Keys measured on the running app:
 * List Report column id "...::LineItem::C::DataPoint::Rating" with property key "rating"; object
 * page form element id "...::FormElement::DataFieldForAnnotation::DataPoint::Rating", which
 * sap/fe/test/api/BaseAPI resolves from { property: 'DataPoint::Rating' } (the typedef's
 * targetAnnotation is not read by that version). Non-ASCII text is written as \u escapes
 * (transliteration in the comment) to keep the test sources ASCII-only.
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
    labels: {
      en: 'Rating',
      ru: 'Рейтинг', // Reyting
    },
  };
});
