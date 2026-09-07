---
paths:
  - "mta.yaml"
  - "xs-security.json"
  - "app/**/ui5-deploy.yaml"
---
# Deployment files (protected)

`mta.yaml`, `xs-security.json`, `ui5-deploy.yaml` are drafts for Cloud Foundry and are not ready for use (no `@cap-js/hana`, `@sap/xssec`, `[production]` profile).

## Rules
- Edits only on an explicit request from the user in the current session. The task "make a feature" never includes these files.
- Any deployment work starts with an ADR in `docs/decisions/` (target platform, database, authentication) and a separate branch.
- Before editing: `mcp__cds-mcp__search_docs` for `cds add hana`, `cds add xsuaa`, `cds add mta`, `cds build --production`. Prefer `cds add <feature>` to manual editing.
- After editing: `cds build --production` without errors, `mbt build` if available.

## Forbidden
- Storing credentials, service keys, tenant URLs in these files.
- Changing `xs-security.json` without describing the roles in `docs/architecture/ARCHITECTURE.md`.
