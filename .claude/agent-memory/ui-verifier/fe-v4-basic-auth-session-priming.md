---
name: fe-v4-basic-auth-session-priming
description: How to get a chrome-devtools MCP tab authenticated against Test_CAP's Basic-Auth-protected :4004 OData service without a native dialog, for a given user (alice/viewer/etc)
metadata:
  type: project
---

Since ADR-0013 (`catalog-authorization`), `:4004` requires HTTP Basic Auth on every request including `$metadata`, `manifest.json`'s relative fetches, and the OData service itself. chrome-devtools MCP's `handle_dialog` cannot answer a native browser Basic-Auth prompt (only JS dialogs), so navigating straight to a protected URL leaves the tab stuck.

**Do not** embed credentials in the navigated URL (`http://alice:@localhost:4004/...`): the page loads once via the browser's own credentialed fetch of the *document*, but `sap-ui-core`'s relative `fetch('../manifest.json')` calls throw `TypeError: Failed to execute 'fetch': Request cannot be constructed from a URL that includes credentials` because the page's own base URL still contains `alice@` — the component fails to load ("SAP UI5 component of the application could not be loaded").

**Working recipe**, one `evaluate_script` call before navigating to the real sandbox URL:
```js
async () => new Promise((resolve) => {
  const x = new XMLHttpRequest();
  x.open('GET', '/odata/v4/catalog/$metadata', true, '<user>', '');
  x.onload = () => resolve(x.status);
  x.onerror = () => resolve('error');
  x.send();
})
```
`XMLHttpRequest.open(method, url, async, user, password)` supports a credentials parameter (unlike `fetch`), and completing one authenticated request caches the Basic Auth challenge/response for the browser's connection to that origin — after this, a **plain** navigation to `http://localhost:4004/products/webapp/test/flpSandbox.html#...` (no embedded credentials) loads normally with all sub-requests authenticated.

For a second identity (e.g. `viewer` after `alice`) in the same test run, open a `new_page` with a distinct `isolatedContext` name — that gets its own cookie/auth jar, so you can prime it with `viewer`'s XHR without evicting `alice`'s cached credentials in the other tab.

See also [[project-run-setup]] for the general server startup steps.
