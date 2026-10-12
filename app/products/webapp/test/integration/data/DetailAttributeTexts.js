/*
 * Expected texts for the Details section journeys (products-details-section, ADR-0026): the attribute
 * code list seeded by db/data/my.catalog-DetailAttributes.csv (code, English name, unit) and
 * my.catalog-DetailAttributes.texts.csv (ru names), the assignments of
 * my.catalog-SubcategoryAttributes.csv, and the labels of the _i18n bundles that reach the UI via
 * $metadata. Units are Latin and not localized. Non-ASCII text is written as \u escapes
 * (transliteration in the comment) to keep the test sources ASCII-only, as in data/SubcategoryTexts.js.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    names: {
      en: {
        MATERIAL: 'Material',
        WEIGHT: 'Weight',
        COLOUR: 'Colour',
        DIMENSIONS: 'Dimensions',
        CAPACITY: 'Capacity',
        BATTERY_LIFE: 'Battery Life',
        CONNECTIVITY: 'Connectivity',
        POWER: 'Power',
        SCREEN_SIZE: 'Screen Size',
        RAM: 'Memory (RAM)',
        STORAGE: 'Storage',
        MAX_LOAD: 'Maximum Load',
        BRIGHTNESS: 'Brightness',
        PAGE_COUNT: 'Pages',
        PAPER_SIZE: 'Paper Size',
        TIP_SIZE: 'Tip Size',
        PIECES: 'Pieces',
        THICKNESS: 'Thickness',
        WATER_RESISTANCE: 'Water Resistance',
        DPI: 'Sensor Resolution',
      },
      ru: {
        MATERIAL: '\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B', // Material
        WEIGHT: '\u0412\u0435\u0441', // Ves
        COLOUR: '\u0426\u0432\u0435\u0442', // Tsvet
        DIMENSIONS: '\u0420\u0430\u0437\u043C\u0435\u0440\u044B', // Razmery
        CAPACITY: '\u041E\u0431\u044A\u0435\u043C', // Obyem
        BATTERY_LIFE: '\u0412\u0440\u0435\u043C\u044F \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u043E\u0439 \u0440\u0430\u0431\u043E\u0442\u044B', // Vremya avtonomnoy raboty
        CONNECTIVITY: '\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435', // Podklyuchenie
        POWER: '\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C', // Moshchnost
        SCREEN_SIZE: '\u0414\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u044C \u044D\u043A\u0440\u0430\u043D\u0430', // Diagonal ekrana
        RAM: '\u041E\u043F\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C', // Operativnaya pamyat
        STORAGE: '\u041D\u0430\u043A\u043E\u043F\u0438\u0442\u0435\u043B\u044C', // Nakopitel
        MAX_LOAD: '\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0430', // Maksimalnaya nagruzka
        BRIGHTNESS: '\u042F\u0440\u043A\u043E\u0441\u0442\u044C', // Yarkost
        PAGE_COUNT: '\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446', // Kolichestvo stranits
        PAPER_SIZE: '\u0424\u043E\u0440\u043C\u0430\u0442 \u0431\u0443\u043C\u0430\u0433\u0438', // Format bumagi
        TIP_SIZE: '\u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u043B\u0438\u043D\u0438\u0438', // Tolshchina linii
        PIECES: '\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432', // Kolichestvo predmetov
        THICKNESS: '\u0422\u043E\u043B\u0449\u0438\u043D\u0430', // Tolshchina
        WATER_RESISTANCE: '\u0412\u043E\u0434\u043E\u0441\u0442\u043E\u0439\u043A\u043E\u0441\u0442\u044C', // Vodostoykost
        DPI: '\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0441\u0435\u043D\u0441\u043E\u0440\u0430', // Razreshenie sensora
      },
    },
    // Unit per attribute code (unit column of my.catalog-DetailAttributes.csv); empty when none.
    units: {
      MATERIAL: '',
      WEIGHT: 'kg',
      COLOUR: '',
      DIMENSIONS: 'cm',
      CAPACITY: 'l',
      BATTERY_LIFE: 'h',
      CONNECTIVITY: '',
      POWER: 'W',
      SCREEN_SIZE: 'in',
      RAM: 'GB',
      STORAGE: 'GB',
      MAX_LOAD: 'kg',
      BRIGHTNESS: 'lm',
      PAGE_COUNT: '',
      PAPER_SIZE: '',
      TIP_SIZE: 'mm',
      PIECES: '',
      THICKNESS: 'mm',
      WATER_RESISTANCE: '',
      DPI: 'dpi',
    },
    // Attribute codes per subcategory code (my.catalog-SubcategoryAttributes.csv).
    bySubcategory: {
      LAPTOPS: ['SCREEN_SIZE', 'RAM', 'STORAGE'],
      MICE: ['CONNECTIVITY', 'DPI', 'BATTERY_LIFE'],
      AUDIO: ['CONNECTIVITY', 'BATTERY_LIFE', 'COLOUR'],
      SEATING: ['MATERIAL', 'MAX_LOAD', 'COLOUR'],
      LIGHTING: ['POWER', 'BRIGHTNESS', 'COLOUR'],
      DESK_ORGANIZATION: ['MATERIAL', 'DIMENSIONS', 'COLOUR'],
      APPLIANCES: ['POWER', 'CAPACITY', 'COLOUR'],
      DRINKWARE: ['CAPACITY', 'MATERIAL', 'COLOUR'],
      CUTLERY: ['MATERIAL', 'PIECES', 'WEIGHT'],
      BAGS: ['MATERIAL', 'CAPACITY', 'COLOUR'],
      PHONE_ACCESSORIES: ['MATERIAL', 'COLOUR', 'WEIGHT'],
      FITNESS: ['MATERIAL', 'THICKNESS', 'COLOUR'],
      OUTDOOR: ['MATERIAL', 'WEIGHT', 'WATER_RESISTANCE'],
      NOTEBOOKS: ['PAGE_COUNT', 'PAPER_SIZE', 'COLOUR'],
      WRITING_INSTRUMENTS: ['TIP_SIZE', 'COLOUR', 'MATERIAL'],
    },
    labels: {
      // _i18n key Products.facet.details
      section: {
        en: 'Details',
        ru: '\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438', // Kharakteristiki
      },
      // _i18n key ProductDetails.attribute
      attribute: {
        en: 'Attribute',
        ru: '\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430', // Kharakteristika
      },
      // _i18n key ProductDetails.value
      value: {
        en: 'Value',
        ru: '\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435', // Znachenie
      },
      // _i18n key DetailAttributes.unit
      unit: {
        en: 'Unit',
        ru: '\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F', // Edinitsa izmereniya
      },
    },
  };
});
