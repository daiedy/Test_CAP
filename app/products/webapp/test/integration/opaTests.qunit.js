/*
 * Entry module of the Test Starter for the OPA5 journeys (sap.fe.test).
 * Each journey module exports a function; the shared JourneyRunner executes them in order
 * (launch URL and page objects: pages/JourneyRunner.js).
 */
sap.ui.define(
  [
    './pages/JourneyRunner',
    './FilterProductsByCategoryJourney',
    './CategoryShownAsNameJourney',
    './EditCategoryOnObjectPageJourney',
    './RussianLocaleJourney',
  ],
  function (runner, FilterProductsByCategory, CategoryShownAsName, EditCategoryOnObjectPage, RussianLocale) {
    'use strict';

    runner.run([FilterProductsByCategory, CategoryShownAsName, EditCategoryOnObjectPage, RussianLocale]);
  }
);
