# pipeline-metrics: review (plan step 12, phase 5)

Date: 2026-10-02. Reviewer: `reviewer`. Scope: `git diff main...HEAD` (`dd34026`..`efcbe61`, base `c10c4f0`) plus the uncommitted `docs/STATE.md` `Now` edit. Read-only review; owners named per finding.

## Blocking

- none

## Important

- `scripts/lib/pipeline-metrics.mjs:427-467` (`pricingCheck`), `:768-771` (warning), `:891-895` and `:1172-1174` (`pricingOk`): R2-F7, decided by the user on 2026-10-02. The pricing self-check prices cost-state cache writes with the transcript's 5m/1h share. cost-state also holds tokens that are in no transcript (H1), so the check flags correct prices (`claude-fable-5-1` 8.5%, `claude-haiku-4-5-20251001` 10.9% on this feature), sets `pricingOk: false`, and will put a false WARNING on this feature's `## Cost` card at step 13. That breaks the purpose of `PRICING_TOLERANCE` in definitions section 5 ("a divergence signals a stale price table"). The fix is the user's interval rule: per model, price cost-state's own tokens once with every cache write at the 5m rate and once at the 1h rate, and warn only when `costUSD` < all-5m price × (1 − 0.05) or > all-1h price × (1 + 0.05). `divergence` becomes the distance outside that interval (0 inside it), and the card and `reconcile` texts keep their keys. Owners: architect (definitions section 5 rule; PLAN criterion 6 wording "warns when a model's pricing self-check diverges" → "falls outside the 5m-1h interval widened by `PRICING_TOLERANCE`"), then cap-backend-dev (`pricingCheck`), then test-backend. For test-backend: the `e-drift` variant (+10%) must still warn, a process whose `costUSD` lies between its all-5m and all-1h prices must not warn, and one case must sit just outside the widened bound. Blind spot of the rule, worth stating in section 5: a price error smaller than the interval width hides inside it (opus on #7: about 16% of cost).
- `scripts/lib/pipeline-metrics.mjs:1066-1092` (`compareLines`), `:1358-1371` (`renderCompare`), `:1374-1384` (`renderBriefingLine`): D4 is not implemented as defined for `compare`. Definitions D4 "History line" says `record --force` writes `costPartial: true` "so `compare` can tell it apart". `compareLines` drops `costPartial`, and `renderCompare` prints `fmtUSD` with a numeric `Δ cost`, so a forced partial line shows up as a real drop in cost, which is the exact failure D4 names. The briefing line also prints a partial cost without `≥`. There is no partial line in `history.jsonl` today, so no current figure is wrong. Fix (cap-backend-dev): carry `costPartial` into the compare row, print the cost through `fmtCost(x, partial)` (`≥$x`), and print the cost delta as `n/a` when this line or the previous one is partial (the same treatment as `gatesComparable`). Use `fmtCost` in `renderBriefingLine` too. test-backend: extend "compares history lines with deltas" with one `costPartial: true` line.
- `scripts/lib/metrics-log.mjs:72-75` (`internalAgent`), used at `scripts/hooks/subagent-stop.mjs:157-159`: the filter recognises only one shape of internal agent, an empty `agent_type` and no file (data-flow section 2). Session `326296f3` logged a second shape. `.pipeline/metrics-326296f3-f6f1-4565-a061-8ed1d810c0fc.jsonl` holds an `agent-stop` with `agentType: "claude"`, `requests: 0` and a `transcriptPath` that does not exist (17:37:32Z). The reader skips such a record (`buildReport` line 642 needs `requests > 0`), so cards are unaffected. The hook, however, also records `gate` for it. An internal stop runs the same lint and protected checks over the whole working tree and fires about every 32 s during a subagent run. When another agent's in-progress file has an eslint error, each such stop exits 2 and appends `gate lint` (or `protected`) under `agentType: claude`. That inflates `gateBlocks`, a committed history field, so data-flow section 2 ("writes neither `agent-stop` nor `gate`") is not met. Fix: architect restates the rule as "an agent whose `agent_transcript_path` is given but has no file, or an agent with neither a type nor a file", so a missing path field (older Claude Code) still meters a typed agent. cap-backend-dev changes `internalAgent()` to match. test-backend adds a `{ agent_type: 'claude', agent_transcript_path: <missing> }` case to "writes a gate record at every blocking exit" (same exit 2, no record).

## Minor

- `scripts/lib/pipeline-metrics.mjs:348` (`featureRecords` `complete`) and `:1300-1302` (`renderCard`), known item (c). `cost-state` records carry no `gitBranch` and no `timestamp`, and neither do several UI-state record types. In feature scope `recordCount(scoped) === recordCount(session)` is therefore false for every session that holds a cost-state record, and the "wholly in scope carries 1, whatever is priced" branch of `processShare` never runs there. The CHANGELOG line of 2026-09-29 says `complete` is set "when it cut nothing", which does not happen in practice. With priced models the proportional share gives 1 anyway. With nothing priced, the feature card shows the cost-state side as n/a, and the text `metrics.card.costState.none` "(no cost-state record)" is wrong when a record exists and only the share is unknown (the `cost-state-share-unknown:` warning is the only correct signal). Fix (cap-backend-dev): compare only records that can be in scope (exclude `cost-state` and records without `ts`/`gitBranch`), and add a key `metrics.card.costState.shareUnknown` (en and ru) for `costStateProcesses > 0 && costStateUSD == null`. test-backend: a feature-scope variant of `k-unpriced`.
- `scripts/hooks/subagent-start.mjs` (whole file), known item (b), VERIFICATION F1: `agent-start` is written as criterion 14 requires, but nothing reads it (`launches` and `resumes` come from the transcript, D9). This is dead data, not a defect. Fix (architect): either name a consumer in data-flow section 3 (for example a live cross-check of `resumes` = `agent-start` count − 1 per agent, which would also show the F5 copy inflation of `resumes`), or record in ADR-0022 that the record is kept for that later use. No code change in this feature.
- `test/metrics.test.js:1169-1215` against `scripts/lib/transcript-usage.mjs:104-112,166-197`: no test feeds `slim()` a record that carries content. The allowed-keys test checks the fixture input, and the fixture holds no text by its own rule. The hooks sentinel test covers prompt, compact and `last_assistant_message`, but the agent transcript it parses comes from the same fixture. Code reading confirms `slim()` keeps exactly the definitions section 1 list today. Still, a regression that keeps `c.input` (an `Agent` `prompt`/`description`, a `SendMessage` `message`), `attachment.prompt`, `origin.body` or text/thinking blocks would pass every test, while PLAN Risks names privacy as guarded by tests. Fix (test-backend): one assertion that builds a raw record with a sentinel in every dropped field and expects `JSON.stringify(slim(r))` not to contain it.
- `scripts/hooks/user-prompt.mjs:2-3`: the header says "counts user prompts in the metrics event log". Since D13 the `prompt` record is a command marker only and counts nothing (data-flow section 2). Fix (cap-backend-dev): reword it to "marks `/spec` and `/feature` commands (D10); counts nothing (D13)".
- `scripts/hooks/user-prompt.mjs:15-24`: `arg` is kept for every command, but only `spec` and `feature` args are read (D10, `promptWindows`). For `/backlog <description>` the first lowercase word of free text is stored, for example `/backlog customer-x wants ...` gives `arg: "customer-x"`. This is allowed by data-flow section 2 as written, but it is prompt text that no figure needs. The privacy test dodges it with an uppercase sentinel. Fix: architect narrows data-flow section 2 ("`arg` only for `spec` and `feature`"), and cap-backend-dev keeps `arg` only for those two commands.
- `docs/STATE.md` `## Open debt` and `docs/features/pipeline-metrics/VERIFICATION.md:463`: user decision D (CONTEXT) puts F5 (a forked session's card includes the parent's copied history) in STATE open debt. STATE has no such row, and VERIFICATION round 2 says F1 and F5 "stay open, as listed in `docs/STATE.md`", which is not true today (no STATE change on the branch: `git log main..HEAD -- docs/STATE.md` is empty). Fix (docs-keeper, step 13): add the F5 row (and F1 if the architect keeps the record without a consumer), and correct the VERIFICATION sentence or let SUMMARY state it.
- `.claude/skills/feature/SKILL.md:51`: the VERIFICATION "Process finding (orchestrator)" asks the `Phase: <N>: <label>` rule to say that STATE edits go through Edit or Write, because a Bash write fires no PostToolUse and leaves no `phase` marker. The rule does not say so, so a phase can silently fall back to home phases. Fix (docs-keeper, step 13, protected path under `PIPELINE_ALLOW_PROTECTED=1`): add "edit it with Edit or Write, never through Bash (the phase marker comes from PostToolUse)", and re-record the prompt budget.
- `scripts/lib/pipeline-metrics.mjs:25` ↔ `scripts/lib/backlog.mjs:12`, known item (e): an import cycle. It is safe today (no top-level use of `t` or `HISTORY_FILE`) and documented at `backlog.mjs:5-7`. Still, the "pure" aggregation module depends on the backlog/`gh` module only for `t`, and any future top-level use, such as a module-level `t(...)` or `export const X = HISTORY_FILE`, throws a TDZ `ReferenceError` depending on the entry module. Fix (cap-backend-dev, may be deferred to open debt): move `pickLang`/`readLocalSettings`/`loadBundle`/`t` into `scripts/lib/i18n.mjs`, re-exported from `backlog.mjs`, so `pipeline-metrics.mjs` imports only that module.

## Known items (a)-(h)

- (a) Important, see the `internalAgent` finding. The reader's zero-request filter protects the card but not `gateBlocks`.
- (b) Minor, see the `agent-start` finding (architect decides on a consumer or an ADR note).
- (c) Minor, see the `featureRecords` `complete` finding. The edge case is real (nothing priced), and the "no cost-state record" text is wrong in it.
- (d) No finding. The race case on `c-time`/`c1` covers the same rule (the whole file holds one request more than the last live stop, and the cut equals it), and `test/fixtures/transcript-fixture.mjs:14-17` documents why `a1` stays fixed (the hooks test pins its whole-file aggregate). docs-keeper lists it under the SUMMARY "Deviations" so data-flow section 5's `agent-a1` wording is not taken as fact after the prune.
- (e) Minor, see the cycle finding.
- (f) Important, recorded as decided by the user (2026-10-02): the interval rule widened by `PRICING_TOLERANCE`. I agree. A known 5m/1h split is not available for cost-state tokens outside the transcripts, so an interval test is the only one that does not raise false warnings. Its blind spot (an error smaller than the interval width) should be stated in definitions section 5.
- (g) No finding. The positional read `renderBriefing(b).split('\n').slice(3, 4)` in `scripts/backlog.mjs:55` is byte-identical on `main`. The metrics line is placed after the status line, the constraint is documented at `scripts/lib/backlog.mjs:241-243`, and "briefing prints the last metrics line" pins line index 3. This is pre-existing fragility that the change does not worsen.
- (h) Accepted debt by user decision D (CONTEXT). Not a code finding. The missing STATE row is the docs-keeper Minor above.

## Checked and in order

- Every blocking exit records its `gate`, read in the code (including the reasons no test exercises). `subagent-stop.mjs` `lint` :176, `protected` :203, `mcp` :256, all before `exit(2)`. `stop-gate.mjs`: every `exit(2)` goes through `block(reason)` :56-60, which covers `protected` :82, `state-shape`/`state-budget` :105, `registry` :136, `docs` :157, `tests-timeout` :171 and `tests` :176. `protect-files.mjs` deny :36. `protect-files-bash.mjs` deny for a subagent only :105, while the main-thread `ask` is the user's decision (data-flow section 2). No other `exit(2)` or `deny` site exists in `scripts/hooks/`.
- Metrics writes never change a gate decision or exit code: `recordGate`, `recordAgentStop`, `recordPhase`, `recordSession`, the compact append, `user-prompt`/`subagent-start` and the stop-gate `exit` listener are each wrapped in try/catch. The `exit` listener never sets `exitCode`, and `pipeline-metrics.mjs` is imported lazily in the hooks.
- `slim()` (`transcript-usage.mjs:166-197`) keeps exactly the field list of definitions section 1: identifiers, usage numbers, tool names, `Agent` `id`/`subagent_type`, string `SendMessage` `to`, `toolUseResult` and `hookErrors` as booleans, the cost-state fields of `COST_STATE_FIELDS`/`MODEL_USAGE_FIELDS`, and the D13 enums only through `INPUT_KINDS`. No text, thinking, prompt, tool input, tool output or hook error text survives.
- No second reader. There is one JSONL reader, `readJsonl` (`hook-utils.mjs:218`), used by `readAudit`, `readMetrics`, `readTranscript`, `lastHistoryLine`, `record`/`compare` and the tests. One section reader, `sections()`/`readSection`. No new glob matcher (`ruleFor` reuses `isUnder`). One i18n loader (`loadBundle`/`t`). One pricing reader (`loadPricing`, also in `subagent-stop.mjs` and the tests). Exactly two git readers of feature docs, `featureDoc()` (`metrics.mjs:120`) and `reworkPlan()` (`:140`); `gitLines` reads commit stats, not documents. One baseline mechanism (`record` + `history.jsonl`).
- D1-D13 as defined, with the exceptions listed above (D4 compare, section 5 check): D1 per-field max and `uuid` dedupe; D2 `<synthetic>` skipped; D5/D6 caps and the turn-gap tools; D8 per-thread; D10 branch plus `/spec`/`/feature` windows; D11 `phaseOf` (first integer 0-7, `11e` not matched); D12 `planAssignments`, `planApproved`, the `--full-history` walk and the pre-first-marker rule; D13 enums only.
- i18n: 67 keys in `pipeline.properties` and `pipeline_ru.properties`, the same key sets; every `metrics.*` key used in code exists. No user-facing literal in the code.
- Language: no Cyrillic outside `pipeline_ru.properties`, asserted test values (`test/backlog.test.js:130,180`) and the rendered card quoted in `VERIFICATION.md`. The skill `description` lines are unchanged from `main`.
- Hooks registered in `.claude/settings.json` (UserPromptSubmit, SubagentStart, timeout 10 s). `/feature` phase 7, `/retro` section 1, `docs-keeper` step 5, `templates/feature/SUMMARY.md` `## Cost` and the `CLAUDE.md` map row are as in data-flow section 6. `test/prompt-budget.json` was re-recorded, with a CHANGELOG line.
- `docs/metrics/history.jsonl`: 4 baseline lines with `costPartial: false` and `reworkSource: plan`; D13 figures 9/0/11, 4/9/10, 1/13/16, 7/29/35 (criterion 33); rework shares 0, 0, 0.117, 0.213.
- Model and layers: no `db/`, `srv/`, `app/` change, no contract change. `scripts/**` follows ESM, Node built-ins only, and has no `console.log`.
- Expected at this phase (docs-keeper step 13, not findings): PATTERNS row "Pipeline metric", the STATE "What works" and test counts, SUMMARY, LESSONS, unticked criteria 19 and 20.

## Checks (fresh output)

All run once in a single shell call after the findings were written (2026-10-02). The same results came from an earlier run at 16:20.

```
== npm test
 Test Files  10 passed (10)
      Tests  130 passed (130)
== eslint                      (npx eslint scripts test)
EXIT 0
== prettier                    (npx prettier --check scripts test)
Checking formatting...
All matched files use Prettier code style!
EXIT 0
== feature docs                (node scripts/check-feature-docs.mjs pipeline-metrics)
docs/features/pipeline-metrics: PLAN.md and CONTEXT.md keep the shape of the templates.
EXIT 0
== prompt-budget               (node scripts/prompt-budget.mjs)
  10341  CLAUDE.md
 109679  total
EXIT 0
== docs fresh                  (node scripts/check-docs-fresh.mjs)
docs/registry is fresh.
EXIT 0
== compare                     (PIPELINE_LANG=en node scripts/metrics.mjs compare; the ru run gave the same figures)
| Feature | Recorded | Cost | Δ cost | Active | Δ active | Rework | Δ rework | Gates | Δ gates | Prompts / hand-backs / notifications |
|---|---|---|---|---|---|---|---|---|---|---|
| catalog-authorization | 2026-09-29 | $65.39 | - | 3h 39m | - | 0% | - | 2 | - | 9 / 0 / 11 |
| products-rating-column (#5) | 2026-09-29 | $13.93 | -$51.46 | 1h 11m | -2h 29m | 0% | ±0 pp | 2 | ±0 | 4 / 9 / 10 |
| products-rating-filter (#6) | 2026-09-29 | $27.81 | +$13.88 | 1h 56m | +45m | 12% | +12 pp | 1 | -1 | 1 / 13 / 16 |
| products-excel-upload (#7) | 2026-09-29 | $62.02 | +$34.21 | 3h 30m | +1h 35m | 21% | +10 pp | 7 | +6 | 7 / 29 / 35 |
EXIT 0
== compare of a partial line (scratch probe for the D4 finding: line b has costPartial true)
| b | x | $20.00 | -$40.00 | 1h 40m | ±0m | 0% | ±0 pp | 0 | ±0 | n/a / n/a / n/a |
```

## Verdict

ready to commit. There are no blocking findings. Three findings are Important: the R2-F7 interval rule, the D4 partial line in `compare`, and the `internalAgent` shape. Each changes figures that step 13 commits (`## Cost` card, the `history.jsonl` line, `gateBlocks`), so they belong in the planned fix batch before step 13. There are 8 Minor findings; they can go into that batch or into STATE open debt.
