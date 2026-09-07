---
name: cds-add-data-localized
description: cds add data (cds-dk 10.0.7) generates both <Entity>.csv and <Entity>.texts.csv for localized entities, but comma-separated with random locales; plans must include a cleanup step.
metadata:
  type: project
---

`cds add data --filter <Entity> --records N` for a `localized` entity creates `<ns>-<Entity>.csv` and `<ns>-<Entity>.texts.csv`, comma-separated, with placeholder values (`name-729316`) and random locales (`ru`, `hu`, ...). The project rule `.claude/rules/data.md` requires `;` and only `en` base + `ru` texts.

**Why:** Observed 2026-09-07 in a scratch project while planning `categories-code-list`; a plan that says just "run cds add data" leaves the developer with a file that violates data.md.

**How to apply:** Every plan step that generates CSV must say: run the generator, then normalize separator to `;`, drop unused columns (`descr`), keep only `ru` rows in `.texts.csv`, replace placeholders. Consider proposing a LESSONS entry after the first real run confirms it.
