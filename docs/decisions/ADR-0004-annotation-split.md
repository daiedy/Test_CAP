# ADR-0004: Splitting annotations into semantics and presentation, labels via i18n

Date: 2026-09-07. Status: accepted.

## Context
Annotations lived in `srv/annotations/Products/{ui,valuehelps,constraints}.cds` with hardcoded English labels, and `@title` in `db/schema.cds`. Fiori tools and Fiori MCP expect UI annotations in the application folder (`app/<app>/annotations.cds`), and the CAP team recommends keeping Fiori annotations outside the service definitions.

## Decision
- `srv/annotations/<Entity>.cds`: data semantics, the same for all clients: `@title` via i18n, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`.
- `app/<app>/annotations/<Entity>.cds`: presentation of a specific application: `@UI.*`, `@Common.ValueList`, `@Common.Text`, `@Common.TextArrangement`. Entry point `app/<app>/annotations.cds` with `using from` only.
- No annotations in `db/schema.cds`. All texts via `_i18n/` and `webapp/i18n/`, en by default, ru translation.

## Alternatives
| Option | Why rejected |
|---|---|
| Everything in `srv/annotations/<Entity>/` (as before) | Fiori tools and MCP write to `app/`; two applications on one service would get a UI annotation conflict |
| Everything in `app/` including `@mandatory` | Validation belongs to the data, not to the screen; a second client would lose it |
| One `app/<app>/annotations.cds` file without splitting by entity | The file grows with every entity, agent edits conflict |

## Consequences
- Existing annotations were moved, Russian labels from the old `metadata.xml` snapshot were replaced with i18n keys.
- The `.claude/rules/srv-services.md` and `ui-annotations.md` rules forbid annotations in a file that is "not their own".
- The `metadata.xml` snapshot is regenerated after any annotation edit.

## Sources
- https://github.com/capire/skills (cap-developer: "Keep Fiori UI annotations in app/")
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server
