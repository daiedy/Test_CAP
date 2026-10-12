/*
 * Page object for the custom section "Details" of the product Object Page (feature
 * products-details-section, ADR-0027 decision 5): sap.fe.test has no API for the content of a custom
 * section, so the fields of the fragment ext/fragment/DetailsForm are matched here with OpaBuilder,
 * by control id and control properties only.
 * - The fragment controls carry the id prefix of the custom subsection,
 *   ...--fe::CustomSubSection::Details--<fragment id> (detailsCounter, detailsFormContainer).
 * - A field is found by its label: the factory builds one sap.ui.layout.form.FormElement per detail
 *   row whose label is the localized attribute name, and its fields are the display sap.m.Text and
 *   the edit control (sap.m.Input for TEXT, INTEGER and DECIMAL, sap.m.ComboBox for LIST,
 *   sap.m.MultiComboBox for MULTI_LIST; all three are sap.m.InputBase).
 * - The stored value is read through the binding path of the edit control (value for an input,
 *   selectedKey for a combo box, the own-request selections binding in the dependents aggregation of a
 *   multi combo box, ruling B7), never through a rendered text: an assertion on it proves what the
 *   model holds and, with no pending change, what the server holds.
 * Edit-mode actions type like a user (EnterText, Enter commits) or use the picker of a multi combo box
 * (its arrow, the checkbox of a list item), so the fragment's change and selectionFinish handlers run.
 */
