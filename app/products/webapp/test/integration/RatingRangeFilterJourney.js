/* global QUnit */
// Journey "filter products by rating range" (products-rating-filter, PLAN step 6, ADR-0020): the
// List Report filter bar has a Rating filter after Price that is a sap.m.RangeSlider 0..5; a band
// sets the condition rating BT lo..hi, the full range removes it, and the filter bar applies every
// change without a Go button (liveMode). No case presses Go: every change is followed by a row
// assertion that polls until the reloaded table matches, and each expected count differs from the
// count before the change, so a stale table cannot pass. (The first change after load reloads the
// table twice, research section 8; polling to the final count covers it.) The journey saves no
// variant and ends on the full range, and it runs before DraftMarkerInListReportJourney, so no
// draft changes its counts.
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/RatingTexts', './data/CategoryTexts'],
  function (opaTest, RatingTexts, CategoryTexts) {
    'use strict';

    const ranges = RatingTexts.ranges;
    const counts = RatingTexts.counts;
    const label = RatingTexts.labels.en;
    const kitchen = CategoryTexts.names.en.KITCHEN;

    return function () {
      QUnit.module('Filter products by rating range');

      opaTest(
        'The rating filter is a slider from 0 to 5 labelled Rating',
        function (Given, When, Then) {
          Given.iStartMyApp('products-display');
          Then.onTheProductsList.iSeeThisPage();
          Then.onTheRatingRangeSlider.iSeeFilterLabel(label);
          Then.onTheRatingRangeSlider.iSeeSlider(RatingTexts.slider, ranges.full);
          Then.onTheRatingRangeSlider.iSeeRatingCondition(null);
          Then.onTheProductsList.onTable().iCheckRows(counts.full);
        }
      );

      opaTest('The List Report applies filters without a Go button', function (Given, When, Then) {
        Then.onTheRatingRangeSlider.iSeeNoGoButton();
      });

      opaTest('Rating 4 to 5 shows 8 products', function (Given, When, Then) {
        When.onTheRatingRangeSlider.iSetRange(ranges.high);
        Then.onTheRatingRangeSlider.iSeeRatingCondition(ranges.high);
        Then.onTheProductsList.onTable().iCheckRows(counts.high);
        Then.onTheRatingRangeSlider.iSeeRowsWithRatingWithin(ranges.high, counts.high);
        Then.onTheRatingRangeSlider.iSeeRange(ranges.high);
      });

      opaTest('Rating 2 to 4 shows 9 products', function (Given, When, Then) {
        When.onTheRatingRangeSlider.iSetRange(ranges.mid);
        Then.onTheRatingRangeSlider.iSeeRatingCondition(ranges.mid);
        Then.onTheProductsList.onTable().iCheckRows(counts.mid);
        Then.onTheRatingRangeSlider.iSeeRowsWithRatingWithin(ranges.mid, counts.mid);
        Then.onTheRatingRangeSlider.iSeeRange(ranges.mid);
      });

      opaTest('The full range removes the rating filter', function (Given, When, Then) {
        When.onTheRatingRangeSlider.iSetRange(ranges.full);
        Then.onTheRatingRangeSlider.iSeeRatingCondition(null);
        Then.onTheProductsList.onTable().iCheckRows(counts.full);
        Then.onTheRatingRangeSlider.iSeeRange(ranges.full);
      });

      opaTest('Adapt Filters offers the rating slider only', function (Given, When, Then) {
        When.onTheProductsList.onFilterBar().iOpenFilterAdaptation();
        Then.onTheProductsList
          .onFilterBar()
          .iCheckAdaptationFilterField({ property: 'rating' }, { selected: true });
        Then.onTheRatingRangeSlider.iSeeRatingOnceInAdaptFilters(label);
        When.onTheProductsList.onFilterBar().iConfirmFilterAdaptation();
        Then.onTheRatingRangeSlider.iSeeFilterLabel(label);
        Then.onTheRatingRangeSlider.iSeeRange(ranges.full);
      });

      opaTest('The rating range combines with the category filter', function (Given, When, Then) {
        When.onTheProductsList.onFilterBar().iOpenValueHelp({ property: 'category_code' });
        When.onTheCategoryDropdown.iSelectItem(kitchen);
        Then.onTheCategoryDropdown.iSeeFilterTokens('category_code', [kitchen]);
        Then.onTheProductsList.onTable().iCheckRows(counts.kitchen);
        When.onTheRatingRangeSlider.iSetRange(ranges.top);
        Then.onTheRatingRangeSlider.iSeeRatingCondition(ranges.top);
        Then.onTheProductsList.onTable().iCheckRows({ category_code: kitchen }, counts.kitchenTop);
        Then.onTheRatingRangeSlider.iSeeRowsWithRatingWithin(ranges.top, counts.kitchenTop);
        // Back to the full range: only the category condition is left.
        When.onTheRatingRangeSlider.iSetRange(ranges.full);
        Then.onTheRatingRangeSlider.iSeeRatingCondition(null);
        Then.onTheProductsList.onTable().iCheckRows(counts.kitchen);
      });

      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
