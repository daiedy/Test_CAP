---
name: chrome-devtools-mcp-click-reliability
description: Plain DOM .click() via evaluate_script is unreliable on some sap.m.Button/sap.m.Dialog controls in the FLP sandbox; the chrome-devtools MCP click tool (real pointer sequence) is reliable. Also, JS .focus() on a control right after a dialog closes gets overridden by the framework's own focus-restore.
metadata:
  type: feedback
---

Found verifying `products-rating-filter` (#6) with chrome-devtools MCP against `npx cds serve --in-memory --port 4004`, UI5 1.152.0.

**`.click()` via `evaluate_script` can silently no-op.** Calling `element.click()` in a page script on the List Report's "Adapt Filters" button, its dialog's "Cancel" button, and the DynamicPage "Expand/Collapse Header" toggle sometimes did nothing observable (no dialog opened/closed, no header state change), even though the same button reliably worked when clicked through `mcp__chrome-devtools__click` on a snapshot `uid` (which dispatches a full pointer event sequence, closer to a real user click). When a DOM click on a button appears to have no effect, retry with the MCP `click` tool on a fresh snapshot `uid` before concluding the control is broken.

**A JS `.focus()` call right after a dialog closes can be overridden.** Immediately after closing a `sap.m.Dialog` (e.g. "My Views" or "Adapt Filters"), calling `.focus()` on another control (a RangeSlider handle) inside the same or a chained `evaluate_script` call did not stick — `document.activeElement` reverted to the dialog's last-focused element (e.g. its search field) even ~1 second later. This looks like the framework's own popup focus-restore running asynchronously and re-winning the race. Workaround that worked reliably: use the MCP `click` tool (not JS `.focus()`) to focus the target control via a snapshot `uid`, then `press_key` for the keyboard interaction — a real click is not overridden the same way.

**How to apply**: for any FE V4 / UI5 verification scenario involving dialogs (My Views, Adapt Filters, Save As, value help), prefer the MCP `click`/`press_key` tools over `evaluate_script`-driven `.click()`/`.focus()` for anything that must actually register with the framework; reserve `evaluate_script` for reading state (`sap.ui.getCore().byId(...).getRange()`, network/console inspection) or for low-level DOM event dispatch that has no MCP equivalent (e.g. simulating a real mouse drag with `mousedown`/`mousemove`/`mouseup`, which has no dedicated MCP tool).
