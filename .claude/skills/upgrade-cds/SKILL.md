---
name: upgrade-cds
description: Major version upgrade of @sap/cds and cds-dk following the official workflow of the cap-upgrade skill with the project gates. Use when the user says "upgrade cds", "move to cds <N>", "upgrade CAP" (Russian: «обнови cds», «переход на cds <N>», «upgrade CAP»).
argument-hint: <target major, for example 11>
disable-model-invocation: true
---

Target version: $ARGUMENTS.

1. Read the latest digest in `docs/upstream/UPDATES.md` and `docs/architecture/STACK.md`. Make sure the working tree is clean, create the branch `chore/cds-$ARGUMENTS`.
2. Invoke the `cap-upgrade` skill from the `cap` plugin and follow its flow (migration guide `https://cap.cloud.sap/docs/releases/migration/cds$ARGUMENTS.md`, `npx -p @sap/cds-dk@$ARGUMENTS cds upgrade`, report in `.cds-upgrade/`).
3. Project gates after every step: `npm run lint`, `npm test`, `cd app/products && npm run lint`, `node scripts/check-docs-fresh.mjs`. Investigate red results with the `debug-after-upgrade` skill.
4. Update `docs/architecture/STACK.md`, `docs/architecture/TESTING.md` (version specifics), a new ADR `docs/decisions/ADR-XXXX-cds$ARGUMENTS.md`, lines in `docs/CHANGELOG.md`, `docs/LESSONS.md` on surprises.
5. Do not touch the MCP server versions; write a recommendation in `docs/upstream/UPDATES.md` if a newer `@cap-js/mcp-server` has been released.

Commit `chore(deps): upgrade to cds $ARGUMENTS` only after green gates and on the user's instruction.
