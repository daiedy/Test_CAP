---
name: fe-v4-action-dialog-and-refresh
description: FE V4 (UI5 1.152) action parameter dialog reads "required" only from the parameter's Common.FieldControl; no list refresh after a scalar-returning action without Common.SideEffects; how to measure EDMX deltas and FE internals without touching the project
metadata:
  type: project
---

Facts from products-excel-upload phase 3 (2026-09-25, ADR-0021 amendment A and B, research section 7):

- **Required action parameter.** FE V4 1.152 `OperationParameterDialog` computes `required` with `FieldControlHelper.isRequiredExpression(parameter)`: only the parameter's `Common.FieldControl` (Mandatory or 7). `Nullable="false"` from `not null` is ignored (measured: no asterisk, empty submit silently does nothing). For a file (complex type with `Edm.Stream`) the annotation must be on the parameter, not the stream element. `@mandatory` on the parameter (`annotate X with actions { a(p @mandatory) }`) emits `Common.FieldControl` Mandatory (+1 EDMX line). Then `ActionRuntime.validateProperties` sets value state Error with framework text `C_OPERATIONS_ACTION_PARAMETER_DIALOG_FILE_MISSING_MANDATORY_MSG` ("Upload a file for "{0}".", ru exists), no request; choosing a file clears it. fiori-mcp docs call `Nullable=false` params "mandatory" — misleading.
- **Refresh.** FE refreshes by itself only after create, delete, draft actions and a bound action returning a different instance. A collection-bound action returning `Integer` needs `@Common.SideEffects: { TargetEntities: ['/<Service>.EntityContainer/<Set>'] }` on the action (app layer, +9 EDMX lines); FE then adds a GET to the same `$batch`. PATTERNS row "Refresh after an action".
- **i18n.** `{i18n>...}` in any `.cds` (incl. `app/<app>/annotations`) resolves from `_i18n`/`i18n` folders next to the file and upwards, never `webapp/i18n`. `.claude/rules/ui-annotations.md` said otherwise (reported to the user 2026-09-25; protected file).

**Why:** SCREENS had "(inferred)" required marker and auto-refresh; both failed on measurement and cost a phase 3 amendment round.

**How to apply:** Any future action with parameters: plan `@mandatory` on required parameters from the start and a `Common.SideEffects` for any action whose result the UI must show. When fiori-mcp is silent, read the CDN debug sources (`https://ui5.sap.com/resources/sap/fe/macros/coreUI/OperationParameterDialog-dbg.js`, `sap/fe/core/ActionRuntime-dbg.js`, `sap/fe/core/templating/FieldControlHelper-dbg.js`, `sap/fe/core/messagebundle*.properties`). Measure an EDMX delta without editing the project: a scratchpad `.cds` with `using from '<abs>/srv/catalog-service'; using from '<abs>/app/products/annotations';` plus the probe annotation, `npx cds compile <file> --to edmx-v4 -s CatalogService -l en`, diff against `metadata.xml`. See [[excel-import-mechanism]], [[role-aware-ui-singleton]].
