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
    './DraftMarkerInListReportJourney',
  ],
  function (
    runner,
    FilterProductsByCategory,
    CategoryShownAsName,
    EditCategoryOnObjectPage,
    RussianLocale,
    DraftMarkerInListReport
  ) {
    'use strict';

    // DraftMarkerInListReportJourney runs last: it is the only journey that creates a draft, so a
    // leftover draft can never change the row count the earlier journeys assert.
    runner.run([
      FilterProductsByCategory,
      CategoryShownAsName,
      EditCategoryOnObjectPage,
      RussianLocale,
      DraftMarkerInListReport,
    ]);
  }
);
