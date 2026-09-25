/*
 * Page object for the custom rating filter field of the List Report filter bar (ADR-0020): a
 * sap.m.RangeSlider (fragment ext/fragment/RatingRangeFilter.fragment.xml) inside the filter item
 * ...::CustomFilterField::rating of the sap.ui.mdc.FilterBar. sap.fe.test has no API for a custom
 * filter control (its FilterField identifiers resolve to ...::FilterField::<property>), so the
 * actions and assertions are added here with OpaBuilder, matching by control id and control
 * properties only. Ids measured on the running app (FE 1.152.0, research section 8 and test-ui probe):
 * slider ...--rating--RatingRangeSlider, filter bar ...--fe::FilterBar::Products, filter item
 * ...--fe::FilterBar::Products::CustomFilterField::rating, table ...--fe::table::Products::LineItem,
 * Go button ...--fe::FilterBar::Products-btnSearch (exists, not visible and not rendered in liveMode).
 */
sap.ui.define(['sap/ui/test/OpaBuilder'], function (OpaBuilder) {
  'use strict';

  const PROPERTY = 'rating';
  const SLIDER_ID = /--rating--RatingRangeSlider$/;
  const FILTER_BAR_ID = /--fe::FilterBar::Products$/;
  const FILTER_ITEM_ID = /--fe::FilterBar::Products::CustomFilterField::rating$/;
  const TABLE_ID = /--fe::table::Products::LineItem$/;
  const SEARCH_BUTTON_ID = /--fe::FilterBar::Products-btnSearch$/;
  // Model name of the Adapt Filters list items (sap.ui.mdc p13n panels), measured with the probe.
  const P13N_MODEL = '$p13n';

  function sameRange(aActual, aExpected) {
    return (
      Array.isArray(aActual) &&
      aActual.length === 2 &&
      Number(aActual[0]) === aExpected[0] &&
      Number(aActual[1]) === aExpected[1]
    );
  }

  function slider(oOpa) {
    return OpaBuilder.create(oOpa).hasType('sap.m.RangeSlider').hasId(SLIDER_ID);
  }

  function filterBar(oOpa) {
    return OpaBuilder.create(oOpa).hasType('sap.ui.mdc.FilterBar').hasId(FILTER_BAR_ID);
  }

  return {
    actions: {
      // Moves both handles to [lo, hi] and fires the change event the slider fires on a handle
      // release or a keyboard step. Pointer and keyboard input are ui-verifier scenarios.
      iSetRange: function (aRange) {
        return slider(this)
          .do(function (oSlider) {
            oSlider.setRange(aRange.slice());
            oSlider.fireChange({ range: aRange.slice() });
          })
          .description('Setting the rating slider to ' + aRange.join('..'))
          .execute();
      },
    },
    assertions: {
      iSeeSlider: function (mScale, aRange) {
        return slider(this)
          .hasProperties({ min: mScale.min, max: mScale.max, step: mScale.step })
          .has(function (oSlider) {
            return sameRange(oSlider.getRange(), aRange);
          })
          .description(
            'Rating slider from ' +
              mScale.min +
              ' to ' +
              mScale.max +
              ' with step ' +
              mScale.step +
              ' shows ' +
              aRange.join('..')
          )
          .execute();
      },
      iSeeRange: function (aRange) {
        return slider(this)
          .has(function (oSlider) {
            return sameRange(oSlider.getRange(), aRange);
          })
          .description('Rating slider shows ' + aRange.join('..'))
          .execute();
      },
      // aRange null: the filter bar holds no condition for rating; otherwise exactly one BT [lo, hi].
      iSeeRatingCondition: function (aRange) {
        return filterBar(this)
          .has(function (oFilterBar) {
            const aConditions = oFilterBar.getConditions()[PROPERTY] || [];
            if (!aRange) {
              return aConditions.length === 0;
            }
            return (
              aConditions.length === 1 &&
              aConditions[0].operator === 'BT' &&
              sameRange(aConditions[0].values, aRange)
            );
          })
          .description(
            aRange
              ? "Filter bar holds the condition 'rating BT " + aRange.join('..') + "'"
              : "Filter bar holds no condition for 'rating'"
          )
          .execute();
      },
      // The filter item keyed rating is the one holding the slider, and it carries the label.
      iSeeFilterLabel: function (sLabel) {
        return OpaBuilder.create(this)
          .hasType('sap.ui.mdc.FilterField')
          .hasId(FILTER_ITEM_ID)
          .hasProperties({ label: sLabel, propertyKey: PROPERTY })
          .hasChildren(OpaBuilder.create(this).hasType('sap.m.RangeSlider').hasId(SLIDER_ID))
          .description("Rating filter field holds the slider and is labelled '" + sLabel + "'")
          .execute();
      },
      // liveMode: the filter bar applies every change itself; the Go button is neither visible nor rendered.
      iSeeNoGoButton: function () {
        filterBar(this)
          .hasProperties({ liveMode: true })
          .description('Filter bar is in live mode')
          .execute();
        return OpaBuilder.create(this)
          .hasType('sap.m.Button')
          .hasId(SEARCH_BUTTON_ID)
          .mustBeVisible(false)
          .hasProperties({ visible: false })
          .has(function (oButton) {
            return !oButton.getDomRef();
          })
          .description('Filter bar shows no Go button')
          .execute();
      },
      // Polls until the table shows iCount rows and every row has a rating inside [lo, hi]; the
      // RatingIndicator cell has no text, so the rating is read from the row contexts.
      iSeeRowsWithRatingWithin: function (aRange, iCount) {
        return OpaBuilder.create(this)
          .hasType('sap.ui.mdc.Table')
          .hasId(TABLE_ID)
          .has(function (oTable) {
            const oBinding = oTable.getRowBinding();
            if (!oBinding || oBinding.getLength() !== iCount) {
              return false;
            }
            const aContexts = oBinding.getCurrentContexts();
            return (
              aContexts.length === iCount &&
              aContexts.every(function (oContext) {
                const iRating = oContext.getProperty(PROPERTY);
                return iRating >= aRange[0] && iRating <= aRange[1];
              })
            );
          })
          .description('Table shows ' + iCount + ' rows, all rated ' + aRange.join('..'))
          .execute();
      },
      // Adapt Filters (dialog open) lists the rating filter exactly once, under its key and label.
      iSeeRatingOnceInAdaptFilters: function (sLabel) {
        return (
          OpaBuilder.create(this)
            .hasType('sap.m.CustomListItem')
            .isDialogElement(true)
            // check (not has): the count is taken over all list items of the dialog at once.
            .check(function (vItems) {
              const aData = [].concat(vItems).map(function (oItem) {
                const oContext = oItem.getBindingContext(P13N_MODEL);
                return oContext ? oContext.getObject() : {};
              });
              const aByKey = aData.filter(function (oData) {
                return oData.name === PROPERTY;
              });
              const aByLabel = aData.filter(function (oData) {
                return oData.label === sLabel;
              });
              return aByKey.length === 1 && aByLabel.length === 1 && aByKey[0].label === sLabel;
            })
            .description("Adapt Filters lists '" + sLabel + "' once, keyed 'rating'")
            .execute()
        );
      },
    },
  };
});
