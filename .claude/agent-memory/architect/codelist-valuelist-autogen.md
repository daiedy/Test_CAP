---
name: codelist-valuelist-autogen
description: In this project ValueList for FKs to sap.common.CodeList entities is compiler-generated (@cds.odata.valuelist); explicit @Common.ValueList in app/ is redundant; own code lists need Common.Text on `code` in app/. Verified by compile experiment 2026-09-07, ADR-0011 accepted.
metadata:
  type: project
---

Associations to `sap.common.CodeList`-based entities (Currencies, Categories) get `Common.ValueList` on the FK automatically from `@cds.odata.valuelist` on the aspect; the app layer annotates the association only with `Common.Text: <assoc>.name` + `Common.TextArrangement: #TextOnly` (+ `Common.ValueListWithFixedValues: true` for fixed lists), all propagated to `<assoc>_code`. An explicit `@Common.ValueList` compiles too (compiler does not add a second one) but drops the auto `Label`. Own code lists additionally need `Common.Text: name` + `#TextOnly` on `code` in `app/<app>/annotations/<CodeList>.cds`: `Currencies.code` carries `@Common.Text: name` in `@sap/cds/common` itself, the `CodeList` aspect does not provide it (found by ux-designer via `search_model`).

**Why:** PATTERNS row "Выбор значения из справочника" and `templates/annotations-ui.cds` said "explicit ValueList", while the only real example (`Products.currency_code`) was implicit. Verified with cds-dk 10.0.7 in a scratch compile (see `docs/features/categories-code-list/CONTEXT.md`, "Проверено компиляцией"). ADR-0011 accepted by the user 2026-09-07 in both parts.

**How to apply:** For any new CodeList association follow ADR-0011 directly; do not re-run the experiment. Check that docs-keeper updated PATTERNS and `templates/annotations-ui.cds` after `categories-code-list`; if not, flag as debt. Reviewers should flag hand-written ValueLists on CodeList FKs as duplicates, and a missing `Common.Text` on the code list key as a defect (dropdown would show codes).
