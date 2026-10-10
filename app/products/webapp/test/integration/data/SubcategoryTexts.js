/*
 * Expected texts for the subcategory journeys: the code list seeded by
 * db/data/my.catalog-Subcategories.csv (code, English name, category) and
 * my.catalog-Subcategories.texts.csv (ru names), and the label of the _i18n bundles that reaches
 * the UI via $metadata. Non-ASCII text is written as \u escapes (transliteration in the
 * comment) to keep the test sources ASCII-only, as in data/CategoryTexts.js.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    names: {
      en: {
        LAPTOPS: 'Laptops',
        MICE: 'Mice',
        AUDIO: 'Audio',
        SEATING: 'Seating',
        LIGHTING: 'Lighting',
        DESK_ORGANIZATION: 'Desk Organization',
        APPLIANCES: 'Appliances',
        DRINKWARE: 'Drinkware',
        CUTLERY: 'Cutlery',
        BAGS: 'Bags',
        PHONE_ACCESSORIES: 'Phone Accessories',
        FITNESS: 'Fitness',
        OUTDOOR: 'Outdoor',
        NOTEBOOKS: 'Notebooks',
        WRITING_INSTRUMENTS: 'Writing Instruments',
      },
      ru: {
        LAPTOPS: '\u041D\u043E\u0443\u0442\u0431\u0443\u043A\u0438', // Noutbuki
        MICE: '\u041C\u044B\u0448\u0438', // Myshi
        AUDIO: '\u0410\u0443\u0434\u0438\u043E', // Audio
        SEATING: '\u041A\u0440\u0435\u0441\u043B\u0430 \u0438 \u0441\u0442\u0443\u043B\u044C\u044F', // Kresla i stulya
        LIGHTING: '\u041E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435', // Osveshchenie
        DESK_ORGANIZATION:
          '\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043C\u0435\u0441\u0442\u0430', // Organizatsiya rabochego mesta
        APPLIANCES:
          '\u0411\u044B\u0442\u043E\u0432\u0430\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0430', // Bytovaya tekhnika
        DRINKWARE:
          '\u041F\u043E\u0441\u0443\u0434\u0430 \u0434\u043B\u044F \u043D\u0430\u043F\u0438\u0442\u043A\u043E\u0432', // Posuda dlya napitkov
        CUTLERY:
          '\u0421\u0442\u043E\u043B\u043E\u0432\u044B\u0435 \u043F\u0440\u0438\u0431\u043E\u0440\u044B', // Stolovye pribory
        BAGS: '\u0421\u0443\u043C\u043A\u0438', // Sumki
        PHONE_ACCESSORIES:
          '\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B \u0434\u043B\u044F \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u043E\u0432', // Aksessuary dlya telefonov
        FITNESS: '\u0424\u0438\u0442\u043D\u0435\u0441', // Fitnes
        OUTDOOR: '\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043E\u0442\u0434\u044B\u0445', // Aktivnyy otdykh
        NOTEBOOKS: '\u0411\u043B\u043E\u043A\u043D\u043E\u0442\u044B', // Bloknoty
        WRITING_INSTRUMENTS:
          '\u041F\u0438\u0441\u044C\u043C\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u043D\u043E\u0441\u0442\u0438', // Pismennye prinadlezhnosti
      },
    },
    // Subcategory codes per category code (category_code column of my.catalog-Subcategories.csv).
    byCategory: {
      ELECTRONICS: ['LAPTOPS', 'MICE', 'AUDIO'],
      FURNITURE: ['SEATING', 'LIGHTING', 'DESK_ORGANIZATION'],
      KITCHEN: ['APPLIANCES', 'DRINKWARE', 'CUTLERY'],
      ACCESSORIES: ['BAGS', 'PHONE_ACCESSORIES'],
      SPORTS: ['FITNESS', 'OUTDOOR'],
      STATIONERY: ['NOTEBOOKS', 'WRITING_INSTRUMENTS'],
    },
    labels: {
      // _i18n key Products.subcategory
      subcategory: {
        en: 'Subcategory',
        ru: '\u041F\u043E\u0434\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F', // Podkategoriya
      },
    },
  };
});
