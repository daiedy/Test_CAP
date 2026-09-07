---
name: fe-v4-dropdown-valuehelp-verification
description: Chrome DevTools MCP technique for verifying Fiori Elements V4 fixed-value (Common.ValueListWithFixedValues) dropdown filters, including keyboard and the exact OData query
metadata:
  type: feedback
---

When a `Common.ValueListWithFixedValues: true` field is rendered as a dropdown (MultiComboBox in a List Report filter, ComboBox in a form), this sequence reliably opens and drives it via `mcp__chrome-devtools__*` tools:

1. `click` the filter/field control to focus it (its accessibility role shows as `combobox ... roledescription="Multi Value Combo Box"`).
2. `press_key` with `F4` to open the popup. It appears in the a11y snapshot as a `dialog "Available Values"` containing a `grid` of rows — this is still the plain dropdown list, not the real Value Help Dialog (no search box, no "Define Conditions" tab, no OK/Cancel). Don't be misled by the ARIA `dialog` role into thinking a real VHD opened; screenshot it to see visually there's no dialog chrome.
3. `press_key` `ArrowDown` repeatedly to move the highlighted row, then `Enter` to select and close the popup. This is a full, valid keyboard-only accessibility test (open/navigate/select) even without literally starting from `Tab` at the top of the form.
4. After selecting, the field's token/value shows the **name** (e.g. "Kitchen"), never the code — confirm this directly in the snapshot's `option`/token text.
5. Click "Go" to apply, then re-run `list_network_requests` (filter `resourceTypes: ["xhr","fetch"]`) to find the relevant `POST .../$batch` request, and `get_network_request({reqid})` to read its multipart body — the actual OData `$filter` (e.g. `category_code eq 'KITCHEN'`, or `(category_code eq 'KITCHEN' or category_code eq 'SPORTS')` for multi-select) is inside the batch request body, not visible as a separate GET request. This is the only reliable way to confirm the exact filter expression sent to the server.

Also relevant to this project: an Object Page for a non-draft entity (`Products` has no draft in Test_CAP) never shows an "Edit" button in Fiori Elements V4 — only "Delete"/"Share". Any PLAN criterion that assumes an editable form on such an Object Page is unverifiable until draft is added; treat it as an expected, pre-documented gap, not a new defect, if the plan already calls this out as a risk.

See also [[project-run-setup]] for getting the app open in the first place.
