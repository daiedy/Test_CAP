---
name: flp-sandbox-flex-connector
description: UI5 flexibility connector facts for the FLP sandbox (spec sandbox-flex-connector #11, 2026-10-08): external:false config key, sandbox.js/sandbox2.js overwrite window["sap-ui-config"], OPA journeys launch flpSandbox.html in an iframe, sap.fe.test variant API and the vacuous iSeeVariantModified(false), ui5-test-runner fresh profile per page, preview-middleware precedent; ADR-0024 proposed
metadata:
  type: project
---

Spec `sandbox-flex-connector` (#11) written 2026-10-08; ADR-0024 proposed (connector kind, placement, bounded `tests-ui.md` exception, layers). Facts from UI5 1.153.0 CDN debug sources (fiori-mcp 1.12.2 has nothing on the bootstrap attribute, the connectors or the `sap.fe.test` variant API):

- `sapUiFlexibilityServices` is read by `sap/ui/fl/initial/_internal/FlexConfiguration` with `external: false`: a URL parameter is ignored; default `[{url:'/sap/bc/lrep', connector:'LrepConnector'}]`. Only the bootstrap attribute (`data-sap-ui-flexibility-services`, dashed form measured in #6) or `window["sap-ui-config"]` work.
- Both `test-resources/sap/ushell/bootstrap/sandbox.js` (legacy) and `sap/ushell/bootstrap/sandbox2.js` end with `window["sap-ui-config"] = { "xx-bootTask": ... }`, so a config placed in `flpSandboxConfig.js` is overwritten: the attribute on the `sap-ui-core.js` tag is the only placement that survives the New Sandbox migration (#21).
- `SessionStorageConnector`/`LocalStorageConnector` = public `ObjectStorageConnector` (`layers: ["ALL"]`, keys prefixed `sap.ui.fl`) + `window.sessionStorage`/`localStorage`; `loadFeatures` adds `isPublicLayerAvailable: true` (Save As may show a Public checkbox). SAP's `@sap-ux/preview-middleware` 1.2.19 defaults a CAP project to `LocalStorageConnector` with `layers: ['CUSTOMER','USER']` and no `LrepConnector`; Sandbox 2.0 gets it as `restricted.flexibilityServices` in `fioriSandboxAppConfig.json`.
- OPA5 is NOT independent of the sandbox (issue #21's hint is wrong): `pages/JourneyRunner.js` `launchUrl` is `test/flpSandbox.html`, `sap/fe/test/BaseArrangements.iStartMyApp` opens it in a same-origin iframe. A sandbox bootstrap change therefore reaches every journey.
- `sap.fe.test.ListReport` page-level: `iSaveVariant(name, default, auto)`, `iSelectVariant(name)` (presses the `-vm-list` item, fires the real `select` -> `VariantManagerApply.handleSelectVariant` -> `eraseDirtyChangesOnVariant` when modified), `iSeeVariantTitle`, `iSeeVariantModified(true)` (real, `sap.m.Text` `-vm-modified` = "*"). `iSeeVariantModified(false)` is VACUOUS (waits for `sap.m.Label`, indicator is a Text): assert `getModified() === false` in a page object. No remove action exposed; `sap/fe/test/builder/VMBuilder.doRemoveVariant(name)` exists (`@ui5-restricted`).
- `ui5-test-runner` 5.14.1 forks one browser process per test page (`src/browsers.js`) and launches puppeteer without `userDataDir`: with `--split-opa` every journey starts with empty session and local storage. `BaseArrangements.resetTestData` clears both storages but only via `iResetTestData`.
- `webapp/index.html` has the same legacy two-script bootstrap as `flpSandbox.html` and the same gap; no script opens it.

**Why:** the literal issue text ("add the attribute") hides three traps: the URL-parameter shortcut does nothing, the config-file placement is silently overwritten, and the obvious `sap.fe.test` "not modified" assertion cannot fail.

**How to apply:** any sandbox bootstrap setting goes on the `sap-ui-core.js` tag; any saved-view test uses `iSelectVariant` + a `getModified()` page-object check with a negative-control run against the unpatched page. Related: [[fe-v4-custom-filter-field]], [[test-suite-shape]].
