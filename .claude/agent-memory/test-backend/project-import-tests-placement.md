---
name: project-import-tests-placement
description: importProducts behaviour tests belong in test/catalog-service.test.js even when a plan criterion names test/products-import.test.js; new rules break existing writers in the drafts/details describes
metadata:
  type: project
---

`test/products-import.test.js` is a server-less unit file for `srv/lib/products-import.js`; anything that goes through the `importProducts` action (row messages, "nothing is imported", `sap-messages`) needs the `cds.test` server of `test/catalog-service.test.js` (describe "CatalogService.Products importProducts"). A plan criterion that names products-import.test.js for an action-level behaviour is a plan inaccuracy: keep the exact test name, put it in catalog-service, add the pure-function unit tests to products-import, and report the deviation (products-validations #10, 2026-11-12).

**Why:** a second `cds.test` server in the unit file would slow the suite and break its "pure functions, no server" design; one file per service is the rule.

**How to apply:** when a new `@assert` rule lands, expect red writers beyond the ones the hand-over lists: draft flows that switch subcategory (required details per assignment), drafts that set only some fields (R6 description), API detail rows of a product without the enabling row. Since R2 (case-insensitive unique names) every product a test creates needs a name no other live product has. The committed invalid workbook is built from `INVALID_ROWS`, not `generatedRow`; regenerate only that file with a one-off `node --input-type=module -e` import of `write-excel-file/node`, so the valid fixture's bytes stay unchanged. See [[feedback-turn-budget]].
