---
name: cds-add-data-touches-mta
description: cds add data (cds-dk 10.1.0 local) also merges its mta facet into the protected mta.yaml; check git status right after running it
metadata:
  type: project
---

`npx cds add data --filter <Entity> --records N` (local `@sap/cds-dk` 10.1.0, 2026-10-09, feature `products-subcategories`) wrote the two CSVs and, without saying so in its output, changed `mta.yaml`: `instances: 1` under the srv module parameters and `npm ci` + `npx cds build --production` appended to the custom builder commands. It also still writes comma CSV with random locales and a `descr` column (see the architect topic [[cds-add-data-localized]]).

**Why:** `mta.yaml` is a protected file (CLAUDE.md, protocol section 9); an unrequested edit there must not ride along in a feature change.

**How to apply:** run `git status --short` immediately after `cds add data`; if `mta.yaml` shows up and was clean before, restore it with `git restore mta.yaml` (it is your own accidental side effect, not a gate workaround) and say so in the report and the CHANGELOG line.
