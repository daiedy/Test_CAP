---
name: project-pricing-check-diagnosis
description: How to tell a wrong model-pricing.json price from a cache-split artefact when metrics.mjs warns pricing-check:<model>; also how UserPromptSubmit counts relate to D13
metadata:
  type: project
---

A `pricing-check:<model>` warning of `scripts/metrics.mjs` is not proof of a wrong price. Per cost-state process (`processesOf`), price the `modelUsage` tokens with the table twice, all cache writes at 5m and all at 1h. If `costUSD` lies between the two, some 5m/1h split reproduces it (implied 5m share = (all1h - cost) / (all1h - all5m) in 0-1) and the table is consistent. A process whose cost-state tokens equal its transcript's must reproduce `costUSD` to the cent. Verified 2026-09-30 on pipeline-metrics round 2 (VERIFICATION R2-4, finding R2-F7): fable and haiku were flagged at 8.5% and 10.9% while the table was exact, because the check applies the scoped transcript's split to cost-state usage that no transcript holds (sessions whose agent dirs are missing, auxiliary calls).

**Why:** the check prices whole-process cost-state tokens at the feature scope's split, so any untranscribed usage with 5m writes looks like a price error.

**How to apply:** when a pricing-check warning appears, run the per-process interval test before blaming the table; never edit `model-pricing.json` from a verification step.

Related check: after a hooks-enabled fork, the `prompt` event count of `.pipeline/metrics-<id>.jsonl` equals the post-fork D13 human + peer + task-notification sum (31 = 4 + 12 + 15), a quick cross-check for the turn-input counts. See [[project-probing-runtime-behavior]].
