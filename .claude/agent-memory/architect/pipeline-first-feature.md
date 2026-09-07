---
name: pipeline-first-feature
description: Status of the first /feature pipeline run (categories-code-list, plan approved 2026-09-07): decisions taken (ADR-0010/0011 accepted, UI tests included), doc inconsistencies found while planning, what to check in the retro.
metadata:
  type: project
---

First real `/feature` run is `categories-code-list` (branch `feature/categories-code-list`), plan approved by the user 2026-09-07 (relayed by the orchestrator) in semi-autonomous gate mode. Decisions: ADR-0010 accepted (UPPER_SNAKE codes, String(20)); ADR-0011 accepted in both parts (ValueList auto-generated from CodeList, `Common.ValueListWithFixedValues` dropdown for fixed lists, plus `Common.Text` on the code list key in `app/<app>/annotations/<CodeList>.cds`); UI tests (OPA5 via `@sap-ux/ui5-test-writer` + `ui5-test-runner`) are part of the feature; mockdata synced with CSV; `Categories.code` label is "Category", not "Category Code".

**Why:** The run doubles as a pipeline shakedown; `docs/STATE.md` says `/retro` follows it. The ux-designer's "Screens" section produced real plan changes (extra annotation file, CSV order, fallback-locale test, filter criterion wording): the design phase is load-bearing, not decorative. Doc inconsistencies found while planning, to raise in retro if docs-keeper does not fix them: (1) metadata snapshot command differs (PATTERNS without `-l en`, CLAUDE.md and fiori-app-dev with `-l en`; the committed snapshot uses `-l en`); (2) PATTERNS "Value help from a code list" wording vs. real example (see [[codelist-valuelist-autogen]]); (3) CONVENTIONS says FK is `category_ID` but for CodeLists it is `category_code`; (4) `.claude/rules/ui-annotations.md` needs the ADR-0011 consequence but is protected.

**How to apply:** In the next architect session check whether PATTERNS/CONVENTIONS/templates were updated per ADR-0010/0011 consequences; if not, list them as pre-existing debt rather than re-deriving. Reuse the plan structure (key-decisions table, migration table, criteria mapped to test names, per-step developer details, "User decisions" section replacing open questions after approval). Keep the pattern "coordinator relays user decisions -> architect updates PLAN + ADR statuses before phase 2".
