sap.ui.define(
  ['sap/fe/test/JourneyRunner', './ProductsList.gen', './ProductsObjectPage.gen', './CategoryDropdown'],
  function (JourneyRunner, ProductsList, ProductsObjectPage, CategoryDropdown) {
    'use strict';

    // The app is started through the FLP sandbox (test/flpSandbox.html) with the intent
    // products-display, the same entry point `npm start` opens. Journeys pass the intent to
    // Given.iStartMyApp() and may add URL parameters such as sap-ui-language.
    const runner = new JourneyRunner({
      launchUrl: sap.ui.require.toUrl('products/test/flpSandbox.html'),
      opaConfig: { timeout: 60 },
      pages: {
        onTheProductsList: ProductsList,
        onTheProductsObjectPage: ProductsObjectPage,
        onTheCategoryDropdown: CategoryDropdown,
      },
    });

    return runner;
  }
);
