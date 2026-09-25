# products-rating-filter: context

Date: 2026-09-25. Author: `architect`. Branch: `feature/products-rating-filter`.

This file is the brief for the implementers: every agent of the feature reads it whole (protocol step 1), so it holds only the sections below (ADR-0018). Screens go to `SCREENS.md` (`ux-designer`). Experiments, measurements, rejected mechanisms and framework facts go to `research/<topic>.md`, read only by `architect` and `reviewer` unless a plan step names the file.

## Request
GitHub issue #6 (P2, blocked by #5, which is merged): "List Report: a filter by rating as a RangeSlider." The user wants to narrow the 15-row product list to a rating band (for example 4 to 5 stars) by dragging the two handles of a `sap.m.RangeSlider` in the List Report filter bar, next to the existing Name, Category and Price filters. The rating itself (`Products.rating`, integer 0..5, stars column and field) came with #5.

## User decisions
Answered by the user at the plan gate, 2026-09-25:
1. Q1: the literal **RangeSlider** as a custom filter field (ADR-0020, accepted 2026-09-25); the declarative condition field is not built.
2. Q2: scale **0..5, step 1**.
3. Q3: **only the slider** in Adapt Filters (key `rating` replaces the standard condition field; no custom operator).
4. Q4: **`liveMode: true` ships together with this feature** (non-default answer): the Go button disappears from the List Report, a filter change reloads the table at once, and the 5 `iExecuteSearch()` calls of 3 existing journeys are replaced by a wait for the table (research section 5).

## Affected entities and services
Result of `mcp__cds-mcp__search_model` (`CatalogService.Products`) and `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`, `UI-ARTIFACTS.md`:

| Object | Exists now | What changes |
|---|---|---|
| `CatalogService.Products` (draft-enabled, `@restrict` Viewer READ / Editor `*`) | `rating : Integer`, `@title` / `Common.Label` `{i18n>Products.rating}`, `@assert.range [0, 5]` (`Validation.Minimum` 0, `Maximum` 5), filterable, not in `UI.SelectionFields` (`name`, `category_code`, `price`) | nothing: no `db/`, `srv/`, annotation or contract change |
| List Report `ProductsList` (`app/products/webapp/manifest.json`) | `sap.fe.templates.ListReport`, `variantManagement: Page`, `initialLoad: true`, no `controlConfiguration`, Go button (no `liveMode`) | a custom filter field `rating` under `controlConfiguration` → `@com.sap.vocabularies.UI.v1.SelectionFields` → `filterFields`, added through Fiori MCP only; placed after Price, shown by default, label taken from `Common.Label`; `liveMode: true` on `ProductsList` through Fiori MCP only (no Go button) |
| `app/products/webapp/ext/` | does not exist (first extension of the app) | `ext/fragment/RatingRangeFilter.fragment.xml` (`sap.m.RangeSlider`, 0..5, step 1) and `ext/fragment/RatingRangeFilter.js` (change handler and formatter, ADR-0020) |
| Filter bar behaviour | Rating is available only in Adapt Filters as a standard condition field | the slider replaces that field (same key `rating`); moving the handles to a band filters `rating ge <lo> and rating le <hi>` at once (`liveMode`, no Go); every other filter field also applies on change; the full range 0..5 means "no rating filter" |
| i18n | `Products.rating` in `_i18n/i18n*.properties` (en, ru); `webapp/i18n` holds only `appTitle`, `appDescription` | nothing expected; a key `ProductsList.ratingFilter.label` (en, ru) only if the label fallback is measured not to work (PLAN risk 3) |
| Roles | `viewer` reads, `alice`/`bob` edit | none: filtering is read-only, the slider is the same for all roles; no endpoint answers differently, so no external caller (CI probe, smoke curls, README) is affected |

## What already exists and is reused
- `Products.rating` and its label `{i18n>Products.rating}` (en, ru) from #5: the filter label, no new text.
- The seeded ratings in `db/data/my.catalog-Products.csv` and `localService/mockdata/Products.json` (same 15 values): expected row counts, no new test data.
- `app/products/webapp/test/integration/data/RatingTexts.js` (labels en/ru as `\u` escapes, column key `rating`): extended with the slider ranges and counts, not duplicated.
- `pages/CategoryDropdown.js`: the reference for a custom `OpaBuilder` page object where `sap.fe.test` has no API; the slider page object follows its shape.
- `FilterProductsByCategoryJourney.js`: its category step is reused by the new journey to prove the slider combines with other filters; its 2 `iExecuteSearch()` calls (and 2 in `DraftMarkerInListReportJourney.js`, 1 in `RussianLocaleJourney.js`) become a wait for the table because `liveMode` removes the Go button; the scenarios themselves stay.
- Registry: `UI-ARTIFACTS.md` "Extensions and fragments: _none_", `HANDLERS.md` and `REUSE-CATALOG.md` hold nothing client-side: no existing fragment, handler or formatter to reuse. Duplication to avoid: a second label key for "Rating", a second copy of the seeded ratings, a controller extension or a private JSON model holding the slider state next to the filter bar's own conditions.

## Applicable patterns
- "Manifest change": Fiori MCP `list_functionality` → `get_functionality_details` → `execute_functionality`; the validation step uses `ui5lint` (`npm run lint` in `app/products`) because `run_manifest_validation` is broken (STATE open debt). The same way sets `liveMode: true` on `ProductsList`.
- "Custom section or column": fragment folder `ext/fragment/` and registration via Fiori MCP.
- **Custom filter field: no row, ADR needed.** Draft `docs/decisions/ADR-0020-custom-filter-field.md` (proposed): one-way binding to `{filterValues>}` plus a `change` handler calling `setFilterValues`.
- "Formatter or extension": QUnit in `webapp/test/unit/` (first unit module of the app).
- "User scenario": OPA5 journey on `sap.fe.test` pages, run with `npm run test:ui` against `npx cds serve --in-memory --port 4004`.
- "Texts": no new key expected (the label comes from `Common.Label`).
- "OData contract": untouched; `npx vitest -u` and the `metadata.xml` regeneration are not scheduled (no `db/`, `srv/`, `app/*/annotations` edit).

## Relevant lessons
- 2026-09-25 (#5): an edit-mode `RatingIndicator` clamps and writes the clamped value back on the next render; `RangeSlider` does the same in `onBeforeRendering`, which is why ADR-0020 binds one-way.
- #5 test-ui memory: ids and keys of FE controls are measured on the running app (failing-assert probe), never guessed.
- #5 SUMMARY: contract figures only from a measured `git diff --numstat`; here the expected figure is "no line" for both contract files.
- TESTING.md: OPA5 runs against `npx cds serve --in-memory --port 4004`, never `cds watch`; a leftover draft changes row counts, so the new journey runs before `DraftMarkerInListReportJourney`.
- LESSONS "Pending upstream": `run_manifest_validation` fails (use `ui5lint`); `fiori-mcp` `search_docs` had outages (fallback: CDN `-dbg.js`, mark "not verified by MCP").

## Open questions
None: the four questions were answered at the plan gate on 2026-09-25 (see "User decisions").
