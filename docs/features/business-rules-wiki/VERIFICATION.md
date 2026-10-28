# business-rules-wiki: verification

Date: 2026-10-28. Agent: `ui-verifier`. Subject: the wiki mirror at https://github.com/daiedy/Test_CAP/wiki, produced by workflow run 40719796267 (dry run 40719647854) at commit `5d31162b833fc0e815eb9de6e6bf750b4687c272`; wiki git `master` at `7a54858` ("Update wiki 5d31162b...").

## Automated tests
Not applicable: this step checks the published wiki on github.com, no code under test.

## Manual scenario check
| Scenario from PLAN | Steps | Result | Screenshot |
|---|---|---|---|
| 1 Mirrored Home | Opened `/wiki`: H1 "Home", the repository Home text (no probe text), custom sidebar (`Home`, Domain model, Business rules, How-to, Decisions, API, Glossary, from `_Sidebar.md`) and the footer "This wiki is a read-only mirror of the folder docs/wiki/ ..." (`_Footer.md`) | passed | `screenshots/01-home.png` |
| 2 A rule page | Opened `/wiki/The-subcategory-belongs-to-the-products-category`: H1, key table (Summary, Tags, Id `BR-PRODUCTS-001`, Status, Since, Code, Messages, Elements, Sources), History table (Date / Change / Source), 0 `<hr>`, no raw `---` or `title:` text | passed | `screenshots/02-rule-page.png` |
| 3 Bare page-name links across folders | See the table below. Followed by click: rule page -> `A-dependent-field-offers-only-the-values-of-its-parent-field` (decisions folder), digest -> `Categories` (domain folder); Home links to rule and how-to pages fetched | passed | `screenshots/03-followed-digest.png` |
| 4 Sidebar folder indexes | Clicked `Business-rules` and `Decisions` in the sidebar: both open (200, H1 "Business rules" / "Decisions"); every page link on both indexes fetched, 0 non-200. Also fetched Domain-model, How-to, API: 200 | passed | `screenshots/04-business-rules-index.png`, `screenshots/04-decisions-index.png` |
| 5 Repository link to a blob at the SHA | Clicked the `ADR-0024` link on the rule page; landed on `https://github.com/daiedy/Test_CAP/blob/5d31162b833fc0e815eb9de6e6bf750b4687c272/docs/decisions/ADR-0024-dependent-value-help.md`, the file is shown; `curl` 200. `tree/5d31162.../docs/decisions` also 200 | passed | `screenshots/05-adr-blob-at-sha.png` |
| 6 Mirror vs export vs source | See the comparison below | passed | n/a (diff output) |
| 7 API page, Swagger and Access | `Catalog-service-API`: link `http://localhost:4004/$api-docs/odata/v4/catalog` present in the line "Swagger UI while npm run watch runs (development only)"; Access section lists BR-ACCESS-001/002/003 with links, all three open (200) | passed | `screenshots/07-api-page.png` |

### Scenario 3: links followed (href as in the DOM -> resolved URL -> status)
| From | href | Resolved URL | Status |
|---|---|---|---|
| Home | `wiki/Business-rules` (GitHub rewrote Home's bare name) | `/wiki/Business-rules` | 200 |
| Home | `wiki/Only-signed-in-users-reach-the-catalog` (rule) | `/wiki/Only-signed-in-users-reach-the-catalog` | 200 |
| Home | `wiki/Find-a-product` (how-to) | `/wiki/Find-a-product` | 200 |
| Home | `wiki/Domain-model`, `wiki/Decisions`, `wiki/API`, `wiki/Glossary` | same paths | 200 |
| Rule page | `A-dependent-field-offers-only-the-values-of-its-parent-field` (ADR-0024 digest, clicked) | `/wiki/A-dependent-field-offers-only-the-values-of-its-parent-field` | 200, title of the digest |
| Rule page | `A-field-is-disabled-until-the-field-it-depends-on-is-filled` | `/wiki/A-field-is-disabled-until-the-field-it-depends-on-is-filled` | 200 |
| Digest | `Categories` (domain, clicked) | `/wiki/Categories` | 200, H1 "Categories", sidebar still present |
| Digest | `Choose-a-category-and-subcategory` (how-to), `Subcategories`, `Changing-the-category-clears-...` | `/wiki/<name>` | 200 |

No 404 and no "create this page" view. Bare page names (without `./`) resolve correctly on Gollum, so the plan's risk did not materialise; the `./<page>` fallback is not needed. Anchors `#rule`, `#why`, `#where-it-fires`, `#history` are in-page links of the rule page and resolve on the page. The digest page has no `#why` link to follow from the rule page (the rule page links the digest without anchor).

### Scenario 6: comparison
- `node scripts/wiki.mjs export <tmp>/out --ref 5d31162b... --repo-url https://github.com/daiedy/Test_CAP` printed "links pinned to https://github.com/daiedy/Test_CAP/blob/5d31162b..." and "Exported 74 files of docs/wiki flat".
- `git clone https://github.com/daiedy/Test_CAP.wiki.git`, `diff -r -x .git <export> <clone>`: no difference at all (74 files in each, including `_Sidebar.md` and `_Footer.md`); the page `The-subcategory-belongs-to-the-products-category.md` is identical. Expected: `preprocess` is off.
- Against the source `docs/wiki/rules/The-subcategory-belongs-to-the-products-category.md` at `5d31162` the export differs in two ways only: (1) the YAML frontmatter block (`---`, `title:`, `summary:`, `tags:`, `id:`, `status:`, `since:`, `code:`, `messages:`, `elements:`, `sources:`, `verified:`) is replaced by a `| Key | Value |` table under the H1 (`verified` and `title` are not shown as rows; code and messages in backticks; sources as pinned blob URLs); (2) relative links such as `../decisions/A-dependent-field-offers-only-the-values-of-its-parent-field.md` become bare page names `A-dependent-field-offers-only-the-values-of-its-parent-field`, and repository paths become `https://github.com/daiedy/Test_CAP/blob/5d31162.../...` URLs. The body text is unchanged.
- Temp folders and the clone were removed.

## Network evidence
Not a CAP app: HTTP status per URL is recorded in the scenario tables (fetch from the page, `curl` for the blob view). Note: one in-page `fetch` of the ADR blob returned 429 after ~60 rapid fetches (GitHub rate limiting); the page itself rendered and `curl` afterwards returned 200, not a defect.

## Browser console
Not applicable (github.com pages, not the application under test); not collected.

## Verdict
Ready for review. No defects found.
