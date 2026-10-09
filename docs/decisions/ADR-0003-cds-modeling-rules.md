# ADR-0003: CDS modeling rules

Date: 2026-09-07. Status: accepted.

## Context
Agents in different sessions model differently: explicit `key ID : UUID` versus `cuid`, `enum` versus code tables, different decimal precision. One way per situation is needed.

## Decision
- Every entity: `: cuid, managed`. Composite keys only for text and code tables.
- User-facing value lists: an entity based on `sap.common.CodeList` with key `code`; `enum` only for internal statuses.
- Money: `Decimal(15, 2)` plus `currency : Currency` and `@Measures.ISOCurrency`.
- Strings always with a length, localizable texts `localized String`.
- The `my.catalog` namespace is kept: renaming would break the CSV names and the metadata snapshot without benefit.
- The existing `Products.price : Decimal(10, 2)` is kept as a historical exception; changing the precision requires a data migration and a separate ADR. Withdrawn on 2026-10-09: see the amendment below.
- `Products` was switched from an explicit `key ID : UUID` to `cuid` (equivalent, no contract change).

## Amendment: price precision (user decision 2026-10-09, feature catalog-hygiene)
The user approved the `catalog-hygiene` plan on 2026-10-09 (GitHub issue #20; `docs/features/catalog-hygiene/CONTEXT.md` "User decisions" 1 and 2) and chose to amend this ADR in place instead of writing a separate one. The other rules of the decision above stay as written; only the historical exception of `Products.price` is withdrawn.

A. **Precision.** `Products.price` becomes `Decimal(15, 2)` in `db/schema.cds`, as the money rule above says. The OData contract changes by one line, `Precision="10"` to `Precision="15"` on `CatalogService.Products.price` (`docs/features/catalog-hygiene/research/contract-delta.md` section 1).

B. **No data migration.** The development database is SQLite in-memory, loaded from `db/data/my.catalog-Products.csv`, whose 15 prices (14.99 to 1299.99) fit unchanged. HANA is not configured (`docs/STATE.md` open debt), so no productive data exists and the first productive deployment creates the column at (15, 2). No migration script is written.

C. **Range.** `@assert.range` on `price` stays `[0, 99999999.99]` in `srv/annotations/Products.cds`: it is a business bound, independent of the storage precision, and is not widened to the type maximum.

The `Status:` sentence of this ADR is unchanged: an amendment never appends to it (`templates/adr.md`), and the template's `superseded by` form retires a whole ADR, which would wrongly retire the other rules of this one.

## Alternatives
| Option | Why rejected |
|---|---|
| `enum` for product categories | The user cannot add a value without a deployment; no translations |
| Rename the namespace to `sap.catalog` or a domain one | Breaks CSV, snapshots, gives nothing |
| Amendment: a separate ADR that supersedes only the exception sentence, as that sentence asked | A nearly empty ADR; the `superseded by` status of `templates/adr.md` retires a whole ADR and cannot express one withdrawn sentence; the user chose the amendment, 2026-10-09 |
| Amendment: widen `@assert.range` of `price` to the type maximum `[0, 9999999999999.99]` | The bound is a business rule, not the storage limit, and nobody asked for larger prices; one more EDMX line and a 15-significant-digit edge in SQLite's REAL storage of Decimal; the user kept the bound, 2026-10-09 |

## Consequences
- `Products.category : String(50)` will become an association to `Categories : CodeList` in the first feature of the pipeline (see `docs/STATE.md`).
- The `templates/entity.cds` template and the `.claude/rules/db-model.md` rule follow these rules.
- Amendment: the documents that carry the exception follow in step 10 of the `catalog-hygiene` plan: `CONVENTIONS.md` section 3 drops "The existing `price : Decimal(10, 2)` stays until a separate ADR.", the `PATTERNS.md` row "Monetary amount" drops "(historical `Decimal(10, 2)`)", and `CLAUDE.md` "Known debt" and `docs/STATE.md` "Open debt" drop the price item. `templates/entity.cds` and `.claude/rules/db-model.md` already say `Decimal(15, 2)`.

## Sources
- https://cap.cloud.sap/docs/guides/domain/
- The `cap-developer` skill of the CAP team: https://github.com/capire/skills
- Amendment: capire "Input Validation > `@assert.range`" (closed `[min, max]` interval on numeric types) and "OData > Type Mapping" (`cds.Decimal(p, s)` to `Edm.Decimal` with `Precision` and `Scale`), via `mcp__cds-mcp__search_docs` 2026-10-09; `docs/features/catalog-hygiene/research/contract-delta.md` sections 1 and 2.
