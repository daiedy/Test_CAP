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
    './RatingShownAsStarsJourney',
    './RatingRangeFilterJourney',
    './DraftMarkerInListReportJourney',
    './RoleAwareActionsJourney',
  ],
  function (
    runner,
    FilterProductsByCategory,
    CategoryShownAsName,
    EditCategoryOnObjectPage,
    RussianLocale,
    RatingShownAsStars,
    RatingRangeFilter,
    DraftMarkerInListReport,
    RoleAwareActions
  ) {
    'use strict';

    // DraftMarkerInListReportJourney runs after the journeys that assert the row count: it is the
    // only journey that creates a draft, so a leftover draft can never change that count.
    // RatingShownAsStarsJourney only reads; it runs before DraftMarkerInListReportJourney for the
    // same reason, so the seeded rating it asserts is never a draft value.
    // RatingRangeFilterJourney asserts row counts per rating range and ends on the full range, so it
    // also runs before DraftMarkerInListReportJourney.
    // RoleAwareActionsJourney runs last (PLAN step 11): it only reads and selects, so it depends on
    // no other journey and changes nothing for them.
    runner.run([
      FilterProductsByCategory,
      CategoryShownAsName,
      EditCategoryOnObjectPage,
      RussianLocale,
      RatingShownAsStars,
      RatingRangeFilter,
      DraftMarkerInListReport,
      RoleAwareActions,
    ]);
  }
);
