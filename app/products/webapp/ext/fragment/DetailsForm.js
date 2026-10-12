sap.ui.define(
    [
        "sap/base/Log",
        "sap/ui/core/library",
        "sap/ui/core/Item",
        "sap/ui/core/Messaging",
        "sap/ui/core/message/ControlMessageProcessor",
        "sap/ui/core/message/Message",
        "sap/ui/core/message/MessageType",
        "sap/ui/layout/form/ColumnElementData",
        "sap/ui/layout/form/FormElement",
        "sap/ui/model/odata/type/Decimal",
        "sap/m/ComboBox",
        "sap/m/Input",
        "sap/m/Label",
        "sap/m/MultiComboBox",
        "sap/m/Text"
    ],
    // eslint-disable-next-line max-params, max-statements -- one parameter per UI5 class the factory creates, one statement per named function of the section module (ADR-0027 decision 5)
    function (
        Log,
        coreLibrary,
        Item,
        Messaging,
        ControlMessageProcessor,
        Message,
        MessageType,
        ColumnElementData,
        FormElement,
        Decimal,
        ComboBox,
        Input,
        Label,
        MultiComboBox,
        Text
    ) {
        "use strict";

        /**
         * Module of the custom section "Details" (ADR-0027 decision 5 and its amendment "Browser proof of the
         * fragment"): a factory builds one form element per detail row of the product by the attribute's value
         * type; the fragment names no attribute. Rows come from the server in `position` order (no client sorter).
         */

        /** Custom data key that marks the fragment controls this module looks up (root, form, counter, noAttributes). */
        const ROLE = "detailsRole";
        /** Foreign key of a LIST row to its list value. */
        const LIST_VALUE = "listValue_code";
        /** Foreign key of a `ProductDetailSelections` row to its list value. */
        const VALUE_CODE = "value_code";
        /** Aggregation of the multi combo box that holds the row's own `selections` binding (not rendered). */
        const SELECTIONS = "dependents";
        /** Precision of `ProductDetails.numberValue` (Decimal(15, 3)). */
        const PRECISION = 15;
        /** No-break space between a value and its unit, so they never wrap apart (SCREENS "Fields per value type"). */
        const NBSP = String.fromCharCode(0xa0);
        /** i18n key of the error of a list field whose text matches no item (SCREENS "Value states" row 5). */
        const NOT_IN_LIST = "ProductsObjectPage.details.valueNotInList";
        /** Log component of this module. */
        const LOG_COMPONENT = "products.ext.fragment.DetailsForm";
        /** Value states of the counter (the `ValueState` enum of the core library, no string literals). */
        const ValueState = coreLibrary.ValueState;
        /** Icon of the counter when every field is filled. */
        const ICON_COMPLETE = "sap-icon://sys-enter-2";
        /** Icon of the counter while a field is empty. */
        const ICON_INCOMPLETE = "sap-icon://alert";
        /** The `details` list binding keeps its identity across Object Page contexts, so its handler is attached once. */
        const wiredBindings = new WeakSet();
        /** Draft product contexts whose rows were re-read after Edit (ruling B2); a new Edit brings a new context. */
        const refreshedDrafts = new WeakSet();
        /** Client validation message of each list field with a text that matches no item (ruling B6). */
        const listMessages = new Map();
        /** Fragment roots whose labels already follow the edit state. */
        const editModeWatched = new WeakSet();
        /** Serial of the form element ids: an id is never reused for another row. */
        let rowSerial = 0;

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
         * @param {object} row detail row as read by the section binding, with `attribute`
         * @param {number} [selectionCount] number of selections of a MULTI_LIST row, read from its own binding
         * @returns {boolean} TEXT non-empty after trimming, a number, a list value, or at least one selection
         */
        function isFilled(row, selectionCount) {
            const type = row && row.attribute ? row.attribute.valueType_code : undefined;
            switch (type) {
                case "TEXT":
                    return typeof row.textValue === "string" && row.textValue.trim() !== "";
                case "INTEGER":
                case "DECIMAL":
                    return row.numberValue !== null && row.numberValue !== undefined && row.numberValue !== "";
                case "LIST":
                    return Boolean(row[LIST_VALUE]);
                case "MULTI_LIST":
                    return typeof selectionCount === "number" && selectionCount > 0;
                default:
                    return false;
            }
        }

        /**
         * Counts filled rows.
         *
         * @param {object[]} rows detail rows of one product
         * @param {Array<number|undefined>} [selectionCounts] selections per row, same order as `rows`
         * @returns {{filled: number, total: number}} N and M of "Filled N of M"
         */
        function countFilled(rows, selectionCounts) {
            const list = Array.isArray(rows) ? rows : [];
            const counts = Array.isArray(selectionCounts) ? selectionCounts : [];
            const filled = list.filter(function (row, index) {
                return isFilled(row, counts[index]);
            });
            return { filled: filled.length, total: list.length };
        }

        /**
         * Semantic state and icon of the counter "Filled N of M" (SCREENS "Title, counter, layout", variant A):
         * Success with a check mark when every field is filled, Warning with an alert sign otherwise, 0 filled
         * included. With no fields (M = 0) the counter is hidden; the result is then Warning.
         *
         * @param {number} filled N, the number of filled fields
         * @param {number} total M, the number of fields shown
         * @returns {{state: sap.ui.core.ValueState, icon: string}} `state` and `icon` of the `sap.m.ObjectStatus`
         */
        function counterStatus(filled, total) {
            if (total > 0 && filled === total) {
                return { state: ValueState.Success, icon: ICON_COMPLETE };
            }
            return { state: ValueState.Warning, icon: ICON_INCOMPLETE };
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
         * Meaning of the text of a list field when it is committed (ruling B6): an empty text clears the value,
         * the text of the selected item stands for its key, any other text is no value of the list.
         *
         * @param {string} text value of the combo box at the commit
         * @param {{key: string, text: string}|null} selected key and text of the selected item, or null
         * @returns {{valid: boolean, key: (string|null)}} whether the text is a value and the key to store
         */
        function resolveListText(text, selected) {
            if (!text) {
                return { valid: true, key: null };
            }
            if (selected && selected.text === text) {
                return { valid: true, key: selected.key };
            }
            return { valid: false, key: null };
        }

        /**
         * Whether a list key differs from the stored one; an empty key and no key are the same.
         *
         * @param {string|null|undefined} stored the stored `listValue_code`
         * @param {string|null} key the key to store
         * @returns {boolean} true when a write is needed
         */
        function isDifferentKey(stored, key) {
            return (stored || null) !== (key || null);
        }

        /**
         * Whether a product context is a draft whose rows the server may have filled after the Edit response
         * (ruling B2, PLAN D13): only a draft with a subcategory has rows.
         *
         * @param {any} isActiveEntity value of `IsActiveEntity`, undefined while not loaded
         * @param {any} subcategoryCode value of `subcategory_code`, undefined while not loaded
         * @returns {boolean} true for a loaded draft with a subcategory
         */
        function isDraftWithSubcategory(isActiveEntity, subcategoryCode) {
            return isActiveEntity === false && Boolean(subcategoryCode);
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
         * Rejection handler of a request whose failure the OData model has already put into the message model.
         *
         * @param {Error} error the rejection reason
         */
        function ignoreReported(error) {
            Log.debug("Request failed, reported by the OData model", error && error.message, LOG_COMPONENT);
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
         * The form container whose form elements are the rows.
         *
         * @param {sap.m.VBox} root the fragment root
         * @returns {sap.ui.layout.form.FormContainer|undefined} the container
         */
        function getContainer(root) {
            const form = findByRole(root, "form");
            return form ? form.getFormContainers()[0] : undefined;
        }

        /**
         * The list binding of the rows (in the container's non-rendered `dependents`).
         *
         * @param {sap.m.VBox} root the fragment root
         * @returns {sap.ui.model.odata.v4.ODataListBinding|undefined} the `details` binding
         */
        function getRowsBinding(root) {
            const container = getContainer(root);
            return container ? container.getBinding("dependents") : undefined;
        }

        /**
         * Whether the Object Page is in edit mode.
         *
         * @param {sap.m.VBox} root the fragment root
         * @returns {boolean} the value of `ui>/isEditable`
         */
        function isEditableRoot(root) {
            const ui = root.getModel("ui");
            return Boolean(ui) && ui.getProperty("/isEditable") === true;
        }

        /**
         * Points the label of a row at its edit control in edit mode only (PLAN criterion 70): in display mode the
         * edit control is not rendered, so the label falls back to the form element's first field, the display
         * text, which writes no `for` attribute (`sap.m.Text` has no labelable HTML element).
         *
         * @param {sap.ui.layout.form.FormElement} formElement the form element of a row
         * @param {boolean} editable whether the page is in edit mode
         */
        function applyLabelTarget(formElement, editable) {
            const label = formElement.getLabel();
            const edit = formElement.getFields().find(function (field) {
                return !field.isA("sap.m.Text");
            });
            if (label && typeof label.setLabelFor === "function") {
                label.setLabelFor(editable && edit ? edit : null);
            }
        }

        /**
         * Applies the label targets of all rows for the current edit state.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function applyLabelTargets(root) {
            const container = getContainer(root);
            if (!container) {
                return;
            }
            const editable = isEditableRoot(root);
            container.getFormElements().forEach(function (formElement) {
                applyLabelTarget(formElement, editable);
            });
        }

        /**
         * Lets the labels follow the edit state of the page (`ui>/isEditable`), once per fragment root.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function watchEditMode(root) {
            const ui = root.getModel("ui");
            if (!ui || editModeWatched.has(root)) {
                return;
            }
            editModeWatched.add(root);
            ui.bindProperty("/isEditable").attachChange(function () {
                applyLabelTargets(root);
            });
        }

        /**
         * Runs a callback with the app resource bundle of a control.
         *
         * @param {sap.ui.core.Control} control a control that sees the `i18n` model
         * @param {function(sap.base.i18n.ResourceBundle): void} apply callback with the bundle
         */
        function withBundle(control, apply) {
            const model = control.getModel("i18n");
            if (!model) {
                return;
            }
            // getResourceBundle returns the bundle, or a promise while an async bundle is still loading
            const bundle = model.getResourceBundle();
            if (bundle && typeof bundle.then === "function") {
                bundle.then(apply);
            } else if (bundle) {
                apply(bundle);
            }
        }

        /**
         * The draft product the fragment shows, if it shows a draft.
         *
         * @param {sap.ui.core.Element} element a control inside the fragment
         * @returns {sap.ui.model.odata.v4.Context|null} the draft product context
         */
        function draftProductOf(element) {
            const root = findRoot(element);
            const product = root ? root.getBindingContext() : null;
            return product && product.getProperty("IsActiveEntity") === false ? product : null;
        }

        /**
         * Requests side effects on the product context; a synchronous refusal of the model is logged, not thrown,
         * so a field handler never breaks the page.
         *
         * @param {sap.ui.model.odata.v4.Context} product the product context
         * @param {object[]} paths `$PropertyPath` or `$NavigationPropertyPath` objects
         * @returns {boolean} whether the request was accepted
         */
        function requestOnProduct(product, paths) {
            try {
                product.requestSideEffects(paths).catch(ignoreReported);
                return true;
            } catch (error) {
                Log.warning("Side effects not requested", error.message, LOG_COMPONENT);
                return false;
            }
        }

        /**
         * Reads the draft messages of the product after a field write (PLAN D-2), as Fiori elements does after
         * its own field changes: the `GET ...?$select=DraftMessages` joins the write's `$auto` batch, so a server
         * message of the row reaches its field at once.
         *
         * @param {sap.ui.core.Element} element the field that wrote
         */
        function requestDraftMessages(element) {
            const product = draftProductOf(element);
            if (product) {
                requestOnProduct(product, [{ $PropertyPath: "DraftMessages" }]);
            }
        }

        /**
         * Re-reads the rows once per draft context after Edit (ruling B2): the `draftEdit` response of a product
         * without rows carries `details: []`, the server's `after('EDIT')` fill comes later. Since the rows binding
         * has its own request (`$$ownRequest`), it reads the draft rows itself when Fiori elements sets the draft
         * context, which is after the `draftEdit` response; this side effect of `details` on the product context
         * is kept as a safety net until a browser proof of a product created through the API shows it redundant.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function refreshRowsOfNewDraft(root) {
            const product = root.getBindingContext();
            if (!product || refreshedDrafts.has(product)) {
                return;
            }
            if (!isDraftWithSubcategory(product.getProperty("IsActiveEntity"), product.getProperty("subcategory_code"))) {
                return;
            }
            if (requestOnProduct(product, [{ $NavigationPropertyPath: "details" }])) {
                refreshedDrafts.add(product);
            }
        }

        /**
         * `value_code`s of the row's selections, read from the multi combo box's own binding (ruling B7).
         *
         * @param {sap.m.MultiComboBox} multiComboBox the edit control of a MULTI_LIST row
         * @returns {string[]} the selected codes, in selection order
         */
        function selectedCodes(multiComboBox) {
            const binding = multiComboBox.getBinding(SELECTIONS);
            if (!binding) {
                return [];
            }
            return binding
                .getCurrentContexts()
                .filter(Boolean)
                .map(function (context) {
                    return context.getProperty(VALUE_CODE);
                })
                .filter(Boolean);
        }

        /**
         * Number of selections of the row shown by a form element, if it is a MULTI_LIST row.
         *
         * @param {sap.ui.layout.form.FormElement} [formElement] the form element of the row
         * @returns {number|undefined} the count, undefined for other value types
         */
        function selectionCountOf(formElement) {
            const multiComboBox = formElement
                ? formElement.getFields().find(function (field) {
                      return field.isA("sap.m.MultiComboBox");
                  })
                : undefined;
            return multiComboBox ? selectedCodes(multiComboBox).length : undefined;
        }

        /**
         * Recomputes "Filled N of M" from the bound rows, sets the counter's text, state and icon (`counterStatus`)
         * and switches the counter and the "no details" text (browser proof B10). Shown only when the product has
         * a subcategory.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function updateCounter(root) {
            const binding = getRowsBinding(root);
            const container = getContainer(root);
            const counter = findByRole(root, "counter");
            const noAttributes = findByRole(root, "noAttributes");
            if (!binding || !container || !counter || !noAttributes) {
                return;
            }
            const contexts = binding.getCurrentContexts().filter(Boolean);
            const formElements = container.getFormElements();
            const rows = contexts.map(function (context) {
                return context.getObject();
            });
            const selectionCounts = contexts.map(function (context) {
                return selectionCountOf(
                    formElements.find(function (formElement) {
                        return formElement.getBindingContext() === context;
                    })
                );
            });
            const result = countFilled(rows, selectionCounts);
            const product = root.getBindingContext();
            const hasSubcategory = Boolean(product && product.getProperty("subcategory_code"));
            const status = counterStatus(result.filled, result.total);
            counter.setVisible(hasSubcategory && result.total > 0);
            counter.setState(status.state);
            counter.setIcon(status.icon);
            noAttributes.setVisible(hasSubcategory && result.total === 0 && binding.isLengthFinal());
            withBundle(counter, function (bundle) {
                counter.setText(bundle.getText("ProductsObjectPage.details.filled", [result.filled, result.total]));
            });
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
         * Removes the "not in the list" message of a list field, if it has one.
         *
         * @param {sap.m.ComboBox} comboBox the list field
         */
        function removeListMessage(comboBox) {
            const entry = listMessages.get(comboBox);
            if (entry) {
                listMessages.delete(comboBox);
                Messaging.removeMessages(entry.message);
            }
        }

        /**
         * Adds the "not in the list" message to a list field (ruling B6): a client validation message on the
         * control's `selectedKey`, shaped like the framework's own type errors, so the field shows the Error state
         * with its text, the message popover lists it under the field label and Fiori elements blocks Save; a
         * `DraftMessages` read does not remove it. The stored value is not touched.
         *
         * @param {sap.m.ComboBox} comboBox the list field
         */
        function showNotInList(comboBox) {
            removeListMessage(comboBox);
            const row = comboBox.getBindingContext();
            withBundle(comboBox, function (bundle) {
                if (comboBox.isDestroyed()) {
                    return;
                }
                const message = new Message({
                    message: bundle.getText(NOT_IN_LIST),
                    type: MessageType.Error,
                    target: comboBox.getId() + "/selectedKey",
                    processor: new ControlMessageProcessor(),
                    validation: true
                });
                listMessages.set(comboBox, { message: message, rowPath: row ? row.getPath() : "" });
                Messaging.addMessages(message);
            });
        }

        /**
         * Removes the messages of list fields that are gone: a row that leaves the `details` binding (subcategory
         * change, Discard, Save) loses its form element, and a message must not outlive its control object.
         */
        function removeOrphanedListMessages() {
            listMessages.forEach(function (entry, comboBox) {
                if (comboBox.isDestroyed()) {
                    removeListMessage(comboBox);
                }
            });
        }

        /**
         * `modelContextChange` of a list field: a message never outlives the row it was raised on.
         *
         * @param {sap.ui.base.Event} event the event of the combo box
         */
        function onListContextChange(event) {
            const comboBox = event.getSource();
            const entry = listMessages.get(comboBox);
            const row = comboBox.getBindingContext();
            if (entry && (!row || row.getPath() !== entry.rowPath)) {
                removeListMessage(comboBox);
            }
        }

        /**
         * `change` of a list field (ruling B6), fired on Enter, focus leave and a list choice, never per typed
         * character: `selectedKey` is bound one-way, so only this handler writes `listValue_code`, through the row
         * context. Empty text writes null, the text of the selected item writes its key, any other text writes
         * nothing and raises the field's message.
         *
         * @param {sap.ui.base.Event} event the combo box change event
         */
        function onListChange(event) {
            const comboBox = event.getSource();
            const item = comboBox.getSelectedItem();
            const commit = resolveListText(
                comboBox.getValue(),
                item ? { key: item.getKey(), text: item.getText() } : null
            );
            if (!commit.valid) {
                showNotInList(comboBox);
                return;
            }
            removeListMessage(comboBox);
            const row = comboBox.getBindingContext();
            if (row && isDifferentKey(row.getProperty(LIST_VALUE), commit.key)) {
                const update = function () {
                    updateCounterFrom(comboBox);
                };
                row.setProperty(LIST_VALUE, commit.key).then(update, ignoreReported);
                requestDraftMessages(comboBox);
            }
            updateCounterFrom(comboBox);
        }

        /**
         * Whether the value of an input passed its binding type, so the binding wrote it to the model.
         *
         * @param {sap.m.Input} input a text or number input
         * @returns {boolean} false while the input shows a client type error
         */
        function hasValidValue(input) {
            const binding = input.getBinding("value");
            return Boolean(binding) && binding.getDataState().getInvalidValue() === undefined;
        }

        /**
         * `change` of a text or number input: the binding has written the value (or rejected it with a client
         * message); the draft messages are read after a write and the counter follows.
         *
         * @param {sap.ui.base.Event} event the input's change event
         */
        function onValueChange(event) {
            const input = event.getSource();
            if (hasValidValue(input)) {
                requestDraftMessages(input);
            }
            updateCounterFrom(input);
        }

        /**
         * The display text of the form element a field belongs to.
         *
         * @param {sap.ui.core.Control} field the edit control
         * @returns {sap.m.Text|undefined} the display control
         */
        function displayOf(field) {
            const formElement = field.getParent();
            if (!formElement || !formElement.getFields) {
                return undefined;
            }
            return formElement.getFields().find(function (control) {
                return control !== field && control.isA("sap.m.Text");
            });
        }

        /**
         * Aligns a multi combo box, its display text and the counter with the row's selections (ruling B7).
         * Runs on every change of the selections binding; the keys are set only when they differ.
         *
         * @param {sap.m.MultiComboBox} multiComboBox the edit control of a MULTI_LIST row
         */
        function syncSelections(multiComboBox) {
            if (multiComboBox.isDestroyed()) {
                return;
            }
            const codes = selectedCodes(multiComboBox);
            // setSelectedKeys removes and recreates every token; only when the keys differ, so a token removed by
            // the keyboard (Backspace twice) does not take the focus with it (REVIEW R2-D6)
            const delta = diffSelections(multiComboBox.getSelectedKeys(), codes);
            if (delta.added.length > 0 || delta.removed.length > 0) {
                multiComboBox.setSelectedKeys(codes);
            }
            const display = displayOf(multiComboBox);
            const row = multiComboBox.getBindingContext();
            if (display) {
                display.setText(joinSelectedNames(row ? row.getObject("attribute/values") : [], codes));
            }
            updateCounterFrom(multiComboBox);
        }

        /**
         * `selectionFinish` of a multi combo box (ruling B7): creates a selection for every added key and deletes
         * the selection of every removed key through the row's own `selections` binding, so the requests go to
         * `Products(...)/details(...)/selections` (`POST` 201, `DELETE` 204, measured). The binding's change
         * event then syncs the keys, the display text and the counter.
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
            const change = diffSelections(
                contexts.map(function (context) {
                    return context.getProperty(VALUE_CODE);
                }),
                multiComboBox.getSelectedKeys()
            );
            if (change.added.length === 0 && change.removed.length === 0) {
                return;
            }
            contexts
                .filter(function (context) {
                    return change.removed.includes(context.getProperty(VALUE_CODE));
                })
                .forEach(function (context) {
                    context.delete().catch(ignoreReported);
                });
            change.added.forEach(function (code) {
                // created without a refresh: the POST response carries every selected property
                binding.create({ [VALUE_CODE]: code }, true).created().catch(ignoreReported);
            });
            requestDraftMessages(multiComboBox);
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
         * Layout data that gives a field the whole width of its form column under the label (PLAN D-5): the
         * `ColumnLayout` splits the cells of an element among all its fields, the hidden one included, so without
         * it the display text sits in the right half and the input is half as wide as the Fiori elements fields.
         *
         * @returns {sap.ui.layout.form.ColumnElementData} new layout data, one per field
         */
        function fullRow() {
            return new ColumnElementData({ cellsSmall: 12, cellsLarge: 12 });
        }

        /**
         * Binding info of the edit-mode visibility.
         *
         * @returns {object} binding info for `visible`
         */
        function editModeBinding() {
            return { path: "ui>/isEditable", formatter: isEditMode };
        }

        /**
         * Items of a list field: the attribute's allowed values as the row's `$expand` delivers them, already in
         * the server's `position` order (SCREENS "Texts"; no client sorter, PLAN step 8). Not a binding: the values
         * are a read-only code list, and a binding below the row would be reset by every side-effect request of
         * the product (`refreshDependentListBindingsWithoutCache`), which recreates the selected tokens and drops
         * the focus of a token (REVIEW R2-D6). Set through setters, so a name is never parsed as binding syntax.
         *
         * @param {object[]} [values] `code` and `name` of the allowed values
         * @returns {sap.ui.core.Item[]} one item per value
         */
        function createValueItems(values) {
            return (Array.isArray(values) ? values : []).map(function (value) {
                return new Item().setKey(value.code).setText(value.name);
            });
        }

        /**
         * Display control of a field: the value under its label, empty indicator for no value.
         *
         * @param {string} id id of the form element
         * @param {object} [text] binding info of the text, none for MULTI_LIST (set by the selection sync)
         * @returns {sap.m.Text} the display text
         */
        function createDisplay(id, text) {
            const settings = {
                emptyIndicatorMode: "On",
                visible: { path: "ui>/isEditable", formatter: isDisplayMode },
                layoutData: fullRow()
            };
            if (text) {
                settings.text = text;
            }
            return new Text(id + "-display", settings);
        }

        /**
         * Edit control of a TEXT row.
         *
         * @param {string} id id of the form element
         * @param {string} unit unit of the attribute, or ""
         * @returns {sap.m.Input} the input
         */
        function createTextInput(id, unit) {
            return new Input(id + "-edit", {
                value: { path: "textValue" },
                maxLength: 100,
                description: unit,
                fieldWidth: unit ? "75%" : "100%",
                visible: editModeBinding(),
                change: onValueChange,
                layoutData: fullRow()
            });
        }

        /**
         * Edit control of an INTEGER or DECIMAL row, with the per-row Decimal type (browser proof B5).
         *
         * @param {string} id id of the form element
         * @param {string} unit unit of the attribute, or ""
         * @param {{formatOptions: object, constraints: object}} settings result of `numberTypeSettings`
         * @returns {sap.m.Input} the input
         */
        function createNumberInput(id, unit, settings) {
            return new Input(id + "-edit", {
                value: { path: "numberValue", type: new Decimal(settings.formatOptions, settings.constraints) },
                textAlign: "End",
                description: unit,
                fieldWidth: unit ? "75%" : "100%",
                visible: editModeBinding(),
                change: onValueChange,
                layoutData: fullRow()
            });
        }

        /**
         * Edit control of a LIST row (ruling B6): the key is bound one-way, `change` writes it.
         *
         * @param {string} id id of the form element
         * @param {object[]} values allowed values of the attribute
         * @returns {sap.m.ComboBox} the combo box
         */
        function createListBox(id, values) {
            return new ComboBox(id + "-edit", {
                selectedKey: { path: LIST_VALUE, mode: "OneWay" },
                items: createValueItems(values),
                showClearIcon: true,
                visible: editModeBinding(),
                change: onListChange,
                modelContextChange: onListContextChange,
                layoutData: fullRow()
            });
        }

        /**
         * Edit control of a MULTI_LIST row (ruling B7): the row's selections are an own-request list binding in
         * the `dependents` aggregation, rebound with the row and destroyed with the control; no value state text
         * (PLAN D-6), so the flash of an invalid character shows the framework text.
         *
         * @param {string} id id of the form element
         * @param {object[]} values allowed values of the attribute
         * @returns {sap.m.MultiComboBox} the multi combo box
         */
        function createMultiListBox(id, values) {
            // the binding events below fire after construction, when holder.control is set
            const holder = {};
            const sync = function () {
                if (holder.control) {
                    syncSelections(holder.control);
                }
            };
            holder.control = new MultiComboBox(id + "-edit", {
                items: createValueItems(values),
                [SELECTIONS]: {
                    path: "selections",
                    parameters: { $$ownRequest: true, $select: "ID,IsActiveEntity," + VALUE_CODE },
                    template: new Item({ key: { path: VALUE_CODE } }),
                    templateShareable: false,
                    events: { change: sync }
                },
                showClearIcon: true,
                visible: editModeBinding(),
                selectionFinish: onSelectionFinish,
                layoutData: fullRow()
            });
            return holder.control;
        }

        /**
         * Edit and display controls of one row by the attribute's value type.
         *
         * @param {string} id id of the form element
         * @param {object} attribute the row's attribute
         * @returns {{edit: (sap.ui.core.Control|undefined), display: sap.m.Text}} the controls of the row
         */
        function createFields(id, attribute) {
            const unit = attribute.unit || "";
            switch (attribute.valueType_code) {
                case "TEXT":
                    return {
                        edit: createTextInput(id, unit),
                        display: createDisplay(id, {
                            path: "textValue",
                            formatter: function (value) {
                                return joinValueAndUnit(value, unit);
                            }
                        })
                    };
                case "INTEGER":
                case "DECIMAL": {
                    const settings = numberTypeSettings(attribute);
                    return {
                        edit: createNumberInput(id, unit, settings),
                        display: createDisplay(id, {
                            path: "numberValue",
                            type: new Decimal(settings.formatOptions, settings.constraints),
                            formatter: function (value) {
                                return joinValueAndUnit(value, unit);
                            }
                        })
                    };
                }
                case "LIST":
                    return {
                        edit: createListBox(id, attribute.values),
                        display: createDisplay(id, { path: LIST_VALUE, formatter: formatListValue })
                    };
                case "MULTI_LIST":
                    return { edit: createMultiListBox(id, attribute.values), display: createDisplay(id) };
                default:
                    return { edit: undefined, display: createDisplay(id, { path: "textValue" }) };
            }
        }

        /**
         * Builds the form element of one row (called by `syncFormElements`): label = the localized attribute name,
         * fields by `attribute/valueType_code`. The display control comes first, so in display mode the hidden
         * edit control's empty cell lies below the value, not between label and value (PLAN D-5); the label
         * names the edit control only in edit mode (`applyLabelTarget`).
         *
         * @param {string} id id of the form element
         * @param {sap.ui.model.odata.v4.Context} context the row context
         * @returns {sap.ui.layout.form.FormElement} the form element of the row
         */
        function createFormElement(id, context) {
            const row = context.getObject() || {};
            const fields = createFields(id, row.attribute || {});
            return new FormElement(id, {
                label: new Label(id + "-label", { text: { path: "attribute/name" } }),
                fields: fields.edit ? [fields.display, fields.edit] : [fields.display]
            });
        }

        /**
         * Aligns the form elements with the row contexts of the `details` binding (PLAN R2-D2): the element of a
         * row that stays is kept with its controls, its focus, its own `selections` binding and its list message;
         * a new row gets a new element, a row that is gone loses its element, and the order follows the server's
         * `position` order. A list binding with a factory would destroy and rebuild every element on each change
         * of the binding (`ManagedObject#updateAggregation` without extended change detection).
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function syncFormElements(root) {
            const container = getContainer(root);
            const binding = getRowsBinding(root);
            if (!container || !binding) {
                return;
            }
            const contexts = binding.getCurrentContexts().filter(Boolean);
            container.getFormElements().forEach(function (formElement) {
                if (!contexts.includes(formElement.getBindingContext())) {
                    container.removeFormElement(formElement);
                    formElement.destroy();
                }
            });
            const editable = isEditableRoot(root);
            contexts.forEach(function (context, index) {
                let formElement = container.getFormElements().find(function (element) {
                    return element.getBindingContext() === context;
                });
                if (!formElement) {
                    rowSerial += 1;
                    formElement = createFormElement(container.getId() + "-row" + rowSerial, context);
                    formElement.setBindingContext(context);
                    applyLabelTarget(formElement, editable);
                    container.insertFormElement(formElement, index);
                } else if (container.indexOfFormElement(formElement) !== index) {
                    container.removeFormElement(formElement);
                    container.insertFormElement(formElement, index);
                }
            });
        }

        /**
         * Destroys every form element when the `details` collection is refreshed (its `refresh` event: the
         * `#SubcategoryChanged` side effect, the Edit re-read of ruling B2, a new product context). The event
         * fires inside the binding's reset, before the model refreshes the dependent bindings of the old rows;
         * destroyed bindings are skipped there, so a row the server has just deleted sends no `GET` of its
         * `selections` or values (a 404 would open an error dialog). The following `change` builds the rows again.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function clearFormElements(root) {
            const container = getContainer(root);
            if (container) {
                container.destroyFormElements();
            }
            removeOrphanedListMessages();
        }

        /**
         * Attaches the module to the `details` binding once: after a refresh the rows are built again; after
         * each change the form elements follow the rows, the messages of destroyed list fields go and the
         * counter is recomputed.
         *
         * @param {sap.m.VBox} root the fragment root
         */
        function wireRowsBinding(root) {
            const binding = getRowsBinding(root);
            if (binding && !wiredBindings.has(binding)) {
                wiredBindings.add(binding);
                binding.attachEvent("refresh", function () {
                    clearFormElements(root);
                });
                binding.attachChange(function () {
                    syncFormElements(root);
                    removeOrphanedListMessages();
                    updateCounter(root);
                });
            }
        }

        /**
         * `modelContextChange` of the fragment root: wires the `details` binding and the edit state, aligns the
         * rows, re-reads the rows of a draft just entered by Edit (ruling B2) and updates the counter.
         *
         * @param {sap.ui.base.Event} event the event of the root VBox
         */
        function onModelContextChange(event) {
            const root = event.getSource();
            wireRowsBinding(root);
            watchEditMode(root);
            syncFormElements(root);
            removeOrphanedListMessages();
            refreshRowsOfNewDraft(root);
            updateCounter(root);
        }

        return {
            onModelContextChange: onModelContextChange,
            isFilled: isFilled,
            countFilled: countFilled,
            counterStatus: counterStatus,
            joinValueAndUnit: joinValueAndUnit,
            listValueName: listValueName,
            joinSelectedNames: joinSelectedNames,
            diffSelections: diffSelections,
            resolveListText: resolveListText,
            isDifferentKey: isDifferentKey,
            isDraftWithSubcategory: isDraftWithSubcategory,
            numberTypeSettings: numberTypeSettings
        };
    }
);
