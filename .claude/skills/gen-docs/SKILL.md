---
name: gen-docs
description: Regenerates docs/registry from the model and sources and checks documentation freshness. Use when the user says "update the registry", "documentation is stale" (Russian: «обнови реестр», «документация устарела»), after changes in db/, srv/, app/.
allowed-tools: Bash(npm run docs:registry), Bash(node scripts/check-docs-fresh.mjs*), Read
---

1. `npm run docs:registry` (PATH must contain `/opt/homebrew/opt/node@22/bin`).
2. `node scripts/check-docs-fresh.mjs`: it must print `docs/registry is fresh.`
3. Read the registry diff (`git diff --stat docs/registry`) and briefly tell the user what changed in the model, services, handlers or UI.
4. If code changed, remind about the lines in `docs/CHANGELOG.md` and the update of `docs/STATE.md`; if needed, delegate to `docs-keeper`.
