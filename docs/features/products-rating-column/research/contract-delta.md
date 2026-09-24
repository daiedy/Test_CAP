# Research: OData contract delta per phase (scratchpad measurement)

Date: 2026-09-25. Author: `architect`. Measured on `main` at `831dd42` with `@sap/cds-dk` 10.0.7, project files untouched (`git status` clean after the run). Every figure names the phase it describes (CHANGELOG 2026-09-11 rule).

## Method

Two scratch files in `/tmp/rating-scratch/`, compiled together with the project model (`cds compile '*' <scratch>.cds --to edmx-v4 -s CatalogService -l en`) and diffed against the plain compile. The trick from `.claude/agent-memory/architect/fe-v4-semantic-key-marker.md`, extended to a model change with `extend`.

`phase2.cds` (backend phase):

```cds
using { my.catalog as catalog } from '<repo>/db/schema';
using { CatalogService } from '<repo>/srv/catalog-service';
extend catalog.Products with { rating : Integer; }
annotate CatalogService.Products with {
  rating @title: '{i18n>Products.rating}' @assert.range: [0, 5];
};
```

`phase3.cds` (UI phase, on top of phase 2):

```cds
using from '/tmp/rating-scratch/phase2';
using from '<repo>/app/products/annotations/Products';
using { CatalogService } from '<repo>/srv/catalog-service';
annotate CatalogService.Products with @(
  UI.DataPoint #Rating: { Value: rating, TargetValue: 5, Visualization: #Rating },
  UI.LineItem: [ ..., { $Type: 'UI.DataFieldForAnnotation', Label: '{i18n>Products.rating}', Target: '@UI.DataPoint#Rating', ![@UI.Importance]: #Low } ],
  UI.FieldGroup #GeneralInfo: { Data: [ ... up to { Value: category_code }, { $Type: 'UI.DataFieldForAnnotation', Label: '{i18n>Products.rating}', Target: '@UI.DataPoint#Rating' } ] }
);
```

Compiler fact learned on the way: an `annotate` that re-assigns an array term (`UI.LineItem`) already assigned elsewhere fails with `Duplicate assignment with "@UI.LineItem"` unless the scratch file `using`s the file that holds the first assignment, so the compiler can order the two; the `...` array extension then works. The implementers do not use `...`: they edit the existing arrays in `app/products/annotations/Products.cds` in place.

## Figures

| Phase | Compared | Added | Removed | Content |
|---|---|---|---|---|
| main | plain compile | 619 lines total | | baseline |
| 2, backend | main vs phase2 | 6 | 0 | `<Property Name="rating" Type="Edm.Int32"/>` in `EntityType Products`; a new `Annotations Target="CatalogService.Products/rating"` block with `Common.Label` (renders `Products.rating` in the scratch because the i18n key does not exist yet; `Rating` once `_i18n` has the key), `Validation.Minimum Int="0"`, `Validation.Maximum Int="5"` |
| 3, UI | phase2 vs phase3 | 72 | 56 | net +16 (re-measured after `SCREENS.md`, was +15 without the importance): the `UI.DataPoint` `Qualifier="Rating"` record (7 lines: `Value` Path `rating`, `TargetValue` Int 5, `Visualization` EnumMember `UI.VisualizationType/Rating`), one `UI.DataFieldForAnnotation` record as the 5th and last `UI.LineItem` entry (5 lines: `Label`, `Target` AnnotationPath `@UI.DataPoint#Rating`, `UI.Importance` EnumMember `UI.ImportanceType/Low`), the same record without importance as the 4th entry of `UI.FieldGroup#GeneralInfo` between `category_code` and `imageUrl` (4 lines, position confirmed in the compiled output). The other 56/56 lines are a positional move of the neighbouring `Common.SemanticKey`, `Common.SideEffects#alwaysFetchMessages` and `Common.Messages` annotations inside the same `Annotations` block, the same churn ADR-0015 recorded |
| 3b, UI (read-only alternative) | phase2 vs phase3 without the FieldGroup record | 53 | 41 | net +12 |
| 3c, UI (fragment alternative) | phase2 vs phase3 without the LineItem record | 53 | 42 | net +11 |
| 2 + 3 | main vs phase3 | 78 | 56 | net +22, 641 lines total |

Not in the scratch, so not measured: the draft-related duplicates FE reads through `CatalogService.EntityContainer/Products` carry no per-element annotations, so no second copy of the `rating` block appeared; the `UI.*Hidden` annotations (ADR-0013) are untouched.

## Consequences for the plan

- Phase 2 gate: `npx vitest -u` and the `metadata.xml` regeneration in the backend phase; the sync test must be green there (PLAN contract rule). Expected snapshot diff: +6/-0.
- Phase 3 gate: the same two regenerations again; expected snapshot diff against the phase 2 snapshot: net +16 (raw +72/-56) with churn, so the reviewer reads the diff for content, not for line count.
- The mock server serves `localService/metadata.xml`, so mock mode shows the column only after the phase 3 regeneration and only with `rating` values in `mockdata/Products.json`.
