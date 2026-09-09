---
name: verifying-test-guard-strength
description: Read-only techniques for judging whether a new contract test or OPA5 assertion really fails without the change - occurrence counts, simulated wrong models, and the CDN path for sap.fe.test sources.
metadata:
  type: reference
---

Two techniques that settle "is this test a real guard?" without editing the tree or starting a server:

1. **Occurrence count, then simulated wrong model.** For a `$metadata`/EDMX substring assertion,
   compare `git show <base>:app/products/webapp/localService/metadata.xml | grep -c '<substring>'`
   with the same count in the working tree. A count that was already >= 1 means the assertion was
   green before the change. Then, in the scratchpad, load the current file in `node`, string-replace
   the new value with a plausible wrong one (e.g. the semantic key naming `ID` instead of `name`) and
   re-evaluate the assertions: if they still pass, the test does not guard the decision the ADR made.
   Used on 2026-09-09 (`products-draft-marker`) to turn "the second assertion is redundant" into
   "the test stays green on the one mistake that would silently kill the feature".

2. **`sap.fe.test` and UI5 sources come from `ui5.sap.com/resources/...-dbg.js`, not
   `test-resources/`** (that path returns the SDK 404 HTML page with HTTP 200-looking content).
   `resources/sap/fe/test/api/*.js`, `resources/sap/fe/test/builder/*.js` and
   `resources/sap/fe/macros/filterBar/DraftEditState.js` are how to confirm that a journey's API
   exists and what it actually asserts - e.g. `TableBuilder.Row.Matchers.isDraft` matches any
   `sap.m.ObjectMarker` in the row (row-scoped, no per-cell variant), and
   `HeaderActions.iNavigateByBreadcrumb` presses a matching item of the `content/links` aggregation,
   so it succeeds without navigating when no link matches.

**How to apply:** whenever a plan claims a test "must fail on main" or an agent reports a green OPA5
run for a framework-rendered control. See [[pipeline-review-conventions]] for which gates to re-run.
