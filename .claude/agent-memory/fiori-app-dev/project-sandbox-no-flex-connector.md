---
name: project-sandbox-no-flex-connector
description: flpSandbox.html has no flex connector, so the variant "Save As" 404s on /sap/bc/lrep and saved views lose all filter conditions (any field, not only custom ones)
metadata:
  type: project
---

`app/products/webapp/test/flpSandbox.html` sets no `data-sap-ui-flexibility-services`, so UI5 falls back to `LrepConnector`. On CAP (:4004) `HEAD /sap/bc/lrep/actions/getcsrftoken/` returns 404 and the VariantManagement `save` listener throws `Error: Not Found`. The variant is created in memory with its `addCondition` changes still `NEW` and `modified` stays true ("Modified view X *"). `VariantManagerApply.handleSelectVariant` then calls `eraseDirtyChangesOnVariant` on it when the user switches away, so coming back shows no conditions. This happens for Category too, and it happens on `main` without any custom field (measured 2026-09-25, products-rating-filter defect round 1). When `SessionStorageConnector` is injected, restore works for the slider and for Category.

**Why:** ui-verifier reported it as a custom filter field defect (PropertyInfo hypothesis). That hypothesis is wrong.

**How to apply:** when a variant does not restore, first check the 4xx on `/sap/bc/lrep` and the `save` listener error before you blame the field. The fix belongs in the sandbox bootstrap, outside ADR-0020 (fragment/handler only). `ControlVariantApplyAPI.activateVariant` hides the bug because it does not erase dirty changes. Reproduce with `vm._oVM.fireSelect({key})`, which is the UI path. Related: [[reference-headless-measurement]].
