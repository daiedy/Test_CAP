/*
 * Page object for the Fiori Elements action parameter dialog of the collection-bound action
 * CatalogService.importProducts (products-excel-upload, ADR-0021). sap.fe.test has no API for a file
 * parameter: its dialog field identifiers resolve to sap.ui.mdc.Field controls ("APD_::<property>"),
 * while a complex parameter with an Edm.Stream element renders a sap.m.Label plus a
 * sap.ui.unified.FileUploader, and its onActionDialog() picks the confirm and cancel buttons by
 * position. The actions and assertions are added here with OpaBuilder, matching by control id and
 * control properties only.
 * Ids measured on the running app (FE 1.152.0, research 6.2 and 6.5) and generated without a view
 * prefix by sap/fe/macros/coreUI/OperationParameterDialog: dialog "fe::APD_::<action>", buttons
 * "fe::APD_::<action>::Action::Ok" and "...::Action::Cancel", file label
 * "APD_::file::content::Label" (parameter "file", stream element "content"). The FileUploader id is
 * generated ("__uploader0"), so it is matched by type inside the dialog. The dialog is destroyed in
 * its afterClose handler, so "closed" means: no open dialog with that id.
 * The required marker sits on the label (Label.required), not on the FileUploader, whose own
 * "required" stays false (research 6.5).
 */
sap.ui.define(['sap/ui/test/Opa5', 'sap/ui/test/OpaBuilder'], function (Opa5, OpaBuilder) {
  'use strict';

  const DIALOG_ID = /^fe::APD_::CatalogService\.importProducts$/;
  const OK_BUTTON_ID = /^fe::APD_::CatalogService\.importProducts::Action::Ok$/;
  const CANCEL_BUTTON_ID = /^fe::APD_::CatalogService\.importProducts::Action::Cancel$/;
  const FILE_LABEL_ID = /^APD_::file::content::Label$/;
  const UPLOADER_TYPE = 'sap.ui.unified.FileUploader';

  function dialog(oOpa) {
    return OpaBuilder.create(oOpa)
      .hasType('sap.m.Dialog')
      .hasId(DIALOG_ID)
      .isDialogElement(true)
      .has(function (oDialog) {
        return oDialog.isOpen();
      });
  }

  function dialogButton(oOpa, rId) {
    return OpaBuilder.create(oOpa).hasType('sap.m.Button').hasId(rId).isDialogElement(true);
  }

  // All controls of sType inside the open import dialog (children of the dialog found by id).
  function childrenOfType(oDialog, sType) {
    return OpaBuilder.Matchers.children(OpaBuilder.create().hasType(sType).isDialogElement(true))(
      oDialog
    );
  }

  return {
    actions: {
      // The OK button of the dialog repeats the action label ("Import from Excel").
      iPressImport: function () {
        return dialogButton(this, OK_BUTTON_ID)
          .doPress()
          .description('Pressing the Import button of the import dialog')
          .execute();
      },
      iPressCancel: function () {
        return dialogButton(this, CANCEL_BUTTON_ID)
          .doPress()
          .description('Pressing the Cancel button of the import dialog')
          .execute();
      },
    },
    assertions: {
      iSeeTheDialog: function (sTitle) {
        return dialog(this)
          .hasProperties({ title: sTitle })
          .description("Import dialog is open with the title '" + sTitle + "'")
          .execute();
      },
      // One empty file field whose label is marked required, and no other parameter input: FE fills
      // mediaType and fileName from the chosen file (research 6.2), so no sap.ui.mdc.Field is shown.
      iSeeTheFileField: function (sLabel) {
        OpaBuilder.create(this)
          .hasType('sap.m.Label')
          .hasId(FILE_LABEL_ID)
          .isDialogElement(true)
          .hasProperties({ text: sLabel, required: true })
          .description("File field label '" + sLabel + "' is marked required")
          .execute();
        return dialog(this)
          .has(function (oDialog) {
            const aUploaders = childrenOfType(oDialog, UPLOADER_TYPE);
            return (
              aUploaders.length === 1 &&
              aUploaders[0].getValue() === '' &&
              aUploaders[0].getValueState() === 'None' &&
              childrenOfType(oDialog, 'sap.ui.mdc.Field').length === 0
            );
          })
          .description(
            'Import dialog holds one empty file field in value state None and no other input'
          )
          .execute();
      },
      iSeeTheButtons: function (sImportText) {
        dialogButton(this, OK_BUTTON_ID)
          .hasProperties({ text: sImportText, enabled: true })
          .description("Import dialog offers the button '" + sImportText + "'")
          .execute();
        return dialogButton(this, CANCEL_BUTTON_ID)
          .hasProperties({ enabled: true })
          .description('Import dialog offers the Cancel button')
          .execute();
      },
      // Empty submit (ADR-0021 amendment B): the framework validates the required file on the
      // client, so the field is in value state Error, the text names the field label, the dialog
      // stays open and no other dialog (message box, message dialog of a response) is open on top.
      // Only the label inside the framework text is asserted: the sentence is a UI5 CDN text.
      iSeeTheFileFieldInError: function (sLabel) {
        return dialog(this)
          .has(function (oDialog) {
            const aUploaders = childrenOfType(oDialog, UPLOADER_TYPE);
            return (
              aUploaders.length === 1 &&
              aUploaders[0].getValueState() === 'Error' &&
              aUploaders[0].getValueStateText().indexOf(sLabel) !== -1
            );
          })
          .check(function (vDialogs) {
            const aOpen = Opa5.getPlugin()
              .getMatchingControls({
                controlType: 'sap.m.Dialog',
                searchOpenDialogs: true,
                visible: false,
              })
              .filter(function (oDialog) {
                return oDialog.isOpen();
              });
            return aOpen.length === 1 && [].concat(vDialogs).indexOf(aOpen[0]) !== -1;
          })
          .description(
            "Import dialog stays open, the only open dialog, with the file field in value state Error naming '" +
              sLabel +
              "'"
          )
          .execute();
      },
      iSeeTheDialogClosed: function () {
        return this.waitFor({
          check: function () {
            return Opa5.getPlugin()
              .getMatchingControls({ id: DIALOG_ID, controlType: 'sap.m.Dialog', visible: false })
              .every(function (oDialog) {
                return !oDialog.isOpen();
              });
          },
          success: function () {
            Opa5.assert.ok(true, 'Import dialog is closed');
          },
          errorMessage: 'Import dialog is still open',
        });
      },
    },
  };
});
