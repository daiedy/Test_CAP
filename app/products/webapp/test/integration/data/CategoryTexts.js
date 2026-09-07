/*
 * Expected texts for the category journeys: the code list seeded by db/data/my.catalog-Categories.csv
 * and my.catalog-Categories.texts.csv, and the labels of the _i18n bundles that reach the UI via
 * $metadata. Non-ASCII text is written as \u escapes (transliteration in the comment) to keep the
 * test sources ASCII-only.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    names: {
      en: {
        ACCESSORIES: 'Accessories',
        ELECTRONICS: 'Electronics',
        FURNITURE: 'Furniture',
        KITCHEN: 'Kitchen',
        SPORTS: 'Sports',
        STATIONERY: 'Stationery',
      },
      ru: {
        ACCESSORIES: '\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B', // Aksessuary
        ELECTRONICS: '\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u0438\u043A\u0430', // Elektronika
        FURNITURE: '\u041C\u0435\u0431\u0435\u043B\u044C', // Mebel
        KITCHEN: '\u041A\u0443\u0445\u043D\u044F', // Kukhnya
        SPORTS: '\u0421\u043F\u043E\u0440\u0442', // Sport
        STATIONERY: '\u041A\u0430\u043D\u0446\u0435\u043B\u044F\u0440\u0438\u044F', // Kantselyariya
      },
    },
    labels: {
      // _i18n key Products.category
      category: {
        en: 'Category',
        ru: '\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F', // Kategoriya
      },
    },
  };
});
