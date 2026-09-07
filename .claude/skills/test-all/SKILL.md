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
6. Smoke of the dev server: start `npm run watch` in the background, wait up to 15 s for `curl -sf 'http://localhost:4004/odata/v4/catalog/$metadata'`, then `pkill -f 'cds watch'`; report "up in N s" or the first error lines.
7. `npx cds compile db srv app templates --to json > /dev/null` (cds-mcp compiles the templates too; duplicate namespaces break `search_model`).
8. Language check: `grep -rln "[А-Яа-яЁё]" db srv app/products/annotations app/products/webapp/ext app/products/webapp/test test scripts docs --exclude-dir=node_modules --exclude="*_ru.properties" --exclude="*.texts.csv" --exclude="*.snap" --exclude=ai-pipeline-plan.md` must return only test files that assert translated values.

For each red check give the last 20 lines of the output and propose which agent fixes it (`cap-backend-dev`, `fiori-app-dev`, `test-backend`, `docs-keeper`). Do not fix it yourself. Never write "all green" without command output.
