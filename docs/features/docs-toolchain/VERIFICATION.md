# docs-toolchain: verification

Date: 2026-10-25. Agent: `ui-verifier`. Server: `npx cds serve --in-memory --port 4004` (stopped afterwards), Basic user `alice` (empty password), branch `feature/docs-toolchain`, HEAD c89ad4a. No UI change in this feature; Chrome DevTools MCP used at 1400x1000.

## Manual scenario check
| # | Scenario | Steps | Result | Screenshot |
|---|---|---|---|---|
| 1a | Swagger UI header | `GET /$api-docs/odata/v4/catalog/` as alice: title "Product Catalog API", badges `1.0.0` and `OAS 3.0`, description "Reads and maintains catalog products with their categories, subcategories and typed details, and imports products from an Excel workbook.", server `/odata/v4/catalog` | passed | `screenshots/swagger-header.png` |
| 1b | Tag descriptions | `openapi.json` `tags[]` carries 11 descriptions; UI shows "Products: Product sold in the catalog, created and changed through a draft." and "Categories: Product category, a read-only code list." | passed (cosmetic item, see below) | `screenshots/swagger-tag-products.png`, `screenshots/swagger-top.png` |
| 1c | `Products` schema | Schemas section shows `CatalogService.Products` titled "Product sold in the catalog, created and changed through a draft." (spec: `title` set, `description` null), with the (for create)/(for update) variants | passed | `screenshots/swagger-schema-products.png` |
| 1d | Try it out `GET /Products` | Executed from Swagger UI: curl shown `http://localhost:4004/odata/v4/catalog/Products?%24top=50`, response code 200, body `@odata.context: $metadata#Products`, first row "Notebook Set"; 15 rows in the service | passed | `screenshots/swagger-tryout-products.png` |
| 2 | `$metadata` descriptions | See the quoted lines below | passed | none (requested) |
| 3a | List Report | `flpSandbox.html#products-display` as alice: title "Products (15)", 15 rows (Notebook Set first), Import from Excel and Create enabled | passed | `screenshots/list-report.png` |
| 3b | Object Page | Click on "Notebook Set": Object Page with header "Notebook Set / Stationery", Edit, Delete, sections General Information, Pricing & Stock, Details ("Filled 0 of 3"), Administrative Data | passed | `screenshots/object-page.png` |

### Scenario 2 evidence (`GET /odata/v4/catalog/$metadata`, alice, 200)
```
425:      <Annotation Term="Core.SchemaVersion" String="1.0.0"/>
426:      <Annotations Target="CatalogService.EntityContainer">
427:        <Annotation Term="Core.Description" String="Reads and maintains catalog products with their categories, subcategories and typed details, and imports products from an Excel workbook."/>
644:        <Annotation Term="Core.Description" String="Product sold in the catalog, created and changed through a draft."/>      (Products entity type)
745:      <Annotations Target="CatalogService.Products/name">
746:        <Annotation Term="Common.Label" String="Product Name"/>
748:        <Annotation Term="Core.Description" String="Name of the product."/>
```
Also on Products: `description` "Free-text description of the product.", `price` "Unit price of the product in its currency.", `stock` "Number of units in stock.", `rating` "Customer rating on a scale of 0 to 5.".

## Network evidence
```
GET  /$api-docs/odata/v4/catalog/                  -> 200 (HTML), swagger-ui.css/-bundle.js/-standalone-preset.js/-init.js -> 200
GET  /$api-docs/odata/v4/catalog/openapi.json      -> 200 (info.title "Product Catalog API", version 1.0.0, 11 tags, 69 paths, 44 schemas rendered)
GET  /odata/v4/catalog/Products?%24top=50          -> 200 (Swagger try-out)
GET  /odata/v4/catalog/$metadata                   -> 200
List Report / Object Page: no request with status >= 400 except the one sandbox 404 named below
External (yuml.me ER diagram images in the Swagger description): 200
```
The Swagger UI loaded with no console message at all (before and after the try-out).

## Browser console
Baseline: console section of the latest `VERIFICATION.md` on `main`, `docs/features/catalog-authorization/VERIFICATION.md` (commit d3a4db0): known sandbox 404, `AddBookmarkButton` ushell deprecation, FE `T_NEW_OBJECT|Products` i18n asserts, the `Permissions/isEditor` `$select` read error.
- Scenario 1 (Swagger UI): 0 errors, 0 warnings, 0 messages.
- Scenario 3 (List Report then Object Page): known noise only: `[assert] could not find any translatable text for key 'T_NEW_OBJECT|Products'` (2, then 30, then 14 times), `[error] Failed to load resource ... 404` (1, the sandbox 404), `[error] [FUTURE FATAL] 'sap.ushell.ui.footerbar.AddBookmarkButton' is deprecated`, info `Range set DeviceSet has already been initialized` (x30), issue "Incorrect use of <label for=FORM_ELEMENT>" (x2, a browser Issues-panel hint, not in the baseline text; it comes from SAP UI5 form controls, not from this feature's code, not matched to a trigger). The `Permissions/isEditor` read error did not appear in this run. 
- New errors: 0. New warnings: 0. One unlisted item: the Issues-panel hint above (info level).

## Observations (not defects of the feature)
- Swagger UI renders operations lazily: on a plain load only the "Categories" tag section was in the DOM (4 operations), the other tags appeared only through a deep link such as `#/Products/get_Products`. The Swagger state holds all 19 tags (`specSelectors.taggedOperations()`), `openapi.json` is complete, no console error. Worth a look by the user if the browser UI is used by hand; the OpenAPI contract is intact.
- The bound action tag of `importProducts` shows as `{i18n>Products.import Products}` in the served `openapi.json`. Two defects meet here (edited after review, 2026-10-26): the plugin `cds-swagger-ui-express` does not localize the document it serves, which leaves the raw `{i18n>...}` braces (it also hits SAP's `UserID.Description` and `CurrencyCode.Description`; ADR-0029 known limits, decision D7), and the converter `@cap-js/openapi` 1.6.0 humanizes the key to "Products.import Products" (PLAN risk, decision D5).
- After the Object Page click the route reads `#products-display&/Products('Notebook%2520Set')` (the key in the URL is the encoded name, not a GUID); the Object Page rendered correctly and this is outside the feature.

## Verdict
Ready for review. Title, version, tag descriptions, `Products` schema description and a 200 `GET /Products` try-out were seen as `alice`; `$metadata` carries the service and `name` descriptions; the List Report and Object Page open as before; no console message new against the baseline.
