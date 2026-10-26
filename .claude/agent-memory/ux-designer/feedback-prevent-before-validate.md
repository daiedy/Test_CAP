---
name: feedback-prevent-before-validate
description: The user's binding principle for every validation or rule design (set 2026-10-14 at the #10 plan gate) - lead with the control that makes the mistake impossible, keep the message as the fallback and the server constraint as the guard; design the control state (disabled, hint, bounds, suggestions) before the message text
metadata:
  type: feedback
---

For every rule in a SCREENS file, name and design the preventing control first (client type bounds with a visible hint, a dynamic required marker, a disabled-and-cleared dependent field, a suggestion list, the currency code list), then the message as the fallback, and say on which path the server text still reaches the screen.

**Why:** at the plan gate of `products-validations` (#10, 2026-10-14) the user set "prevent before validate" as the principle of the whole catalogue ("wherever possible look for validations and controls that leave the user no way to make the mistake; then there is nothing to check") and turned one proposed validation (battery life only for wireless products) into a control: the row is disabled and cleared, the server branch is a guard only. ADR-0028 decision 11 records it; the reviewer accepts a rule only with its control or "none".

**How to apply:** in a validation feature, open the screen section with a per-rule table "control the user sees first | message that remains, and when"; for a dependent field prefer the disabled state the page already uses (ADR-0025 Subcategory before Category) over read-only; put a hint into the framework's hint slot (placeholder) rather than a tooltip; still design the message, the second-round-at-Save behaviour and the popover entry, because API data and kept values reach the screen through them. Offer the optional controls the architect marks "optional" with both states described so the user can decide; the user accepts a control that costs EDMX lines when it removes a message from the normal path.