sap.ui.define(
  [
    'sap/ui/test/Opa5',
    'sap/ui/test/OpaBuilder',
    'sap/ui/test/actions/EnterText',
    'sap/ui/test/actions/Press',
  ],
  function (Opa5, OpaBuilder, EnterText, Press) {
    'use strict';

    const SECTION_PREFIX = 'fe::CustomSubSection::Details--';
    const IN_FRAGMENT = new RegExp(SECTION_PREFIX);
    const SELECTIONS_AGGREGATION = 'dependents';
    const SELECTION_VALUE = 'value_code';

    function fragmentId(sLocalId) {
      return new RegExp(SECTION_PREFIX + sLocalId + '$');
    }

    // The label text of the form element a field belongs to, or undefined outside the form.
    function labelOf(oControl) {
      const oParent = oControl.getParent();
      if (!oParent || !oParent.isA('sap.ui.layout.form.FormElement')) {
        return undefined;
      }
      const oLabel = oParent.getLabelControl();
      return oLabel ? oLabel.getText() : undefined;
    }

    function isFieldOf(sLabel) {
      return function (oControl) {
        return labelOf(oControl) === sLabel;
      };
    }

    // The edit control of a field: Input, ComboBox or MultiComboBox (all sap.m.InputBase).
    function editControl(oOpa, sLabel) {
      return OpaBuilder.create(oOpa)
        .hasType('sap.m.InputBase')
        .hasId(IN_FRAGMENT)
        .has(isFieldOf(sLabel));
    }

    // The display control of a field.
    function displayControl(oOpa, sLabel) {
      return OpaBuilder.create(oOpa)
        .hasType('sap.m.Text')
        .hasId(IN_FRAGMENT)
        .has(isFieldOf(sLabel));
    }

    function multiComboBox(oOpa, sLabel) {
      return OpaBuilder.create(oOpa)
        .hasType('sap.m.MultiComboBox')
        .hasId(IN_FRAGMENT)
        .has(isFieldOf(sLabel));
    }

    // Codes of the stored selections of a multi combo box (its own-request binding of selections).
    function storedSelections(oMultiComboBox) {
      const oBinding = oMultiComboBox.getBinding(SELECTIONS_AGGREGATION);
      if (!oBinding) {
        return undefined;
      }
      return oBinding
        .getCurrentContexts()
        .filter(Boolean)
        .map(function (oContext) {
          return oContext.getProperty(SELECTION_VALUE);
        });
    }

    // The model value behind the edit control: the bound property of an input or combo box.
    function storedValue(oControl) {
      if (oControl.isA('sap.m.MultiComboBox')) {
        return storedSelections(oControl);
      }
      const sProperty = oControl.isA('sap.m.ComboBox') ? 'selectedKey' : 'value';
      const oBinding = oControl.getBinding(sProperty);
      const oContext = oControl.getBindingContext();
      return oBinding && oContext ? oContext.getProperty(oBinding.getPath()) : undefined;
    }

    function sameCodes(aActual, aExpected) {
      return (
        Array.isArray(aActual) &&
        aActual.length === aExpected.length &&
        aActual.slice().sort().join('|') === aExpected.slice().sort().join('|')
      );
    }

    // null and undefined mean "no value"; numbers are compared as numbers (Edm.Decimal is a string).
    function sameValue(vActual, vExpected) {
      if (Array.isArray(vExpected)) {
        return sameCodes(vActual, vExpected);
      }
      if (vExpected === null || vExpected === undefined) {
        return vActual === null || vActual === undefined;
      }
      if (typeof vExpected === 'number') {
        return vActual !== null && vActual !== undefined && Number(vActual) === vExpected;
      }
      return vActual === vExpected;
    }

    function hasNoPendingChanges(oControl) {
      // The row context: its own PATCH and the selections created or deleted through it. The model
      // as a whole may hold unrelated changes of the page (measured after a subcategory change).
      const oContext = oControl.getBindingContext();
      return Boolean(oContext) && !oContext.hasPendingChanges();
    }

    function itemTexts(aItems) {
      return aItems.map(function (oItem) {
        return oItem.getText();
      });
    }

    // The list of the open multi combo box picker: the only sap.m.List in an open popover whose
    // items show the attribute's values (sap.m.StandardListItem, title = value name).
    function pickerList(oOpa) {
      return OpaBuilder.create(oOpa).hasType('sap.m.List').isDialogElement(true);
    }

    return {
      actions: {
        // Types a value into the field and commits it with Enter, like a user. An empty text clears
        // the field. A multi combo box keeps its tokens: Enter adds the item whose name was typed.
        iEnterValue: function (sLabel, sText) {
          return editControl(this, sLabel)
            .do(function (oControl) {
              const bMulti = oControl.isA('sap.m.MultiComboBox');
              new EnterText({
                text: sText,
                clearTextFirst: !bMulti,
                pressEnterKey: true,
              }).executeOn(oControl);
            })
            .description("Entering '" + sText + "' into the Details field '" + sLabel + "'")
            .execute();
        },
        // Opens the list of a multi combo box, toggles the items with the given names and closes the
        // list again, which fires selectionFinish (the fragment writes the selections then).
        iToggleListItems: function (sLabel, aNames) {
          const oOpa = this;
          multiComboBox(this, sLabel)
            .do(new Press({ idSuffix: 'arrow' }))
            .description("Opening the list of the Details field '" + sLabel + "'")
            .execute();
          aNames.forEach(function (sName) {
            pickerList(oOpa)
              .hasAggregationProperties('items', { title: sName })
              .doOnAggregation(
                'items',
                OpaBuilder.Matchers.properties({ title: sName }),
                new Press({ idSuffix: 'selectMulti' })
              )
              .description("Toggling '" + sName + "' in the list of '" + sLabel + "'")
              .execute();
          });
          return multiComboBox(this, sLabel)
            .do(new Press({ idSuffix: 'arrow' }))
            .description("Closing the list of the Details field '" + sLabel + "'")
            .execute();
        },
      },
      assertions: {
        // The counter line under the section title ("Filled N of M").
        iSeeTheCounter: function (sText) {
          return OpaBuilder.create(this)
            .hasType('sap.m.Text')
            .hasId(fragmentId('detailsCounter'))
            .hasProperties({ text: sText })
            .description("The Details counter reads '" + sText + "'")
            .execute();
        },
        // The labels of the rendered fields, in this order and no other field.
        iSeeTheFieldLabels: function (aLabels) {
          return OpaBuilder.create(this)
            .hasType('sap.ui.layout.form.FormContainer')
            .hasId(fragmentId('detailsFormContainer'))
            .mustBeVisible(false)
            .has(function (oContainer) {
              const aLabelControls = oContainer.getFormElements().map(function (oElement) {
                return oElement.getLabelControl();
              });
              const aShown = aLabelControls.map(function (oLabel) {
                return oLabel && oLabel.getDomRef() ? oLabel.getText() : '';
              });
              return aShown.join('|') === aLabels.join('|');
            })
            .description('The Details fields are ' + aLabels.join(', ') + ' in this order')
            .execute();
        },
        // The display text of a field (value and unit joined by a no-break space).
        iSeeTheDisplayValue: function (sLabel, sText) {
          return displayControl(this, sLabel)
            .hasProperties({ text: sText })
            .description("The Details field '" + sLabel + "' shows '" + sText + "'")
            .execute();
        },
        // An empty field in display mode shows the empty indicator, not a text.
        iSeeAnEmptyDisplayValue: function (sLabel) {
          return displayControl(this, sLabel)
            .hasProperties({ text: '', emptyIndicatorMode: 'On' })
            .description("The Details field '" + sLabel + "' shows the empty indicator")
            .execute();
        },
        // The label sits above its display value, start-aligned with it (SCREENS "Layout").
        iSeeTheLabelAboveTheValue: function (sLabel) {
          return displayControl(this, sLabel)
            .has(function (oText) {
              const oLabel = oText.getParent().getLabelControl();
              if (!oLabel || !oLabel.getDomRef()) {
                return false;
              }
              const oLabelBox = oLabel.getDomRef().getBoundingClientRect();
              const oTextBox = oText.getDomRef().getBoundingClientRect();
              return (
                oLabelBox.bottom <= oTextBox.top + 1 &&
                Math.abs(oLabelBox.left - oTextBox.left) <= 4
              );
            })
            .description("The label '" + sLabel + "' is above its value, start-aligned")
            .execute();
        },
        // Display mode: no input, combo box or multi combo box of the section is rendered.
        iSeeNoEditControls: function () {
          return this.waitFor({
            check: function () {
              const aControls = Opa5.getPlugin().getMatchingControls({
                controlType: 'sap.m.InputBase',
                id: IN_FRAGMENT,
                visible: false,
              });
              return (
                aControls.length > 0 &&
                aControls.every(function (oControl) {
                  return !oControl.getVisible() && !oControl.getDomRef();
                })
              );
            },
            success: function () {
              Opa5.assert.ok(true, 'The Details section renders no edit control');
            },
            errorMessage: 'The Details section renders an edit control in display mode',
          });
        },
        // The section is a form, not the revision 1 table of the composition details.
        iSeeNoDetailsTable: function () {
          return this.waitFor({
            check: function () {
              return (
                Opa5.getPlugin().getMatchingControls({
                  controlType: 'sap.ui.mdc.Table',
                  id: /fe::table::details::/,
                  visible: false,
                }).length === 0
              );
            },
            success: function () {
              Opa5.assert.ok(true, 'The Object Page has no table of the details');
            },
            errorMessage: 'The Object Page still has a table of the details',
          });
        },
        // The value state of the edit control; the text only when given (framework texts are not).
        iSeeTheValueState: function (sLabel, sState, sText) {
          const mProperties = { valueState: sState };
          if (sText !== undefined) {
            mProperties.valueStateText = sText;
          }
          return editControl(this, sLabel)
            .hasProperties(mProperties)
            .description("The Details field '" + sLabel + "' has the value state " + sState)
            .execute();
        },
        // The value the model holds behind the field, with no change pending: null for none, a
        // number, a list code, or the list of selected codes of a multi combo box.
        iSeeTheStoredValue: function (sLabel, vValue) {
          return editControl(this, sLabel)
            .mustBeVisible(false)
            .has(function (oControl) {
              return sameValue(storedValue(oControl), vValue) && hasNoPendingChanges(oControl);
            })
            .description(
              "The Details field '" +
                sLabel +
                "' stores " +
                JSON.stringify(vValue) +
                ', nothing pending'
            )
            .execute();
        },
        // The items of a list field in this order: names only, the list order of the attribute.
        iSeeTheListItems: function (sLabel, aNames) {
          return editControl(this, sLabel)
            .has(function (oControl) {
              return (
                typeof oControl.getItems === 'function' &&
                itemTexts(oControl.getItems()).join('|') === aNames.join('|')
              );
            })
            .description("The list of '" + sLabel + "' is " + aNames.join(', '))
            .execute();
        },
        // The names shown as tokens of a multi combo box, in any order.
        iSeeTheSelectedItems: function (sLabel, aNames) {
          return multiComboBox(this, sLabel)
            .has(function (oMultiComboBox) {
              return sameCodes(itemTexts(oMultiComboBox.getSelectedItems()), aNames);
            })
            .description("The field '" + sLabel + "' shows the tokens " + aNames.join(', '))
            .execute();
        },
        // Save was refused on the client: the message popover opened with the error of the field.
        iSeeSaveBlockedBy: function (sText) {
          return OpaBuilder.create(this)
            .hasType('sap.m.MessagePopover')
            .mustBeVisible(false)
            .has(function (oPopover) {
              return (
                oPopover.isOpen() &&
                oPopover.getItems().some(function (oItem) {
                  return oItem.getType() === 'Error' && oItem.getTitle() === sText;
                })
              );
            })
            .description("Save is blocked by the error '" + sText + "' in the message popover")
            .execute();
        },
      },
    };
  }
);
