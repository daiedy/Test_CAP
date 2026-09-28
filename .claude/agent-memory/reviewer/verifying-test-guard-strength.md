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

3. **Adjudicating verifier observations from control source.** Fetch
   `https://ui5.sap.com/<version>/resources/sap/m/<Control>-dbg.js` and read the setter and
   `onBeforeRendering`: a correction made in `onBeforeRendering` (outside the model-to-control update)
   is written back by a two-way binding, one made in the setter during binding update is not.
   `sap/m/messagebundle.properties` gives the ARIA texts (e.g. `RATING_VALUEARIATEXT={0} of {1}`),
   useful when a chrome-devtools a11y snapshot shows an empty `valuetext` (2026-09-25).

4. **Proving a model-annotation guard with a scratch server (2026-09-25, `products-excel-upload`).**
   Put an `index.cds` in the scratchpad with `using from '<relative path to srv/catalog-service>'`
   (absolute paths in `using from` fail with "Can't find local module") plus an override such as
   `annotate CatalogService with @cds.server.body_parser.limit: null;`, then from the project root
   `npx cds serve <scratch>/index.cds --in-memory --port 4012`: the impl `srv/catalog-service.js` and
   `db/data` are still found. POST the test's payload (import the fixture builders by absolute path) to
   see the red state (413 here). For `npm run test:ui` while someone else's `cds watch` holds :4004,
   run `npx ui5-test-runner --url http://localhost:<port>/products/webapp/test/testsuite.qunit.html
   --parallel 1 --split-opa --report-dir <scratchpad>` from `app/products` against your own
   `cds serve` on another port, and never stop the :4004 process.
