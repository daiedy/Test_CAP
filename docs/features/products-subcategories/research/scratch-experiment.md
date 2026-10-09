# products-subcategories: scratch experiment

Date: 2026-10-09. Author: `architect`. Location: `/Users/anton_straltsou/.claude/jobs/0714fed1/tmp/scratch` (copy of the worktree at `c7708c2` without `node_modules`, `.git`, `docs`, `.claude`; `node_modules` symlinked). Nothing in the repository's `db/`, `srv/`, `app/`, `test/` was changed.

## 1. Setup

- Baseline: `npx cds compile '*' --to edmx-v4 -s CatalogService -l en` in the scratch copy is byte-identical to the committed `app/products/webapp/localService/metadata.xml`, **697 lines**.
- Model probe: `Subcategories : CodeList { key code : String(20); category : Association to Categories; }`, `Products.subcategory : Association to Subcategories`, `@readonly entity Subcategories as projection on catalog.Subcategories`, labels in `srv/annotations/Subcategories.cds`, on `Products.subcategory`: `@title`, `@assert.target`, and the constraint below; message `PRODUCTS_SUBCATEGORY_MISMATCH` en and ru; 5 probe subcategories in CSV, one ru text.
- Runtime probe: `test/probe.test.js` with `cds.test`, `defaults.auth = { username: 'alice' }`, run with `npx vitest run test/probe.test.js`: 5 then 7 tests passed.

## 2. The constraint and the null trap

First form:

```cds
subcategory @assert: (case
  when subcategory.category.code != category.code then 'PRODUCTS_SUBCATEGORY_MISMATCH'
end);
```

Result: a product **without** subcategory was rejected with `PRODUCTS_SUBCATEGORY_MISMATCH`. CQL `!=` compares null as a value (null `!=` `'ELECTRONICS'` is true), unlike SQL `<>`.

Working form (all results below use it):

```cds
subcategory @assert: (case
  when subcategory.code is not null and subcategory.category.code != category.code
    then 'PRODUCTS_SUBCATEGORY_MISMATCH'
end);
```

## 3. Runtime results (working form)

| Request | Result |
|---|---|
| `POST /Products` active, `ELECTRONICS` + `LAPTOPS` | 201 |
| `POST` active without `subcategory_code`; with `subcategory_code: null` | 201, `subcategory_code: null` |
| `POST` active, `ELECTRONICS` + `SEATING` (a FURNITURE subcategory) | 400, `code: 'PRODUCTS_SUBCATEGORY_MISMATCH'`, `target: 'subcategory_code'`, message "The subcategory does not belong to the category of the product." |
| Same with `Accept-Language: ru` | 400, same code and target, message from `messages_ru.properties` |
| `POST` active with `subcategory_code: 'NOPE'` | 400 `ASSERT_TARGET`, target `subcategory_code` |
| `POST` active with a subcategory and without category | 400 `ASSERT_MANDATORY`, target `category_code` (the mandatory check wins) |
| `PATCH` of an active product (`IsActiveEntity=true`) changing only `category_code` to `FURNITURE` while `LAPTOPS` is set | 400 `PRODUCTS_SUBCATEGORY_MISMATCH`, target `subcategory_code`; the row is unchanged |
| Draft `PATCH` of `subcategory_code: 'MICE'` while the draft category is `FURNITURE` | 200; `DraftMessages` in the PATCH response is `[]`; the next `GET ...?$select=DraftMessages` returns `{ code: 'PRODUCTS_SUBCATEGORY_MISMATCH', target: '/Products(ID=...,IsActiveEntity=false)/subcategory_code' }` |
| `draftActivate` of that draft | 400 `PRODUCTS_SUBCATEGORY_MISMATCH`, target `in/subcategory_code` |
| Draft `PATCH { category_code: 'FURNITURE', subcategory_code: 'SEATING' }` then `draftActivate` | 200, both saved, no draft message |
| `GET /Subcategories?$select=code,name&$filter=category_code eq 'ELECTRONICS'&$orderby=code` | `AUDIO`, `LAPTOPS`, `MICE` (the request the value help sends for the In parameter) |
| `GET /Subcategories?$filter=code eq 'LAPTOPS'` with `Accept-Language: ru` | `name` = U+041D U+043E U+0443 U+0442 U+0431 U+0443 U+043A U+0438 |

A draft `PATCH` that touches only `category_code` records **no** draft message for the stale subcategory (only touched targets are written); without a reset the mismatch surfaces at Save.

## 4. Reset handler probe

```js
this.before('PATCH', Products.drafts, async (req) => {
  if (!('category_code' in req.data) || 'subcategory_code' in req.data) return;
  const current = await SELECT.one.from(req.subject).columns('category_code', 'subcategory_code');
  if (current?.subcategory_code && current.category_code !== req.data.category_code)
    req.data.subcategory_code = null;
});
```

Result: draft `PATCH { category_code: 'FURNITURE' }` on a draft with `LAPTOPS` answers 200 with `subcategory_code: null` in the response and in the next `GET`; no draft message. The probe compared categories; the PLAN rule (decision 3 of ADR-0024) instead keeps the subcategory when it belongs to the new category (`SELECT.one.from(Subcategories).where({ code, category_code })`), so a new draft whose subcategory was chosen before its matching category keeps it. That variant is proven by the backend test of PLAN step 6, not by this probe.

## 5. EDMX cost per edit (lines of `cds compile '*' --to edmx-v4 -s CatalogService -l en`)

| Edit | Added | Removed | File total |
|---|---|---|---|
| Baseline (`main` at `c7708c2`) | | | 697 |
| Phase 2 (back end): `Subcategories` entity, projection, `Subcategories_texts`, `Products.subcategory`, labels, compiler-generated ValueLists on `Products/subcategory_code` and `Subcategories/category_code`, `@assert.target` and `@assert` (both 0 lines) | 129 | 0 | **826** |
| Phase 3: `Common.Text` + `#TextOnly` on `Subcategories.code` | 3 | 0 | 829 |
| Phase 3: on `Products.subcategory`: `Common.Text`, `#TextOnly`, `ValueListWithFixedValues`, hand-written `Common.ValueList` with the In parameter (replaces the generated one; still one ValueList per property, 4 in the file) | 9 | 1 | 837 |
| Phase 3: `subcategory_code` in `UI.FieldGroup #GeneralInfo` | 3 | 0 | 840 |
| Phase 3: `Common.SideEffects #CategoryChanged` (rendered on the entity type and the entity set, 15 lines each) | 30 | 0 | 870 |
| Phase 3: `subcategory_code` column in `UI.LineItem` | 3 | 0 | **873** |

Per gate question: without the List Report column 870; with "reject at Save" instead of the reset (no SideEffects) 30 lines fewer. Against the baseline the full phase 3 file shows 176 added, 0 removed lines in `diff`.

## 6. Not measured here

- The dropdown narrowing and the field reset in a browser (no browser tool in this session): PLAN step 9, OPA5, then `ui-verifier`.
- `$batch` content of the value help request from Fiori Elements: `ui-verifier` records it (PLAN step 11).
