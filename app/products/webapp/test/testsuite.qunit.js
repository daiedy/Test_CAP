sap.ui.define(function () {
  'use strict';

  // Test Starter configuration: one entry per test module below webapp/test/.
  return {
    name: 'QUnit test suite for products',
    defaults: {
      page: 'ui5://test-resources/products/Test.qunit.html?testsuite={suite}&test={name}',
      qunit: { version: 2 },
      sinon: { version: 4 },
      ui5: { language: 'EN', theme: 'sap_horizon' },
      coverage: { only: 'products/', never: 'test-resources/products/' },
      loader: { paths: { products: '../' } },
    },
    tests: {
      'integration/opaTests': {
        title: 'OPA5 journeys for products (sap.fe.test)',
        ui5: { animationMode: 'none' },
      },
    },
  };
});
