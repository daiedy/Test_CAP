---
name: feedback-prevent-before-validate
description: User principle (plan gate of #10, 2026-10-14) - prefer controls that make a mistake impossible over validating after the fact; every catalogue rule names its preventing control, the server constraint stays the API guard; the user rejects rules without a domain reason and accepts "showcase" rules only when they demonstrate a mechanism
metadata:
  type: feedback
---

Rule: when designing validations, first look for a control that leaves the user no way to make the mistake (client type constraints, a dynamic required marker, a disabled and cleared dependent field, a suggestion list, a code-list customizing); add the server constraint as the guard on every path (API, import, draft, Save) and mark it "guard, not user-facing" when the control makes it invisible. List per rule the "preventing control" or "none, validation only".

**Why:** at the #10 plan gate the user turned R12 ("battery life only for wireless") from a validation into a disabled field: "wherever possible look for validations and controls that leave the user no way to make the mistake; then there is nothing to check". He rejected a counting rule with no domain reason (R14) and accepted cross-row and power-of-two rules only as examples of what the mechanism can do ("I would not add such items myself"). He also prefers data-driven rules (an association or flag in the seed) over literal codes in annotations when the expression stays simple, and drops a rule when a remodel removes its reason (R9: free-text dimensions replaced by numeric attributes in a separate issue).

**How to apply:** in every validation spec add a "Preventing controls" table next to the rule catalogue; put the control in the UI step and the guard in the semantics step; name the cost of an optional control as a decision item; state a domain reason for every rule or mark it a showcase. Related: [[validation-toolkit-facts]], [[feedback-ux-over-framework-default]].
