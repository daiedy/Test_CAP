/*
 * Expected texts for the validation journeys (products-validations, ADR-0028): the project message
 * texts of _i18n/messages*.properties and the Details form texts of webapp/i18n/i18n*.properties.
 * Generated from the bundles; non-ASCII text is written as backslash-u escapes (transliteration in
 * the comment) to keep the test sources ASCII-only, as in data/DetailAttributeTexts.js. The range
 * pattern carries the en dash U+2013 of the bundle.
 */
sap.ui.define([], function () {
  'use strict';

  return {
    messages: {
      // _i18n/messages key PRODUCTS_NAME_TOO_SHORT
      nameTooShort: {
        en: 'Enter a product name with at least 3 characters.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430 \u0434\u043B\u0438\u043D\u043E\u0439 \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 3 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.', // Vvedite nazvanie tovara dlinoy ne menee 3 simvolov.
      },
      // _i18n/messages key PRODUCTS_NAME_DUPLICATE
      nameDuplicate: {
        en: 'A product with this name already exists. Enter a different name.',
        ru: '\u0422\u043E\u0432\u0430\u0440 \u0441 \u0442\u0430\u043A\u0438\u043C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435\u043C \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435. \u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435.', // Tovar s takim nazvaniem uzhe est v kataloge. Vvedite drugoe nazvanie.
      },
      // _i18n/messages key PRODUCTS_PRICE_POSITIVE
      pricePositive: {
        en: 'Enter a price greater than 0.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0435\u043D\u0443 \u0431\u043E\u043B\u044C\u0448\u0435 0.', // Vvedite tsenu bolshe 0.
      },
      // _i18n/messages key PRODUCTS_PRICE_MINOR_UNIT
      priceMinorUnit: {
        en: 'Enter the price as a whole number. This currency has no decimal places.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0435\u043D\u0443 \u0446\u0435\u043B\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C. \u0423 \u044D\u0442\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u044B \u043D\u0435\u0442 \u0434\u0440\u043E\u0431\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438.', // Vvedite tsenu tselym chislom. U etoy valyuty net drobnoy chasti.
      },
      // _i18n/messages key PRODUCTS_IMAGE_URL_HTTPS
      imageUrlHttps: {
        en: 'Enter an address that starts with https:// and has no spaces.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 https:// \u0438 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043F\u0440\u043E\u0431\u0435\u043B\u043E\u0432.', // Vvedite adres, kotoryy nachinaetsya s https:// i ne soderzhit probelov.
      },
      // _i18n/messages key PRODUCTS_DESCRIPTION_REQUIRED_IN_STOCK
      descriptionRequiredInStock: {
        en: 'Enter a description. Products in stock are visible to customers.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435. \u0422\u043E\u0432\u0430\u0440\u044B \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0432\u0438\u0434\u043D\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F\u043C.', // Vvedite opisanie. Tovary v nalichii vidny pokupatelyam.
      },
      // _i18n/messages key PRODUCTS_DETAIL_VALUE_REQUIRED
      detailValueRequired: {
        en: 'Fill in this detail. It is required for products of this subcategory.',
        ru: '\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u044D\u0442\u0443 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0443. \u041E\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430 \u0434\u043B\u044F \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u044D\u0442\u043E\u0439 \u043F\u043E\u0434\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438.', // Zapolnite etu kharakteristiku. Ona obyazatelna dlya tovarov etoy podkategorii.
      },
      // _i18n/messages key PRODUCTS_DETAIL_VALUE_BELOW_OTHER
      detailValueBelowOther: {
        en: '{0} must not be below {1}.',
        ru: '\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435 {0} \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F {1}.', // Znachenie {0} ne mozhet byt menshe znacheniya {1}.
      },
      // _i18n/messages key PRODUCTS_DETAIL_VALUE_NOT_POWER_OF_TWO
      detailValueNotPowerOfTwo: {
        en: 'Enter a power of two, for example 8, 16 or 32.',
        ru: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u0442\u0435\u043F\u0435\u043D\u044C \u0434\u0432\u043E\u0439\u043A\u0438, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 8, 16 \u0438\u043B\u0438 32.', // Vvedite stepen dvoyki, naprimer 8, 16 ili 32.
      },
    },
    labels: {
      // webapp/i18n key ProductsObjectPage.details.range
      range: {
        en: '{0}\u2013{1}', // {0}-{1}
        ru: '{0}\u2013{1}', // {0}-{1}
      },
      // webapp/i18n key ProductsObjectPage.details.rangeFrom
      rangeFrom: {
        en: 'from {0}',
        ru: '\u043E\u0442 {0}', // ot {0}
      },
      // webapp/i18n key ProductsObjectPage.details.rangeUpTo
      rangeUpTo: {
        en: 'up to {0}',
        ru: '\u0434\u043E {0}', // do {0}
      },
      // webapp/i18n key ProductsObjectPage.details.dependsOn
      dependsOn: {
        en: 'Depends on {0}',
        ru: '\u0417\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u043F\u043E\u043B\u044F {0}', // Zavisit ot polya {0}
      },
      // webapp/i18n key ProductsObjectPage.details.cleared
      cleared: {
        en: '{0} cleared: it depends on {1}.',
        ru: '{0}: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043E\u0447\u0438\u0449\u0435\u043D\u043E, \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u043F\u043E\u043B\u044F {1}.', // {0}: znachenie ochishcheno, zavisit ot polya {1}.
      },
    },
  };
});
