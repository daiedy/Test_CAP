---
name: test-all
description: Full run of the project checks: cds lint, backend tests, ui5lint, registry freshness. Use before a commit or review and when the user says "run all checks", "is everything green" (Russian: «прогони все проверки», «всё зелёное?»).
allowed-tools: Bash, Read
---

Run in order from the root (PATH with `/opt/homebrew/opt/node@22/bin`), without stopping at the first error, and build a table "check → result":

1. `npm run lint`
2. `npm test`
3. `cd app/products && npm run lint`
4. `node scripts/check-docs-fresh.mjs`
5. `npm run format:check`

For each red check give the last 20 lines of the output and propose which agent fixes it (`cap-backend-dev`, `fiori-app-dev`, `test-backend`, `docs-keeper`). Do not fix it yourself. Never write "all green" without command output.
