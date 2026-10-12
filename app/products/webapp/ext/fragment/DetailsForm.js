sap.ui.define(
    [
        "sap/ui/layout/form/FormElement",
        "sap/m/Label",
        "sap/m/Text",
        "sap/m/Input",
        "sap/m/ComboBox",
        "sap/m/MultiComboBox",
        "sap/ui/core/Item",
        "sap/ui/model/odata/type/Decimal"
    ],
    function (FormElement, Label, Text, Input, ComboBox, MultiComboBox, Item, Decimal) {
        "use strict";

        /**
         * Module of the custom section "Details" (ADR-0027 decision 5): a factory builds one form element per
         * detail row of the product by the attribute's value type; the fragment names no attribute.
         * Rows come from the server in `position` order (no client sorter, PLAN step 8).
         */

        /** Custom data key that marks the fragment controls this module looks up (root, form, counter, noAttributes). */
        const ROLE = "detailsRole";
        /** Foreign key of a `ProductDetailSelections` row to its list value. */
        const VALUE_CODE = "value_code";
        /** Aggregation of the multi combo box that holds the row's `selections` binding (not rendered). */
        const SELECTIONS = "dependents";
        /** Precision of `ProductDetails.numberValue` (Decimal(15, 3)). */
        const PRECISION = 15;
        /** No-break space between a value and its unit, so they never wrap apart (SCREENS "Fields per value type"). */
        const NBSP = String.fromCharCode(0xa0);
        /** The `details` list binding keeps its identity across Object Page contexts, so its handlers are attached once. */
        const wiredBindings = new WeakSet();

        /**
         * Visibility of the edit control of a field.
         *
         * @param {any} editable value of `ui>/isEditable`
         * @returns {boolean} true only in edit mode
         */
        function isEditMode(editable) {
            return editable === true;
        }

        /**
         * Visibility of the display control of a field.
         *
         * @param {any} editable value of `ui>/isEditable`
         * @returns {boolean} true unless in edit mode (also while the edit state is still unknown)
         */
        function isDisplayMode(editable) {
            return editable !== true;
        }

        /**
         * Whether a detail row counts as filled for the counter (SCREENS "Title, counter, layout").
         *
         * @param {object} row detail row as read by the section binding, with `attribute` and `selections`
         * @returns {boolean} TEXT non-empty after trimming, a number, a list value, or at least one selection
         */
        function isFilled(row) {
            const type = row && row.attribute ? row.attribute.valueType_code : undefined;
            switch (type) {
                case "TEXT":
                    return typeof row.textValue === "string" && row.textValue.trim() !== "";
                case "INTEGER":
                case "DECIMAL":
                    return row.numberValue !== null && row.numberValue !== undefined && row.numberValue !== "";
                case "LIST":
                    return Boolean(row.listValue_code);
                case "MULTI_LIST":
                    return Array.isArray(row.selections) && row.selections.length > 0;
                default:
                    return false;
            }
        }

        /**
         * Counts filled rows.
         *
         * @param {object[]} rows detail rows of one product
         * @returns {{filled: number, total: number}} N and M of "Filled N of M"
         */
        function countFilled(rows) {
            const list = Array.isArray(rows) ? rows : [];
            return { filled: list.filter(isFilled).length, total: list.length };
        }

        /**
         * Display text of a value with its unit.
         *
         * @param {any} value formatted value, or empty
         * @param {string} [unit] unit of the attribute, Latin, not localized
         * @returns {string} "15 in" with a no-break space, the value alone without a unit, "" for no value
         */
        function joinValueAndUnit(value, unit) {
            if (value === null || value === undefined || value === "") {
                return "";
            }
            return unit ? value + NBSP + unit : String(value);
        }

        /**
         * Localized name of one list value.
         *
         * @param {object[]} values allowed values of the attribute (`code`, `name`)
         * @param {string} code stored `listValue_code`
         * @returns {string} the name, or "" when there is no value or no match
         */
        function listValueName(values, code) {
            if (!code || !Array.isArray(values)) {
                return "";
            }
            const match = values.find(function (value) {
                return value.code === code;
            });
            return match ? match.name : "";
        }

        /**
         * Display text of a MULTI_LIST row: the names in the list order of the attribute, not the selection order.
         *
         * @param {object[]} values allowed values of the attribute, ordered by `position` on the server
         * @param {string[]} codes selected `value_code`s
         * @returns {string} names joined by ", ", or "" when nothing is selected
         */
        function joinSelectedNames(values, codes) {
            if (!Array.isArray(values) || !Array.isArray(codes) || codes.length === 0) {
                return "";
            }
            return values
                .filter(function (value) {
                    return codes.includes(value.code);
                })
                .map(function (value) {
                    return value.name;
                })
                .join(", ");
        }

        /**
         * What the selection sync must write.
         *
         * @param {string[]} stored `value_code`s of the row's selections
         * @param {string[]} selected keys of the multi combo box
         * @returns {{added: string[], removed: string[]}} codes to create and codes to delete
         */
        function diffSelections(stored, selected) {
            return {
                added: selected.filter(function (code) {
                    return !stored.includes(code);
                }),
                removed: stored.filter(function (code) {
                    return !selected.includes(code);
                })
            };
        }

        /**
         * Format options and constraints of the per-row Decimal type (PLAN D19): the attribute's scale for
         * DECIMAL, 0 for INTEGER, bounds from the attribute; no padding zeros in the display ("15", not "15.0").
         *
         * @param {object} attribute `valueType_code`, `scale`, `minValue`, `maxValue` of the row's attribute
         * @returns {{formatOptions: object, constraints: object}} settings for `sap.ui.model.odata.type.Decimal`
         */
        function numberTypeSettings(attribute) {
            const scale = attribute.valueType_code === "DECIMAL" ? Number(attribute.scale) || 0 : 0;
            const constraints = { precision: PRECISION, scale: scale };
            if (attribute.minValue !== null && attribute.minValue !== undefined) {
                constraints.minimum = String(attribute.minValue);
            }
            if (attribute.maxValue !== null && attribute.maxValue !== undefined) {
                constraints.maximum = String(attribute.maxValue);
            }
            return {
                formatOptions: { minFractionDigits: 0, maxFractionDigits: scale, preserveDecimals: false },
                constraints: constraints
            };
        }

        /**
         * Finds a fragment control by its role, starting at the root.
         *
         * @param {sap.m.VBox} root the fragment root
         * @param {string} role value of the `detailsRole` custom data
         * @returns {sap.ui.core.Control|undefined} the control
         */
        function findByRole(root, role) {
            return root.getItems().find(function (item) {
                return item.data(ROLE) === role;
            });
        }

        /**
         * Walks up from a field to the fragment root.
         *
         * @param {sap.ui.core.Element} element a control inside the fragment
         * @returns {sap.m.VBox|null} the root, or null when the element is detached
         */
        function findRoot(element) {
            let current = element;
            while (current && !(current.data && current.data(ROLE) === "root")) {
                current = current.getParent();
            }
            return current || null;
        }

        /**
         * The list binding of the form elements.
         *
         * @param {sap.m.VBox} root the fragment root
         * @returns {sap.ui.model.odata.v4.ODataListBinding|undefined} the `details` binding
         */
        function getRowsBinding(root) {
            const form = findByRole(root, "form");
            const container = form ? form.getFormContainers()[0] : undefined;
            return container ? container.getBinding("formElements") : undefined;
        }

        /**
         * Sets a text from the app bundle.
         *
         * @param {sap.m.Text} control the text control
         * @param {string} key i18n key
         * @param {any[]} args placeholder values
         */
        function setBundleText(control, key, args) {
            const model = control.getModel("i18n");
            if (!model) {
                return;
            }
            const apply = function (bundle) {
                control.setText(bundle.getText(key, args));
            };
            // getResourceBundle returns the bundle, or a promise while an async bundle is still loading
            const bundle = model.getResourceBundle();
            if (bundle && typeof bundle.then === "function") {
                bundle.then(apply);
            } else if (bundle) {
                apply(bundle);
            }
        }

        /**
         * Recomputes "Filled N of M" from the bound rows and switches the counter and the "no details" text
         * (browser proof B10). Shown only when the product has a subcategory.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function updateCounter(root) {
            const binding = getRowsBinding(root);
            const counter = findByRole(root, "counter");
            const noAttributes = findByRole(root, "noAttributes");
            if (!binding || !counter || !noAttributes) {
                return;
            }
            const rows = binding
                .getCurrentContexts()
                .filter(Boolean)
                .map(function (context) {
                    return context.getObject();
                });
            const result = countFilled(rows);
            const context = root.getBindingContext();
            const hasSubcategory = Boolean(context && context.getProperty("subcategory_code"));
            counter.setVisible(hasSubcategory && result.total > 0);
            noAttributes.setVisible(hasSubcategory && result.total === 0 && binding.isLengthFinal());
            setBundleText(counter, "ProductsObjectPage.details.filled", [result.filled, result.total]);
        }

        /**
         * Recomputes the counter from any control inside the fragment.
         *
         * @param {sap.ui.core.Element} element a field control
         */
        function updateCounterFrom(element) {
            const root = findRoot(element);
            if (root) {
                updateCounter(root);
            }
        }

        /**
         * `modelContextChange` of the fragment root: attaches the counter to the `details` binding once and
         * asks the product for its draft messages after a row PATCH, as Fiori Elements does after its own
         * field changes (browser proof B4), so server messages reach the fields.
         *
         * @param {sap.ui.base.Event} event the event of the root VBox
         */
        function onModelContextChange(event) {
            const root = event.getSource();
            const binding = getRowsBinding(root);
            if (binding && !wiredBindings.has(binding)) {
                wiredBindings.add(binding);
                binding.attachChange(function () {
                    updateCounter(root);
                });
                binding.attachPatchCompleted(function () {
                    updateCounter(root);
                    const product = root.getBindingContext();
                    if (product && product.getProperty("IsActiveEntity") === false) {
                        product.requestSideEffects([{ $PropertyPath: "DraftMessages" }]).catch(function () {
                            // the model reports a failed request in the message model
                        });
                    }
                });
            }
            updateCounter(root);
        }

        /**
         * `change` of a text or number input: the binding has written the value (or rejected it with a value
         * state); the counter follows.
         *
         * @param {sap.ui.base.Event} event the input's change event
         */
        function onValueChange(event) {
            updateCounterFrom(event.getSource());
        }

        /**
         * `change` of a list field: typed text that matches no item gets the error state (PLAN B6, SCREENS row 5).
         *
         * @param {sap.ui.base.Event} event the combo box change event
         */
        function onListChange(event) {
            const comboBox = event.getSource();
            const invalid = comboBox.getValue() !== "" && !comboBox.getSelectedKey();
            comboBox.setValueState(invalid ? "Error" : "None");
            updateCounterFrom(comboBox);
        }

        /**
         * List value codes of selection contexts.
         *
         * @param {sap.ui.model.odata.v4.Context[]} contexts contexts of the row's `selections` binding
         * @returns {string[]} their `value_code`s
         */
        function codesOf(contexts) {
            return contexts.map(function (context) {
                return context.getProperty(VALUE_CODE);
            });
        }

        /**
         * Aligns a multi combo box and its display text with the row's selections.
         *
         * @param {sap.m.MultiComboBox} multiComboBox the edit control
         * @param {sap.m.Text} display the display control
         */
        function syncSelections(multiComboBox, display) {
            const binding = multiComboBox.getBinding(SELECTIONS);
            const codes = binding ? codesOf(binding.getCurrentContexts().filter(Boolean)).filter(Boolean) : [];
            multiComboBox.setSelectedKeys(codes);
            const row = multiComboBox.getBindingContext();
            display.setText(joinSelectedNames(row ? row.getObject("attribute/values") : [], codes));
            updateCounterFrom(multiComboBox);
        }

        /**
         * `selectionFinish` of a multi combo box (PLAN B7): creates a selection for every added key and deletes
         * the selection of every removed key through the row's `selections` list binding, so the requests go to
         * `Products(...)/details(...)/selections`. Fired on popover close, on Enter after typing and on token delete.
         *
         * @param {sap.ui.base.Event} event the selectionFinish event
         */
        function onSelectionFinish(event) {
            const multiComboBox = event.getSource();
            const binding = multiComboBox.getBinding(SELECTIONS);
            if (!binding) {
                return;
            }
            const contexts = binding.getCurrentContexts().filter(Boolean);
            const change = diffSelections(codesOf(contexts), multiComboBox.getSelectedKeys());
            const resync = function () {
                updateCounterFrom(multiComboBox);
            };
            contexts
                .filter(function (context) {
                    return change.removed.includes(context.getProperty(VALUE_CODE));
                })
                .forEach(function (context) {
                    context.delete().then(resync, resync);
                });
            change.added.forEach(function (code) {
                // created without a refresh: the POST response carries every selected property
                binding.create({ [VALUE_CODE]: code }, true).created().then(resync, resync);
            });
        }

        /**
         * Display text of a LIST row; `this` is the display Text.
         *
         * @param {string} code stored `listValue_code`
         * @returns {string} the localized name of the value
         */
        function formatListValue(code) {
            const row = this.getBindingContext();
            return listValueName(row ? row.getObject("attribute/values") : [], code);
        }

        /**
         * Item template of the attribute's allowed values.
         *
         * @returns {object} aggregation binding info for `items`
         */
        function valuesBindingInfo() {
            return {
                path: "attribute/values",
                template: new Item({ key: { path: "code" }, text: { path: "name" } }),
                templateShareable: false
            };
        }

        /**
         * Display control of a field: label above the value, empty indicator for no value.
         *
         * @param {string} id id of the form element
         * @param {object} [text] binding info of the text, none for MULTI_LIST
         * @returns {sap.m.Text} the display text
         */
        function createDisplay(id, text) {
            const settings = {
                emptyIndicatorMode: "On",
                visible: { path: "ui>/isEditable", formatter: isDisplayMode }
            };
            if (text) {
                settings.text = text;
            }
            return new Text(id + "-display", settings);
        }

        /**
         * Edit and display controls of one row by the attribute's value type. The edit control comes first,
         * so the FormElement assigns its label to it.
         *
         * @param {string} id id of the form element
         * @param {object} attribute the row's attribute
         * @returns {sap.ui.core.Control[]} fields of the form element
         */
        function createFields(id, attribute) {
            const unit = attribute.unit || "";
            const editVisible = { path: "ui>/isEditable", formatter: isEditMode };
            const errorText = { path: "i18n>ProductsObjectPage.details.valueNotInList" };
            switch (attribute.valueType_code) {
                case "TEXT":
                    return [
                        new Input(id + "-edit", {
                            value: { path: "textValue" },
                            maxLength: 100,
                            description: unit,
                            fieldWidth: unit ? "75%" : "100%",
                            visible: editVisible,
                            change: onValueChange
                        }),
                        createDisplay(id, {
                            path: "textValue",
                            formatter: function (value) {
                                return joinValueAndUnit(value, unit);
                            }
                        })
                    ];
                case "INTEGER":
                case "DECIMAL": {
                    const settings = numberTypeSettings(attribute);
                    return [
                        new Input(id + "-edit", {
                            value: {
                                path: "numberValue",
                                type: new Decimal(settings.formatOptions, settings.constraints)
                            },
                            textAlign: "End",
                            description: unit,
                            fieldWidth: unit ? "75%" : "100%",
                            visible: editVisible,
                            change: onValueChange
                        }),
                        createDisplay(id, {
                            path: "numberValue",
                            type: new Decimal(settings.formatOptions, settings.constraints),
                            formatter: function (value) {
                                return joinValueAndUnit(value, unit);
                            }
                        })
                    ];
                }
                case "LIST":
                    return [
                        new ComboBox(id + "-edit", {
                            selectedKey: { path: "listValue_code" },
                            items: valuesBindingInfo(),
                            showClearIcon: true,
                            valueStateText: errorText,
                            visible: editVisible,
                            change: onListChange
                        }),
                        createDisplay(id, { path: "listValue_code", formatter: formatListValue })
                    ];
                case "MULTI_LIST": {
                    // the binding events below run after construction, when parts.edit is set
                    const parts = { display: createDisplay(id) };
                    const sync = {
                        change: function () {
                            syncSelections(parts.edit, parts.display);
                        }
                    };
                    parts.edit = new MultiComboBox(id + "-edit", {
                        items: Object.assign(valuesBindingInfo(), { events: sync }),
                        // the row's selections as a list binding without its own request (data of the section
                        // binding's $expand); selectionFinish creates and deletes its contexts
                        [SELECTIONS]: {
                            path: "selections",
                            template: new Item({ key: { path: VALUE_CODE } }),
                            templateShareable: false,
                            events: sync
                        },
                        showClearIcon: true,
                        valueStateText: errorText,
                        visible: editVisible,
                        selectionFinish: onSelectionFinish
                    });
                    return [parts.edit, parts.display];
                }
                default:
                    return [createDisplay(id, { path: "textValue" })];
            }
        }

        /**
         * Factory of the `formElements` aggregation (PLAN B1): one form element per detail row, label = the
         * localized attribute name, fields by `attribute/valueType_code`.
         *
         * @param {string} id id proposed by the aggregation binding
         * @param {sap.ui.model.odata.v4.Context} context the row context
         * @returns {sap.ui.layout.form.FormElement} the form element of the row
         */
        function createFormElement(id, context) {
            const row = context.getObject() || {};
            return new FormElement(id, {
                label: new Label(id + "-label", { text: { path: "attribute/name" } }),
                fields: createFields(id, row.attribute || {})
            });
        }

        return {
            createFormElement: createFormElement,
            onModelContextChange: onModelContextChange,
            isFilled: isFilled,
            countFilled: countFilled,
            joinValueAndUnit: joinValueAndUnit,
            listValueName: listValueName,
            joinSelectedNames: joinSelectedNames,
            diffSelections: diffSelections,
            numberTypeSettings: numberTypeSettings
        };
    }
);
