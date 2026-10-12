/*
 * Expected texts for the Details section journeys (products-details-section, ADR-0027), taken from
 * the seed data and the bundles: attribute names and units of db/data/my.catalog-DetailAttributes.csv
 * and its .texts.csv (ru), the assignments of my.catalog-SubcategoryAttributes.csv in position order,
 * the allowed values of my.catalog-DetailListValues.csv in position order (the dropdown and display
 * order) with the ru names of its .texts.csv (English fallback where no ru text exists, PLAN D22),
 * the fragment texts of webapp/i18n and the U3 warning of _i18n/messages. Units are Latin and not
 * localized. Non-ASCII text is written as \u escapes (transliteration in the comment) to keep
 * the test sources ASCII-only, as in data/SubcategoryTexts.js.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    // Attribute names (form labels) per attribute code.
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
        BATTERY_LIFE:
          '\u0412\u0440\u0435\u043C\u044F \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u043E\u0439 \u0440\u0430\u0431\u043E\u0442\u044B', // Vremya avtonomnoy raboty
        CONNECTIVITY: '\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435', // Podklyuchenie
        POWER: '\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C', // Moshchnost
        SCREEN_SIZE:
          '\u0414\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u044C \u044D\u043A\u0440\u0430\u043D\u0430', // Diagonal ekrana
        RAM: '\u041E\u043F\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C', // Operativnaya pamyat
        STORAGE: '\u041D\u0430\u043A\u043E\u043F\u0438\u0442\u0435\u043B\u044C', // Nakopitel
        MAX_LOAD:
          '\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0430', // Maksimalnaya nagruzka
        BRIGHTNESS: '\u042F\u0440\u043A\u043E\u0441\u0442\u044C', // Yarkost
        PAGE_COUNT:
          '\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446', // Kolichestvo stranits
        PAPER_SIZE: '\u0424\u043E\u0440\u043C\u0430\u0442 \u0431\u0443\u043C\u0430\u0433\u0438', // Format bumagi
        TIP_SIZE: '\u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u043B\u0438\u043D\u0438\u0438', // Tolshchina linii
        PIECES:
          '\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432', // Kolichestvo predmetov
        THICKNESS: '\u0422\u043E\u043B\u0449\u0438\u043D\u0430', // Tolshchina
        WATER_RESISTANCE:
          '\u0412\u043E\u0434\u043E\u0441\u0442\u043E\u0439\u043A\u043E\u0441\u0442\u044C', // Vodostoykost
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
    // Attribute codes per subcategory code in position order (my.catalog-SubcategoryAttributes.csv).
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
    // Allowed value codes per list attribute in position order (my.catalog-DetailListValues.csv).
    valuesByAttribute: {
      MATERIAL: [
        'MESH',
        'FABRIC',
        'LEATHER',
        'WOOD',
        'BAMBOO',
        'PLASTIC',
        'SILICONE',
        'TPE',
        'ALUMINIUM',
        'STAINLESS_STEEL',
        'GLASS',
        'CERAMIC',
      ],
      COLOUR: [
        'BLACK',
        'WHITE',
        'GREY',
        'SILVER',
        'BLUE',
        'RED',
        'GREEN',
        'YELLOW',
        'PINK',
        'BROWN',
        'BEIGE',
        'MULTICOLOUR',
      ],
      CONNECTIVITY: [
        'BLUETOOTH_5_0',
        'BLUETOOTH_5_3',
        'WIRELESS_2_4_GHZ',
        'WIFI',
        'WIRED_USB',
        'WIRED_AUDIO_JACK',
      ],
      PAPER_SIZE: ['A4', 'A5', 'A6', 'B5', 'LETTER', 'POCKET'],
      WATER_RESISTANCE: ['NONE', 'IPX4', 'IPX5', 'IPX6', 'IPX7', 'IPX8'],
    },
    // Allowed value names per value code.
    valueNames: {
      en: {
        MESH: 'Mesh',
        FABRIC: 'Fabric',
        LEATHER: 'Leather',
        WOOD: 'Wood',
        BAMBOO: 'Bamboo',
        PLASTIC: 'Plastic',
        SILICONE: 'Silicone',
        TPE: 'TPE',
        ALUMINIUM: 'Aluminium',
        STAINLESS_STEEL: 'Stainless steel',
        GLASS: 'Glass',
        CERAMIC: 'Ceramic',
        BLACK: 'Black',
        WHITE: 'White',
        GREY: 'Grey',
        SILVER: 'Silver',
        BLUE: 'Blue',
        RED: 'Red',
        GREEN: 'Green',
        YELLOW: 'Yellow',
        PINK: 'Pink',
        BROWN: 'Brown',
        BEIGE: 'Beige',
        MULTICOLOUR: 'Multicolour',
        BLUETOOTH_5_0: 'Bluetooth 5.0',
        BLUETOOTH_5_3: 'Bluetooth 5.3',
        WIRELESS_2_4_GHZ: 'Wireless 2.4 GHz',
        WIFI: 'Wi-Fi',
        WIRED_USB: 'Wired (USB)',
        WIRED_AUDIO_JACK: 'Wired (audio jack)',
        A4: 'A4',
        A5: 'A5',
        A6: 'A6',
        B5: 'B5',
        LETTER: 'Letter',
        POCKET: 'Pocket',
        NONE: 'Not water-resistant',
        IPX4: 'Splash-resistant (IPX4)',
        IPX5: 'Water-jet-resistant (IPX5)',
        IPX6: 'Powerful-jet-resistant (IPX6)',
        IPX7: 'Temporary immersion (IPX7)',
        IPX8: 'Continuous immersion (IPX8)',
      },
      ru: {
        MESH: '\u0421\u0435\u0442\u043A\u0430', // Setka
        FABRIC: '\u0422\u043A\u0430\u043D\u044C', // Tkan
        LEATHER: '\u041A\u043E\u0436\u0430', // Kozha
        WOOD: '\u0414\u0435\u0440\u0435\u0432\u043E', // Derevo
        BAMBOO: '\u0411\u0430\u043C\u0431\u0443\u043A', // Bambuk
        PLASTIC: '\u041F\u043B\u0430\u0441\u0442\u0438\u043A', // Plastik
        SILICONE: '\u0421\u0438\u043B\u0438\u043A\u043E\u043D', // Silikon
        TPE: 'TPE',
        ALUMINIUM: '\u0410\u043B\u044E\u043C\u0438\u043D\u0438\u0439', // Alyuminiy
        STAINLESS_STEEL:
          '\u041D\u0435\u0440\u0436\u0430\u0432\u0435\u044E\u0449\u0430\u044F \u0441\u0442\u0430\u043B\u044C', // Nerzhaveyushchaya stal
        GLASS: '\u0421\u0442\u0435\u043A\u043B\u043E', // Steklo
        CERAMIC: '\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430', // Keramika
        BLACK: '\u0427\u0435\u0440\u043D\u044B\u0439', // Chernyy
        WHITE: '\u0411\u0435\u043B\u044B\u0439', // Belyy
        GREY: '\u0421\u0435\u0440\u044B\u0439', // Seryy
        SILVER: '\u0421\u0435\u0440\u0435\u0431\u0440\u0438\u0441\u0442\u044B\u0439', // Serebristyy
        BLUE: '\u0421\u0438\u043D\u0438\u0439', // Siniy
        RED: '\u041A\u0440\u0430\u0441\u043D\u044B\u0439', // Krasnyy
        GREEN: '\u0417\u0435\u043B\u0435\u043D\u044B\u0439', // Zelenyy
        YELLOW: '\u0416\u0435\u043B\u0442\u044B\u0439', // Zheltyy
        PINK: '\u0420\u043E\u0437\u043E\u0432\u044B\u0439', // Rozovyy
        BROWN: '\u041A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0439', // Korichnevyy
        BEIGE: '\u0411\u0435\u0436\u0435\u0432\u044B\u0439', // Bezhevyy
        MULTICOLOUR: '\u0420\u0430\u0437\u043D\u043E\u0446\u0432\u0435\u0442\u043D\u044B\u0439', // Raznotsvetnyy
        BLUETOOTH_5_0: 'Bluetooth 5.0',
        BLUETOOTH_5_3: 'Bluetooth 5.3',
        WIRELESS_2_4_GHZ:
          '\u0411\u0435\u0441\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0435 2,4 \u0413\u0413\u0446', // Besprovodnoe 2,4 GGts
        WIFI: 'Wi-Fi',
        WIRED_USB: '\u041F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0435 (USB)', // Provodnoe (USB)
        WIRED_AUDIO_JACK:
          '\u041F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0435 (\u0430\u0443\u0434\u0438\u043E\u0440\u0430\u0437\u044A\u0435\u043C)', // Provodnoe (audiorazyem)
        A4: 'A4',
        A5: 'A5',
        A6: 'A6',
        B5: 'B5',
        LETTER: 'Letter',
        POCKET: '\u041A\u0430\u0440\u043C\u0430\u043D\u043D\u044B\u0439', // Karmannyy
        NONE: '\u0411\u0435\u0437 \u0437\u0430\u0449\u0438\u0442\u044B \u043E\u0442 \u0432\u043E\u0434\u044B', // Bez zashchity ot vody
        IPX4: '\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0431\u0440\u044B\u0437\u0433 (IPX4)', // Zashchita ot bryzg (IPX4)
        IPX5: '\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0441\u0442\u0440\u0443\u0439 (IPX5)', // Zashchita ot struy (IPX5)
        IPX6: '\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0441\u0438\u043B\u044C\u043D\u044B\u0445 \u0441\u0442\u0440\u0443\u0439 (IPX6)', // Zashchita ot silnykh struy (IPX6)
        IPX7: '\u041A\u0440\u0430\u0442\u043A\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0435 \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u0435 (IPX7)', // Kratkovremennoe pogruzhenie (IPX7)
        IPX8: '\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u0435 (IPX8)', // Dlitelnoe pogruzhenie (IPX8)
      },
    },
    labels: {
      // webapp/i18n key ProductsObjectPage.details.title
      section: {
        en: 'Details',
        ru: '\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438', // Kharakteristiki
      },
      // webapp/i18n key ProductsObjectPage.details.filled
      filled: {
        en: 'Filled {0} of {1}',
        ru: '\u0417\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E {0} \u0438\u0437 {1}', // Zapolneno {0} iz {1}
      },
      // webapp/i18n key ProductsObjectPage.details.valueNotInList
      valueNotInList: {
        en: 'Select a value from the list.',
        ru: '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430.', // Vyberite znachenie iz spiska.
      },
    },
    messages: {
      // _i18n/messages key PRODUCTS_DETAILS_VALUES_REMOVED (handler warning on subcategory_code, U3)
      valuesRemoved: {
        en: 'Values removed: {0}. These details do not apply to the new subcategory: {1}.',
        ru: '\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439: {0}. \u042D\u0442\u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043D\u0435 \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u043A \u043D\u043E\u0432\u043E\u0439 \u043F\u043E\u0434\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438: {1}.', // Udaleno znacheniy: {0}. Eti kharakteristiki ne otnosyatsya k novoy podkategorii: {1}.
      },
    },
  };
});
