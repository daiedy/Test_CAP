# ADR-0006: SAPUI5 from CDN without a pinned version, minUI5Version 1.136.0, manifest 2.0.0

Date: 2026-09-07. Status: accepted.

## Context
The application loads SAPUI5 from `https://ui5.sap.com` without a version in the path. `ui5lint` required manifest version 2 and `minUI5Version` ≥ 1.136 (the base version for legacy-free UI5). Pinning the version in the URL gives reproducibility, but requires manual bumping and watching for versions being removed from the CDN (non-LTS versions live on the CDN for up to a year).

## Decision
- `manifest.json` `_version: "2.0.0"`, `minUI5Version: "1.136.0"`, the `synchronizationMode` parameter removed.
- In development UI5 is taken from the CDN at the current version without pinning. UI5 changes are tracked by `release-watcher` via `versionoverview.json` and the `sap/fe/core` release notes.
- For production the version is pinned when deployment is set up, in a separate ADR (LTS line, currently 1.148).

## Alternatives
| Option | Why rejected |
|---|---|
| Pin 1.148 in the URL | Manual maintenance; a test project benefits from early detection of UI5 regressions |
| Local copy of UI5 via `ui5 use` | Needed for offline and deployment, not for development |

## Consequences
- Problems after a UI5 release are diagnosed with the `debug-after-upgrade` skill using `changes-<version>.json`.
- Bootstrap parameters were converted to hyphenated notation by the `ui5lint --fix` autofix.

## Sources
- https://ui5.sap.com/versionoverview.json
- https://community.sap.com/t5/open-source-blogs/introducing-openui5-2-x/ba-p/13580633
- https://github.com/UI5/linter/blob/main/docs/Rules.md
