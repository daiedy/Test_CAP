# <Feature name>: screens

Written by `ux-designer` from the SAP Fiori guidelines; read by `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` and `ui-verifier` through the reading list of their brief, which selects by these section names (ADR-0031): the plan-gate sections `Floorplan and duplication check`, `Alternatives` and `Open questions for the user` reach no brief, `Verifier scenarios` only `test-ui` and `ui-verifier`. Backend agents do not read this file. One screen, one user task.

## Floorplan and duplication check
Floorplan (List Report + Object Page by default) with the guideline URL from `mcp__fiori-mcp__search_docs`; what `docs/registry/UI-ARTIFACTS.md` already has for this entity.

## Alternatives
Only for a new screen shape (a control or section kind the app does not use yet): two or three options, each with a guideline URL and a text mockup, and the recommendation. The user picks one at the plan gate; "none" when the screen reuses a shape the app already has.

## Screen: <name>
- Title and subtitle:
- Filters (no more than 5 by default):
- Table columns in order of importance (no more than 7):
- Actions and their placement (toolbar, row, header):
- Object Page sections:
- Empty state and errors:
- Criticality and statuses:
- What is shown instead of a UUID (`TextArrangement`):

## Texts
Proposed i18n keys and values for `en` and `ru`.

## Accessibility
Checklist of the `ui5-best-practices-accessibility` skill: headings, labels, keyboard, reading order.

## Theme and tokens
Standard controls and the `sap_horizon` theme; custom colors and CSS need an ADR.

## Verifier scenarios
Design-level scenarios for `ui-verifier`, in addition to the acceptance criteria of PLAN.md.

## UX risks
What can look or behave differently from the design, and how to notice it.

## Open questions for the user
List or "none".
