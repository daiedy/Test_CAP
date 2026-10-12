---
name: handler-created-draft-children
description: Measured cds 10.1.1 facts for inserting/deleting composition children inside an existing draft from a handler, typed EAV checks, req.warn persistence, two-level compositions (ADR-0027, 2026-10-12)
metadata:
  type: project
---

Facts measured on a scratch for products-details-section revision 2 (ADR-0027 accepted by the user 2026-10-12 with plan revision 2, D10-D23 at recommended defaults; research/typed-form-facts.md R1-R21):

- `INSERT.into(Child.drafts)` from a handler needs the parent's `DraftAdministrativeData_DraftUUID` (500 NOT NULL otherwise) plus `IsActiveEntity:false, HasActiveEntity:false, HasDraftEntity:false`; `SELECT.one.from(req.subject).columns(..., 'DraftAdministrativeData_DraftUUID')` works in `before('PATCH', Root.drafts)`; the `after('EDIT')` result lacks the UUID, read it from `Root.drafts`.
- `DELETE.from(Child.drafts)` cascades to the child's own composition drafts; activation then removes the active grandchildren too.
- `@readonly` element written by the handler survives `draftActivate`.
- `req.warn` in a draft PATCH handler (with or without `target`) only travels in `sap-messages` of that response; it is NOT persisted in `DraftMessages`. Only `@assert`-type validation messages persist.
- `ASSERT_DATA_TYPE` (non-number, more decimals than the column scale) rejects even a draft PATCH with 400 (no draft message).
- `@assert` constraints cannot pass message arguments; `floor(x)` is portable, `round(x, n)` is not.
- A second composition level works under lean draft: deep read, POST/PATCH/DELETE through `Root(...)/children(...)/grandchildren`, activation targets `in/children(ID=..,IsActiveEntity=false)/grandchildren(ID=..,IsActiveEntity=false)/<fk>`, top-level writes 422, each level needs its own `@restrict` copy.

**Why:** the user rejected the first UI (table) after phase 4 and redesigned to a generated typed form; these facts decide whether a handler or a constraint can do a job.
**How to apply:** reuse for any "rows generated from a code list" or typed-attribute feature; a warning that must survive needs another channel than `req.warn` (browser proof B9). Related: [[composition-under-lean-draft]], [[assert-constraint-and-dependent-vh]].
