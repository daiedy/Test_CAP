/*
 * Page object for the fields of the Object Page form (section GeneralInfo, FieldGroup data fields):
 * the assertions that sap.fe.test onForm() lacks or gets wrong, added with OpaBuilder and matched by
 * control id and control properties only. Use it for "the form field is empty" and "the form field
 * label is ...".
 * False pass of the standard API: onForm().iCheckField(field, '') passes for ANY field value, because
 * the value matcher turns a falsy expected value into an empty list (sap/fe/test/builder/
 * MdcFieldBuilder, _equalish). An empty field is therefore asserted with iSeeFormFieldEmpty, never
 * with iCheckField(field, '') or iCheckField(field, null).
 * Ids measured on the running app (FE 1.153.0, products-subcategories probe): label
 * ...::FormElement::DataField::<property>-label (sap.m.Label), value
 * ...::FormElement::DataField::<property>::Field-edit (sap.ui.mdc.Field, value = key, additionalValue
 * = text, both null when empty). The Field is bound in edit and display mode, but in display mode the
 * field wrapper renders only its sap.m.Text (...::Field-display), so the Field has no DOM there.
 */
sap.ui.define(['sap/ui/test/OpaBuilder'], function (OpaBuilder) {
  'use strict';

  function formFieldId(sProperty) {
    return new RegExp('::FormElement::DataField::' + sProperty + '::Field-edit$');
  }

  function formLabelId(sProperty) {
    return new RegExp('::FormElement::DataField::' + sProperty + '-label$');
  }

  return {
    actions: {},
    assertions: {
      // The form field has no value and no text, in edit and in display mode (no visibility check,
      // the Field has no DOM in display mode).
      iSeeFormFieldEmpty: function (sProperty) {
        return OpaBuilder.create(this)
          .hasType('sap.ui.mdc.Field')
          .hasId(formFieldId(sProperty))
          .mustBeVisible(false)
          .has(function (oField) {
            return !oField.getValue() && !oField.getAdditionalValue();
          })
          .description("Form field '" + sProperty + "' is empty")
          .execute();
      },
      // The label of the form field; sap.fe.test onForm() has no label assertion.
      iSeeFormFieldLabel: function (sProperty, sLabel) {
        return OpaBuilder.create(this)
          .hasType('sap.m.Label')
          .hasId(formLabelId(sProperty))
          .hasProperties({ text: sLabel })
          .description("Form field '" + sProperty + "' is labelled '" + sLabel + "'")
          .execute();
      },
    },
  };
});
