---
name: fe-v4-ratingindicator-clamp-on-render
description: sap.m.RatingIndicator silently clamps an out-of-range bound value to maxValue and writes the clamped value back through two-way binding on render — breaks the naive "inject invalid value, then Save" verification recipe for range-validated fields
metadata:
  type: project
---

When verifying a numeric range assertion (`@assert.range`) on a field rendered as `sap.m.RatingIndicator` (Test_CAP: `Products.rating`, `UI.DataPoint` `Visualization: #Rating`), injecting an out-of-range value directly against the OData endpoint (bypassing the UI, since the control's own `maxValue` makes the value unreachable by clicking/keyboard) and then **reloading the page** before clicking Save does not reproduce "Save is rejected": the control clamps the out-of-range bound value to its `maxValue` as soon as it renders, and being a two-way-bound edit control, that clamp fires a `change` event that PATCHes the clamped (valid) value straight back to the draft — silently curing the violation before the user (or the verifier) ever gets to press Save. The `ASSERT_RANGE` message already sitting in `DraftMessages` from the original injection is then stale/misleading (it describes a value the server no longer holds).

**Correct reproduction**: inject the invalid value via a direct `fetch`/XHR PATCH to the entity (same method as [[fe-v4-basic-auth-session-priming]] session priming, or a plain authenticated `fetch` with a CSRF token fetched via `X-CSRF-Token: Fetch`) **without reloading or re-rendering the page** — keep the front-end OData model's in-memory draft context stale/unaware of the external write, then click Save through the UI as normal. `draftPrepare` + `draftActivate` inside the resulting `$batch` will then validate the real (invalid) server-side value and `draftActivate` answers 400 `ASSERT_RANGE`, exactly as PLAN/SCREENS describe. Confirmed on Test_CAP `products-rating-column` (2026-09-25, UI5 1.152.0 via the pinned CDN bootstrap).

Generalizes to any edit control that clamps/normalizes a bound value on render (sliders, steppers, indicators with `min`/`max`): assume the control may "fix" an externally-injected boundary violation the moment it re-renders, and design range-violation verification scenarios to Save before any reload.
