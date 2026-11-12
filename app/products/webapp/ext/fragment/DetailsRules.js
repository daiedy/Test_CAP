sap.ui.define(
    ["sap/m/MessageToast", "sap/ui/core/library", "sap/ui/model/odata/type/Decimal"],
    function (MessageToast, coreLibrary, Decimal) {
        "use strict";

        /**
         * Row rules of the custom section "Details" (ADR-0027 decision 5, ADR-0028 decisions 5, 8, 10): the pure
         * functions behind the counter, the per-row Decimal type, the required marker, the range hint and the
         * dependency of a row on a list value, plus the one notification of a cleared row. No control of the form is
         * created or looked up here; `DetailsForm.js` applies the results to the controls and re-exports the
         * functions its QUnit module tests.
         */

        /** Precision of `ProductDetails.numberValue` (Decimal(15, 3)). */
        const PRECISION = 15;
        /** Value states of the counter (the `ValueState` enum of the core library, no string literals). */
        const ValueState = coreLibrary.ValueState;
        /** Icon of the counter when every field is filled. */
        const ICON_COMPLETE = "sap-icon://sys-enter-2";
        /** Icon of the counter while a field is empty. */
        const ICON_INCOMPLETE = "sap-icon://alert";
        /** i18n keys of the hints and the toast (SCREENS "Texts", app texts). */
        const TEXT = {
            range: "ProductsObjectPage.details.range",
            rangeFrom: "ProductsObjectPage.details.rangeFrom",
            rangeUpTo: "ProductsObjectPage.details.rangeUpTo",
            dependsOn: "ProductsObjectPage.details.dependsOn",
            cleared: "ProductsObjectPage.details.cleared"
        };
        /** Display time of the toast of a cleared row (SCREENS Q6: 3 seconds). */
        const TOAST_DURATION = 3000;

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
                    return Boolean(row.listValue_code);
                case "MULTI_LIST":
                    return typeof selectionCount === "number" && selectionCount > 0;
                default:
                    return false;
            }
        }

        /**
         * Counts filled rows. A disabled row (a dependent row whose enabling value is not selected, R12) is outside
         * N and M (SCREENS Q7).
         *
         * @param {object[]} rows detail rows of one product
         * @param {Array<number|undefined>} [selectionCounts] selections per row, same order as `rows`
         * @param {boolean[]} [enabledFlags] whether each row is enabled, same order as `rows`; only `false` excludes
         * @returns {{filled: number, total: number}} N and M of "Filled N of M"
         */
        function countFilled(rows, selectionCounts, enabledFlags) {
            const list = Array.isArray(rows) ? rows : [];
            const counts = Array.isArray(selectionCounts) ? selectionCounts : [];
            const flags = Array.isArray(enabledFlags) ? enabledFlags : [];
            const shown = list
                .map(function (row, index) {
                    return { row: row, count: counts[index], enabled: flags[index] !== false };
                })
                .filter(function (entry) {
                    return entry.enabled;
                });
            const filled = shown.filter(function (entry) {
                return isFilled(entry.row, entry.count);
            });
            return { filled: filled.length, total: shown.length };
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
         * The assignment of the row's attribute to the product's subcategory, from the row's expanded
         * `attribute/subcategories` (ADR-0028 decisions 5 and 8; D5 = A, no copied column).
         *
         * @param {object} row detail row with `attribute.subcategories`
         * @param {string} [subcategoryCode] the product's `subcategory_code`
         * @returns {object|null} `subcategory_code`, `required`, `minValue`, `maxValue` of the assignment, or null
         */
        function assignmentOf(row, subcategoryCode) {
            const attribute = row && row.attribute;
            if (!subcategoryCode || !attribute || !Array.isArray(attribute.subcategories)) {
                return null;
            }
            const match = attribute.subcategories.find(function (assignment) {
                return assignment && assignment.subcategory_code === subcategoryCode;
            });
            return match || null;
        }

        /**
         * Whether the product's subcategory requires a value for the row (R8, the label marker).
         *
         * @param {object} row detail row with `attribute.subcategories`
         * @param {string} [subcategoryCode] the product's `subcategory_code`
         * @returns {boolean} true only for an assignment of that subcategory with `required` true
         */
        function isRequired(row, subcategoryCode) {
            const assignment = assignmentOf(row, subcategoryCode);
            return Boolean(assignment) && assignment.required === true;
        }

        /**
         * The first bound that is set, as text for the Decimal constraints.
         *
         * @param {Array<string|number|null|undefined>} candidates the bound of the assignment, then the attribute's
         * @returns {string|undefined} the bound, undefined when none is set (0 is a bound)
         */
        function firstBound(candidates) {
            const bound = candidates.find(function (candidate) {
                return candidate !== null && candidate !== undefined && candidate !== "";
            });
            return bound === undefined ? undefined : String(bound);
        }

        /**
         * Format options and constraints of the per-row Decimal type (PLAN D19 of #9, R10): the attribute's scale for
         * DECIMAL, 0 for INTEGER; each bound from the assignment when it has one, else from the attribute; no padding
         * zeros in the display ("15", not "15.0").
         *
         * @param {object} attribute `valueType_code`, `scale`, `minValue`, `maxValue` of the row's attribute
         * @param {object|null} [assignment] `minValue`, `maxValue` of the assignment (`assignmentOf`)
         * @returns {{formatOptions: object, constraints: object}} settings for `sap.ui.model.odata.type.Decimal`
         */
        function numberTypeSettings(attribute, assignment) {
            const scale = attribute.valueType_code === "DECIMAL" ? Number(attribute.scale) || 0 : 0;
            const constraints = { precision: PRECISION, scale: scale };
            const own = assignment || {};
            const minimum = firstBound([own.minValue, attribute.minValue]);
            const maximum = firstBound([own.maxValue, attribute.maxValue]);
            if (minimum !== undefined) {
                constraints.minimum = minimum;
            }
            if (maximum !== undefined) {
                constraints.maximum = maximum;
            }
            return {
                formatOptions: { minFractionDigits: 0, maxFractionDigits: scale, preserveDecimals: false },
                constraints: constraints
            };
        }

        /**
         * The per-row Decimal type of an INTEGER or DECIMAL row (browser proof B5 of #9).
         *
         * @param {{formatOptions: object, constraints: object}} settings result of `numberTypeSettings`
         * @returns {sap.ui.model.odata.type.Decimal} a new type instance, one per binding
         */
        function createNumberType(settings) {
            return new Decimal(settings.formatOptions, settings.constraints);
        }

        /**
         * Placeholder of an empty number input (R10, SCREENS Q5): the bounds formatted by the row's own Decimal type,
         * so separators, grouping and decimals follow the locale and the scale.
         *
         * @param {{formatOptions: object, constraints: object}|null} settings result of `numberTypeSettings`, null
         *   for a row that is not numeric
         * @param {sap.base.i18n.ResourceBundle} bundle the app bundle
         * @returns {string} "10–18", "from 10", "up to 18", or "" without bounds
         */
        function rangeHint(settings, bundle) {
            const constraints = settings ? settings.constraints : {};
            const hasMinimum = constraints.minimum !== undefined;
            const hasMaximum = constraints.maximum !== undefined;
            if (!hasMinimum && !hasMaximum) {
                return "";
            }
            const type = createNumberType(settings);
            const minimum = hasMinimum ? type.formatValue(constraints.minimum, "string") : "";
            const maximum = hasMaximum ? type.formatValue(constraints.maximum, "string") : "";
            if (hasMinimum && hasMaximum) {
                return bundle.getText(TEXT.range, [minimum, maximum]);
            }
            return hasMinimum ? bundle.getText(TEXT.rangeFrom, [minimum]) : bundle.getText(TEXT.rangeUpTo, [maximum]);
        }

        /**
         * The list values that enable the row's attribute (`attribute/enabledBy`, R12).
         *
         * @param {object} row detail row with `attribute.enabledBy`
         * @returns {object[]} `code` and `attribute_code` of each enabling value, none for an independent row
         */
        function enablersOf(row) {
            const attribute = row && row.attribute;
            return attribute && Array.isArray(attribute.enabledBy) ? attribute.enabledBy : [];
        }

        /**
         * Whether a row may take a value (R12): a row without enabling values always; a dependent row only while one
         * of its enabling values is selected in the product.
         *
         * @param {object} row detail row with `attribute.enabledBy`
         * @param {{[attributeCode: string]: (string[]|null)}} [selectedCodesByRow] selected codes of the product's MULTI_LIST
         *   rows by their attribute code; null for a row whose selections are still loading
         * @returns {boolean} false only for a dependent row none of whose enabling codes is selected
         */
        function isEnabled(row, selectedCodesByRow) {
            const enablers = enablersOf(row);
            const selected = selectedCodesByRow || {};
            if (enablers.length === 0) {
                return true;
            }
            return enablers.some(function (enabler) {
                const codes = selected[enabler.attribute_code];
                return Array.isArray(codes) && codes.includes(enabler.code);
            });
        }

        /**
         * Whether the selections a dependent row reads are loaded, so a disabled state is final and a value may be
         * cleared (R12): no enabling attribute is still loading; one the product does not have counts as loaded.
         *
         * @param {object} row detail row with `attribute.enabledBy`
         * @param {{[attributeCode: string]: (string[]|null)}} [selectedCodesByRow] as for `isEnabled`
         * @returns {boolean} true unless an enabling attribute's row maps to null
         */
        function enablersLoaded(row, selectedCodesByRow) {
            const selected = selectedCodesByRow || {};
            return enablersOf(row).every(function (enabler) {
                return selected[enabler.attribute_code] !== null;
            });
        }

        /**
         * Localized name of the attribute whose values enable the row, read from the product's own row of that
         * attribute, so no extra request is needed (SCREENS "R12").
         *
         * @param {object} row the dependent detail row
         * @param {Array<object|null>} rows all detail rows of the product
         * @returns {string} the name, or "" for an independent row or an enabling attribute the product lacks
         */
        function enablerName(row, rows) {
            const enablers = enablersOf(row);
            if (enablers.length === 0 || !Array.isArray(rows)) {
                return "";
            }
            const match = rows.find(function (candidate) {
                return Boolean(candidate && candidate.attribute) && candidate.attribute.code === enablers[0].attribute_code;
            });
            return match ? match.attribute.name : "";
        }

        /**
         * Placeholder of a disabled dependent row (R12, SCREENS Q4).
         *
         * @param {sap.base.i18n.ResourceBundle} bundle the app bundle
         * @param {string} enabler localized name of the enabling attribute
         * @returns {string} "Depends on Connectivity"
         */
        function dependsOnHint(bundle, enabler) {
            return bundle.getText(TEXT.dependsOn, [enabler]);
        }

        /**
         * Text of the toast when a dependent row's value is cleared (R12, SCREENS Q6).
         *
         * @param {sap.base.i18n.ResourceBundle} bundle the app bundle
         * @param {string} detail localized name of the cleared row's attribute
         * @param {string} enabler localized name of the enabling attribute
         * @returns {string} "Battery Life cleared: it depends on Connectivity."
         */
        function clearedText(bundle, detail, enabler) {
            return bundle.getText(TEXT.cleared, [detail, enabler]);
        }

        /**
         * Names a cleared value with an information toast (3 seconds, bottom centre, no action). The toast alone
         * reaches screen readers: it renders with `role="alert"` (VERIFICATION V19), so an extra `InvisibleMessage`
         * announcement would read the text twice (SCREENS "Accessibility").
         *
         * @param {string} text the text of `clearedText`
         */
        function announceCleared(text) {
            MessageToast.show(text, { duration: TOAST_DURATION });
        }

        return {
            isFilled: isFilled,
            countFilled: countFilled,
            counterStatus: counterStatus,
            assignmentOf: assignmentOf,
            isRequired: isRequired,
            numberTypeSettings: numberTypeSettings,
            createNumberType: createNumberType,
            rangeHint: rangeHint,
            isEnabled: isEnabled,
            enablersLoaded: enablersLoaded,
            enablerName: enablerName,
            dependsOnHint: dependsOnHint,
            clearedText: clearedText,
            announceCleared: announceCleared
        };
    }
);
