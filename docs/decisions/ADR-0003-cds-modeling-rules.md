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
- The existing `Products.price : Decimal(10, 2)` is kept as a historical exception; changing the precision requires a data migration and a separate ADR.
- `Products` was switched from an explicit `key ID : UUID` to `cuid` (equivalent, no contract change).

## Alternatives
| Option | Why rejected |
|---|---|
| `enum` for product categories | The user cannot add a value without a deployment; no translations |
| Rename the namespace to `sap.catalog` or a domain one | Breaks CSV, snapshots, gives nothing |

## Consequences
- `Products.category : String(50)` will become an association to `Categories : CodeList` in the first feature of the pipeline (see `docs/STATE.md`).
- The `templates/entity.cds` template and the `.claude/rules/db-model.md` rule follow these rules.

## Sources
- https://cap.cloud.sap/docs/guides/domain/
- The `cap-developer` skill of the CAP team: https://github.com/capire/skills
