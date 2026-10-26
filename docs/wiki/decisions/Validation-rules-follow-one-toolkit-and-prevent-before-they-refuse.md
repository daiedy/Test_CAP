---
title: Validation rules follow one toolkit and prevent before they refuse
summary: The validation rules of issue 10 use declarative constraints with custom texts, two-field messages and a control that prevents the error first, and three proposed rules were not taken (ADR-0028).
tags: [validation, products, details]
adr: ADR-0028
sources:
  - docs/decisions/ADR-0028-validation-toolkit.md
---

# Validation rules follow one toolkit and prevent before they refuse

## Decision

The decision has eleven parts, grouped here by what the user sees.

**Messages.** A format or range rule whose default text would not explain the reason carries its own message key, with texts in English and Russian; the error code stays the same, so the import and the screen handle it as before. An open bound is written with an open end, and the global platform texts are not overridden. When a rule reads two fields the user edits, the message names both fields, so the screen marks both; text arguments may be read from the row, and a translated text falls back to the base text.

**Uniqueness.** A uniqueness rule that a user must see is a self-association on the product that finds the other products with the same name, ignoring letter case and spaces at both ends, plus a constraint on the product. While editing a draft the message appears against the saved products, excluding the product itself; at Save the saved product is checked against the others. A database uniqueness constraint stays only for writers that bypass the screen.

**Conditional requirement.** A field that is required only while another field has a value is never simply mandatory. It is a constraint with both fields as targets plus a screen setting that marks the field required or optional, both editable. The server never evaluates the screen setting; the constraint is the guard on every path.

**Details.** A subcategory marks the attributes it requires, and a product of that subcategory needs a value for each, whatever the value type; the form marks the label. A subcategory may narrow the bounds of a number attribute for its products; the attribute's own bounds stay the first guard, and the form shows the bounds as a hint. A rule that compares two rows of one draft is data-driven: an attribute names the attribute whose value it must not be below, and the message names both attributes; it never goes through a link that starts outside the draft, because that would compare with the saved product while the user edits. A fixed attribute code is reserved for a showcase rule whose model would be artificial, such as the power-of-two rule on memory. A value of a list attribute may enable another attribute: the form disables and clears the dependent row while no enabling value is selected and enables it as soon as one is, and the server keeps one guard marked "not user-facing".

**Import.** Every constraint on the product gets a per-row pre-check in the import before anything is written; the constraint stays the guard. A constraint on a child record the import never writes needs none.

**Prevent before validate.** Every rule of a validation catalogue names the control that prevents the error before the request, or "none, validation only". A control is added when the platform offers one without a handler. The server constraint stays the guard on every path, and a control alone is never accepted as the rule.

**Withdrawn.** On 2026-10-14 the rule on a draft child that checks a text against a pattern was withdrawn: the platform can state it declaratively, and the user dropped the rule itself.

The first use is the feature products-validations (#10), the rules R1-R6, R8 and R10-R13 of its context document. They were approved on 2026-10-14 with the currency list as the control for the decimals rule and without a suggestion list for the image address.

## Why

The rules of #10 needed texts that explain the reason, rules over several fields and rows, and a consistent answer to the question of what stops the user before the error. One toolkit means the next rule is built the same way.

## What it means for the catalog

The eleven approved rules are planned and not yet in the code; each page says what the user will see.

| Rule | Page |
|---|---|
| A product name has at least three characters | [BR-PRODUCTS-009](../rules/A-product-name-has-at-least-three-characters.md) |
| A product name is unique in the catalog | [BR-PRODUCTS-010](../rules/A-product-name-is-unique-in-the-catalog.md) |
| A price is above zero | [BR-PRODUCTS-011](../rules/A-price-is-above-zero.md) |
| A price in a currency without minor units has no decimals | [BR-PRODUCTS-012](../rules/A-price-in-a-currency-without-minor-units-has-no-decimals.md) |
| An image address uses https and has no spaces | [BR-PRODUCTS-013](../rules/An-image-address-uses-https-and-has-no-spaces.md) |
| A product in stock needs a description | [BR-PRODUCTS-014](../rules/A-product-in-stock-needs-a-description.md) |
| A detail that the subcategory requires must be filled | [BR-DETAILS-007](../rules/A-detail-that-the-subcategory-requires-must-be-filled.md) |
| A detail number stays within the bounds of its subcategory | [BR-DETAILS-008](../rules/A-detail-number-stays-within-the-bounds-of-its-subcategory.md) |
| Storage is not below memory | [BR-DETAILS-009](../rules/Storage-is-not-below-memory.md) |
| Battery life is available only for a wireless device | [BR-DETAILS-010](../rules/Battery-life-is-available-only-for-a-wireless-device.md) |
| Memory is a power of two | [BR-DETAILS-011](../rules/Memory-is-a-power-of-two.md) |

Three rules proposed for #10 are not in the catalog.

| Rule | What was proposed | Why it was not taken |
|---|---|---|
| R7 | A description must not merely repeat the name, as a second branch of the description rule. | Not included: the user left it out of the rule set on 2026-10-14. |
| R9 | A text attribute with a format, such as the free-text `DIMENSIONS` attribute written as "length x width x height". | Rejected by the user on 2026-10-14: the free-text attribute is replaced by three numeric attributes and a free-text model attribute in a separate issue, so a format rule on free text is not needed. |
| R14 | At most N selections in a multi-choice attribute. | Rejected by the user on 2026-10-14: an aggregate or a subquery is not allowed in a constraint, `exists` cannot count, a handler would be the only way, and the domain gives no reason. |

## Source

[ADR-0028: Validation toolkit: custom texts, uniqueness, two-target constraints, conditional requirement, rules on detail rows, prevent before validate](../../decisions/ADR-0028-validation-toolkit.md)
