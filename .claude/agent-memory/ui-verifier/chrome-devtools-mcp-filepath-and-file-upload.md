---
name: chrome-devtools-mcp-filepath-and-file-upload
description: take_snapshot's filePath param must be inside the project workspace root (not the /private/tmp scratchpad) but saves huge context; upload_file bypasses the OS file picker's own extension filter, so it can drive a control's own client-side type validation
metadata:
  type: feedback
---

**`take_snapshot`'s `filePath` param is restricted to configured workspace roots.** Passing the session's own `/private/tmp/claude-501/.../scratchpad` path (the one named in the environment banner for the Bash tool) fails with "Access denied: ... is not within any of the configured workspace roots." A path inside the project repo (e.g. under a feature's `screenshots/` folder) works. Same restriction applies to `upload_file`'s `filePaths`: a scratch `.xlsx` built in the Bash scratchpad had to be `cp`'d into the repo before `upload_file` would accept it.

**Why this matters**: saving a full-page a11y snapshot to a file instead of returning it inline is a large context saving on any page with a big table behind a dialog (a List Report with 15+ rows re-sends the whole grid on every snapshot). Pattern that worked well: `take_snapshot({ filePath: '<repo>/docs/features/<name>/screenshots/snap-tmp.txt' })`, then `Read` with a small `limit` (the dialog's own nodes are always the first ~20 lines, before the background table nodes) to get just the `uid`s needed for the next `click`/`upload_file`/`fill` call. Delete the temp snapshot file at the end of the session (it's not a deliverable).

**`upload_file` bypasses the OS picker's own extension/type filter entirely** (there is no picker dialog to filter) — but a control's own client-side validation (e.g. `sap.ui.unified.FileUploader`'s `mimeType`/`fileType` properties) still runs on the "chosen" file and can reject it before any request is sent. This makes `upload_file` with a wrong-type file a reliable way to test a "choose a non-matching file" scenario without needing real OS picker automation: e.g. uploading a `.md` file onto a FileUploader restricted to the xlsx MIME type left `getValue()` empty and popped the framework's own "The file format you selected is not supported." error dialog, with zero network requests — equivalent in outcome to a user switching the OS picker to "All files" and picking the wrong type.

See also [[fe-v4-basic-auth-session-priming]] and [[chrome-devtools-mcp-click-reliability]] for other chrome-devtools MCP quirks found in this project.
