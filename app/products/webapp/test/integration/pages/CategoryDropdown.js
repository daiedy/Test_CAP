/*
 * Page object for the code-list value helps rendered as a dropdown (Common.ValueListWithFixedValues,
 * ADR-0011): category, and subcategory with its In parameter (ADR-0024). In SAP Fiori elements for
 * OData V4 the dropdown is the typeahead popover of the field: a sap.m.Table
 * (id ...::<property>::Popover::...::SuggestTable) whose rows are sap.m.ColumnListItem with one
 * sap.fe.macros.Field cell showing the name. The standard sap.fe.test API has no assertions for these
 * items nor for the filter tokens, so they are added here with OpaBuilder, matching by control id and
 * control properties only. The property defaults to category_code, so the category journeys pass none.
 * Object Page form assertions (field empty, field label) live in pages/ObjectPageForm.js.
 */
sap.ui.define(['sap/ui/test/OpaBuilder', 'sap/ui/test/actions/Press'], function (OpaBuilder, Press) {
  'use strict';

  const DEFAULT_PROPERTY = 'category_code';

  function propertyName(sProperty) {
    return sProperty || DEFAULT_PROPERTY;
  }

  function dropdownTableId(sProperty) {
    return new RegExp(propertyName(sProperty) + '::Popover::.*SuggestTable$');
  }

  function filterFieldId(sProperty) {
    return new RegExp('::FilterField::' + sProperty + '$');
  }

  function dropdownRows(oTable) {
    return oTable.getItems().filter(function (oItem) {
      return oItem.isA('sap.m.ColumnListItem');
    });
  }

  // Distinct visible texts of one dropdown row: the name only; a code would show up as a second
  // text. (The Field cell renders the same text twice, e.g. for the responsive pop-in.)
  function rowTexts(oRow) {
    const aTexts = oRow
      .findAggregatedObjects(true, function (oControl) {
        return oControl.isA('sap.m.Text') && oControl.getVisible();
      })
      .map(function (oText) {
        return oText.getText();
      });
    return aTexts.filter(function (sText, iIndex) {
      return aTexts.indexOf(sText) === iIndex;
    });
  }

  function sameTexts(aActual, aExpected) {
    return (
      aActual.length === aExpected.length &&
      aActual.slice().sort().join('|') === aExpected.slice().sort().join('|')
    );
  }

  function openDropdown(oOpa, sProperty) {
    return OpaBuilder.create(oOpa)
      .hasType('sap.m.Table')
      .hasId(dropdownTableId(sProperty))
      .isDialogElement(true);
  }

  return {
    actions: {
      // Selects a row by its name: the checkbox in a multi-select list (filter bar), the row itself otherwise.
      iSelectItem: function (sLabel, sProperty) {
        return openDropdown(this, sProperty)
          .has(function (oTable) {
            return dropdownRows(oTable).find(function (oRow) {
              return rowTexts(oRow).indexOf(sLabel) >= 0;
            });
          })
          .do(function (oRow) {
            const bMultiSelect = oRow.getMode() === 'MultiSelect';
            new Press(bMultiSelect ? { idSuffix: 'selectMulti' } : {}).executeOn(oRow);
          })
          .description("Selecting '" + sLabel + "' in the " + propertyName(sProperty) + ' dropdown')
          .execute();
      },
    },
    assertions: {
      // The open dropdown shows exactly the given names, one text per row and no code next to it.
      iSeeItems: function (aLabels, sProperty) {
        return openDropdown(this, sProperty)
          .has(function (oTable) {
            const aRows = dropdownRows(oTable);
            return aRows.length > 0 ? aRows : false;
          })
          .has(function (aRows) {
            const aTextsPerRow = aRows.map(rowTexts);
            const bOneTextPerRow = aTextsPerRow.every(function (aTexts) {
              return aTexts.length === 1;
            });
            const aShown = aTextsPerRow.map(function (aTexts) {
              return aTexts[0];
            });
            return bOneTextPerRow && sameTexts(aShown, aLabels);
          })
          .description(
            'The ' + propertyName(sProperty) + ' dropdown shows only the names ' + aLabels.join(', ')
          )
          .execute();
      },
      iSeeFilterTokens: function (sProperty, aTexts) {
        return OpaBuilder.create(this)
          .hasType('sap.ui.mdc.FilterField')
          .hasId(filterFieldId(sProperty))
          .has(OpaBuilder.Matchers.children(OpaBuilder.create(this).hasType('sap.m.Token')))
          .has(function (aTokens) {
            return sameTexts(
              aTokens.map(function (oToken) {
                return oToken.getText();
              }),
              aTexts
            );
          })
          .description("Filter field '" + sProperty + "' shows the tokens " + aTexts.join(', '))
          .execute();
      },
      iSeeFilterFieldLabel: function (sProperty, sLabel) {
        return OpaBuilder.create(this)
          .hasType('sap.ui.mdc.FilterField')
          .hasId(filterFieldId(sProperty))
          .hasProperties({ label: sLabel })
          .description("Filter field '" + sProperty + "' is labelled '" + sLabel + "'")
          .execute();
      },
    },
  };
});
