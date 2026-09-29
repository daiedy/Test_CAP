# pipeline-metrics: reconciliation of session 6ecbd7a4 (#7) against cost-state

Date: 2026-09-29. Author: `cap-backend-dev` (PLAN step 4). Session `6ecbd7a4-061e-42d6-8c8a-941e7dae43c2` (`products-excel-upload`, #7), Claude Code 2.1.282. Every figure comes from `node scripts/metrics.mjs` or from a `jq`/`node` filter that prints only keys, counts and token numbers; no conversation content was read or is quoted. Hypotheses H1-H5: `research/definitions.md` section 5. Recovered share to explain: 73% (user decision 3, 2026-09-29; the earlier 88% priced every cache write at the 1h rate, see H4).

## 1. The table

Command: `PIPELINE_LANG=en node scripts/metrics.mjs reconcile 6ecbd7a4-061e-42d6-8c8a-941e7dae43c2`, re-run after the second amendment (transcript side: D1 over the main file and all 11 subagent files, requests and `uuid` copies deduplicated over the scope; cost-state side: the last record of the session's only process). The 24 rows are identical to the first run of step 4; the total line lost the `RECONCILE_MIN` minimum and the pricing self-check line was added (user decision 2026-09-29).

```
| Model | Kind | Transcript | cost-state | Ratio |
|---|---|---|---|---|
| claude-haiku-4-5-20251001 | input | 0 | 903 | 0% |
| claude-haiku-4-5-20251001 | cacheWrite5m | 0 | - | - |
| claude-haiku-4-5-20251001 | cacheWrite1h | 0 | - | - |
| claude-haiku-4-5-20251001 | cacheWrite | 0 | 0 | - |
| claude-haiku-4-5-20251001 | cacheRead | 0 | 0 | - |
| claude-haiku-4-5-20251001 | output | 0 | 15 | 0% |
| claude-haiku-4-5-20251001 | thinking | 0 | 0 | - |
| claude-haiku-4-5-20251001 | costUSD | $0.00 | $0.00 | 0% |
| claude-opus-5-5 | input | 1,522 | 289,089 | 1% |
| claude-opus-5-5 | cacheWrite5m | 3,521,831 | - | - |
| claude-opus-5-5 | cacheWrite1h | 651,651 | - | - |
| claude-opus-5-5 | cacheWrite | 4,173,482 | 4,669,924 | 89% |
| claude-opus-5-5 | cacheRead | 100,357,423 | 133,346,137 | 75% |
| claude-opus-5-5 | output | 226,811 | 653,814 | 35% |
| claude-opus-5-5 | thinking | 51,445 | 226,569 | 23% |
| claude-opus-5-5 | costUSD | $47.44 | $66.33 | 72% |
| claude-sonnet-5 | input | 702 | 117,186 | 1% |
| claude-sonnet-5 | cacheWrite5m | 1,206,848 | - | - |
| claude-sonnet-5 | cacheWrite1h | 0 | - | - |
| claude-sonnet-5 | cacheWrite | 1,206,848 | 1,363,958 | 89% |
| claude-sonnet-5 | cacheRead | 58,000,981 | 69,893,125 | 83% |
| claude-sonnet-5 | output | 82,047 | 176,961 | 46% |
| claude-sonnet-5 | thinking | 25,451 | 68,136 | 37% |
| claude-sonnet-5 | costUSD | $15.44 | $19.39 | 80% |

Total: transcript $62.88 of cost-state $85.73, recovered 73%; synthetic requests skipped 2; pricing 2026-09-29
Pricing check (cost-state tokens x price table against its costUSD, tolerance 5%): claude-opus-5-5 0.2%, claude-haiku-4-5-20251001 0.0%, claude-sonnet-5 0.0%
```

## 2. Hypotheses, tested one by one

Shell variables in every filter: `P=~/.claude/projects/-Users-anton-straltsou-github-Test-CAP`, `S=6ecbd7a4-061e-42d6-8c8a-941e7dae43c2`. Filters print keys, types, counts and token numbers only.

### 2.0 Does any transcript field carry the missing tokens (D1, D2 check)

```
cat $P/$S.jsonl $P/$S/subagents/*.jsonl | jq -r '. as $r | [paths(objects and (has("output_tokens") or has("outputTokens") or has("totalTokens")))] | map(map(if type=="number" then "[]" else . end)|join(".")) | unique[] | "\($r.type)\t\(.)"' | sort | uniq -c
```
Result: `assistant message.usage` 2,058; `assistant message.usage.iterations.[]` 482; `attachment attachment.usage` 22; `cost-state modelUsage.<model>` 3.

- `usage.iterations` holds one element (`type: message`) whose `input_tokens`, `output_tokens`, `cache_read_input_tokens` and `cache_creation_input_tokens` equal the top-level usage in 482 of 482 records (`jq -r 'select(.type=="assistant" and .message.usage.iterations)|.message.usage as $u|$u.iterations[0] as $i|[($i.input_tokens==$u.input_tokens), ...]|@tsv'`).
- `attachment.usage` belongs to `queued_command` attachments (a background agent reporting back) and holds only `totalTokens`, `toolUses`, `durationMs`: a per-run summary without a per-kind split, duplicating the subagent file.
- `usage.server_tool_use` is `{web_search_requests: 0, web_fetch_requests: 0}` or null; no other usage sub-object carries tokens.

Conclusion: no transcript field carries the missing tokens. D1 and D2 stay as they are.

### 2.1 H1: auxiliary API calls without an `assistant` record

```
jq -r 'select(.type=="assistant")|[(.advisorModel|type), .advisorModel, (.serverClassifierRequest|type)]|@tsv' $P/$S.jsonl | sort | uniq -c
jq -r 'select(.type=="assistant")|.serverClassifierRequest|[length, test("^[A-Za-z0-9_-]+$")]|@tsv' $P/$S.jsonl | sort | uniq -c
jq -r 'select(.permissionMode=="auto")|1' <session>.jsonl | wc -l
```
- `advisorModel` is `claude-opus-5-5` (the main model) on all 287 main records; `serverClassifierRequest` is a 36-character id, 162 distinct values for 162 requests, so one per request.
- No `assistant` record uses haiku; `cost-state` holds haiku 903 input and 15 output tokens ($0.000978).
- Control across sessions (per-kind recovered share summed over models, `node scripts/metrics.mjs reconcile <id> --json`; `auto` = records with `permissionMode: "auto"`):

| Session | auto | Requests | input | cacheWrite | cacheRead | output | $ |
|---|---|---|---|---|---|---|---|
| `ecb6d00e` | 0 | 6 | 100% | 100% | 100% | 100% | 100% |
| `6ecbd7a4` (#7) | 47 | 1,052 | 1% | 89% | 78% | 37% | 73% |
| `0bb70a42` (#5, #6) | 56 | 993 | 0% | 95% | 76% | 40% | 72% |
| `0f92618d` (#6) | 5 | 82 | 1% | 94% | 72% | 52% | 74% |
| `00d68c5c` | 18 | 488 | 0% | 68% | 68% | 58% | 62% |
| `1321a167` | 56 | 124 | 6% | 105% | 79% | 78% | 90% |
| `35043e2c` | 12 | 94 | 1% | 89% | 87% | 81% | 87% |

- Missing uncached input per action tool call (Bash, Edit, Write, `mcp__*`) over the 11 single-process sessions: 170 to 3,676 tokens, no constant.

Result: the one session without auto-mode records (`ecb6d00e`: 6 requests, 6 action tool calls, no subagents) reconciles at 100% on every kind, while every auto-mode session recovers 0-6% of the uncached input. The input gap and part of the cache gaps are attributed to calls Claude Code makes outside the transcript in auto mode (lead: the per-request `serverClassifierRequest`). Their size per call cannot be derived from the transcript, and the control is one small session. Status: supported, not quantified.

### 2.2 H2: aborted or retried requests

```
jq -c 'select(.type=="cost-state")|{totalAPIDuration, totalAPIDurationWithoutRetries}' $P/$S.jsonl
cat $P/$S.jsonl $P/$S/subagents/*.jsonl | jq -c 'select(.isApiErrorMessage==true)|{type, model:.message.model}'
```
Result: 10,299,272 ms against 10,123,827 ms without retries, 175.4 s or 1.7% of API time. Two `isApiErrorMessage` records, both `assistant` with model `<synthetic>` and zero usage (the two requests D2 skips). No `system` record has an error or retry subtype. If retried attempts were billed pro rata to API time, the upper bound is 1.7% of $85.73, about $1.46 (6% of the gap). It cannot be separated from H1, so no row is explained by H2 alone.

### 2.3 H3: output semantics, stream snapshots

Four summing rules over all 12 files (node over `readTranscript`; per request: every record, first, last, per-field maximum):

| Model | Rule | input | cacheWrite | cacheRead | output | thinking |
|---|---|---|---|---|---|---|
| opus-5-5 | every record | 2,974 | 8,278,321 | 191,538,344 | 333,718 | 72,229 |
| opus-5-5 | first | 1,522 | 4,173,482 | 100,357,423 | 126,403 | 13,264 |
| opus-5-5 | last = max (D1) | 1,522 | 4,173,482 | 100,357,423 | 226,811 | 51,445 |
| opus-5-5 | cost-state | 289,089 | 4,669,924 | 133,346,137 | 653,814 | 226,569 |
| sonnet-5 | every record | 1,356 | 2,875,078 | 108,128,011 | 84,239 | 25,451 |
| sonnet-5 | first | 702 | 1,206,848 | 58,000,981 | 10,670 | 0 |
| sonnet-5 | last = max (D1) | 702 | 1,206,848 | 58,000,981 | 82,047 | 25,451 |
| sonnet-5 | cost-state | 117,186 | 1,363,958 | 69,893,125 | 176,961 | 68,136 |

"Every record" overshoots cost-state on cache read, so Claude Code does not sum records. The lead "`thinkingTokens` equals Σ max output" holds for opus (226,569 against 226,811) but not for sonnet (68,136 against 82,047): a coincidence, not a rule.

```
jq -r 'select(.type=="assistant")|.message.stop_reason' <file> | sort | uniq -c
cat $P/$S/subagents/*.jsonl | jq -s -c '[.[]|select(.type=="assistant" and .message.usage and .message.model!="<synthetic>")]|group_by(.requestId)|map({m:.[0].message.model, fin:(map(.message.stop_reason)|any(.!=null)), out:(map(.message.usage.output_tokens)|max), th:(map(.message.usage.output_tokens_details.thinking_tokens//0)|max)})|group_by(.m)[]|{model:.[0].m, requests:length, withFinal:(map(select(.fin))|length), outWithFinal:(map(select(.fin).out)|add), outNoFinal:(map(select(.fin|not).out)|add), thinkingNoFinal:(map(select(.fin|not).th)|add)}'
```
- `stop_reason`: main file 287 records, all final (`tool_use` 219, `end_turn` 68); subagent files 1,771 records, `null` 1,574, `tool_use` 166, `end_turn` 29, `stop_sequence` 2.
- Requests with at least one final record: main 162 of 162; subagents opus 91 of 539, sonnet 103 of 351. The 448 opus and 248 sonnet requests without one carry output 4,697 and 2,997 (about 10 per request) and thinking 0.
- On the 122 requests with both a snapshot and a final record, the snapshot's input, cache read and cache write equal the final record's (122 of 122): snapshots carry final input and cache figures, only output and thinking are provisional.

Result: 696 of 890 subagent requests (78%) are recorded only as stream snapshots written before the final usage arrives, so their output and thinking are missing from the transcript. Magnitude check: the missing output per such request is opus 427,003 / 448 ≈ 953 and sonnet 94,914 / 248 ≈ 383, within the observed output of requests that do have a final record (opus subagents 1,393, opus main 589, sonnet 767 per request). This explains the output and thinking rows. The exact values are not recoverable (2.0), so D1 stays: the per-field maximum is the best the transcript allows. The main thread's output is exact.

### 2.4 H4: cache write rate

- Transcript split: opus 3,521,831 (5m) and 651,651 (1h), 84.4% at 5m; sonnet 1,206,848 and 0, 100% at 5m.
- Repricing cost-state's own tokens with `scripts/lib/model-pricing.json` (section 5): sonnet gives exactly $19.392502 with every write at 5m; opus needs an average write rate of $5.4455, a 85.2% 5m share.
- The prototype priced every write at the 1h rate: $75.25 (88%). The split gives $62.88 (73%).

Result: explains the move from 88% to 73% (the prototype overstated transcript cost by $12.37). It explains no token row.

### 2.5 H5: compaction summaries and `<synthetic>`

```
cat $P/$S.jsonl $P/$S/subagents/*.jsonl | jq -c 'select(.isCompactSummary==true)|.type' | wc -l
cat $P/$S.jsonl $P/$S/subagents/*.jsonl | jq -r 'select(.type=="system")|.subtype' | sort | uniq -c
```
Result: 0 compaction summaries; system subtypes `stop_hook_summary` 55, `turn_duration` 49, `away_summary` 2, `local_command` 1, no compaction boundary. `<synthetic>`: 2 requests with zero usage (the API errors of H2). Explains nothing, as expected.

### 2.6 H6 (new): cost-state is per process and cumulative

```
for f in $P/*.jsonl; do jq -r 'select(.type=="cost-state")|"\(.startTime) \(.totalCostUSD)"' $f; done
```
Result: 19 sessions hold 50 `cost-state` records. Records of one process share `startTime` and their totals only grow; the last one is the process total. `startTime` 1789008726629 appears in `29ece8c2` ($73.17) and `e9ead85a` ($97.25), and 1790631844695 in `7c3f8099`, `832bf359` and `d84a82c7`: one process hosted several sessions and wrote its running total into whichever transcript was active. `488be2d6` spans two processes ($21.03 and $381.99): its transcript ($389.38) is 101.9% of the last record but 96.6% of both processes. `7c3f8099` (173%) is the same effect.

`6ecbd7a4` holds one record whose `startTime` appears in no other session, so the #7 table above stands.

**Definition change needed** (reported in step 5; amended in definitions section 5 and D1 and implemented on 2026-09-29: `costState()` returns the last record per `startTime`, the reference total sums the processes of a scope with the proportional share, `scopeThreads()` deduplicates requests and `uuid` copies over the scope). Original finding: definitions section 5 said "cost-state exists once per closed session"; the cost-state of a scope is the last record per `startTime`, summed over the processes the scope's sessions touch; a process shared by several sessions must be split, or the scope widened to all its sessions. `costState()` in `transcript-usage.mjs` takes the last record of one file; `buildReport` adds each session's share. For `catalog-authorization` (`e9ead85a` + `29ece8c2`, one process) this counts the shared process twice. Result after the implementation: `catalog-authorization` transcript cost $65.39 (was $87.50), reference total $82.54 (the apportioned share of the $97.25 process, whose two sessions also hold records outside the feature), recovered 79%.

Related (found in step 5, `research/baseline-2026-09.md`): a resumed or forked session copies the earlier history into its own file (`29ece8c2` repeats 118 of 119 main requests of `e9ead85a`), so D1 must deduplicate by `requestId` over the whole scope, not per file. `6ecbd7a4` shares no `requestId` with any other session, so the table above is unaffected.

## 3. Explanation per kind and model

Gap = cost-state − transcript; dollar value at the verified prices (cache writes at the implied rate of section 2.4). Kind gaps sum to $22.95; the cost-state difference is $22.85, and the $0.10 comes from the opus write split (transcript 84.4% against the implied 85.2% at 5m).

| Model | Kind | Recovered | Gap tokens | Gap $ (share) | Explanation |
|---|---|---|---|---|---|
| opus-5-5 | input | 1% | 287,567 | $1.15 (5.0%) | unexplained 99%; lead H1 (auto-mode calls outside the transcript, control `ecb6d00e`); H2 at most 1.7% |
| opus-5-5 | cacheWrite | 89% | 496,442 | $2.70 (11.8%) | unexplained 11%; lead H1; H4 sets the rate, not the count |
| opus-5-5 | cacheRead | 75% | 32,988,714 | $6.60 (28.8%) | unexplained 25%; lead H1 |
| opus-5-5 | output | 35% | 427,003 | $8.54 (37.2%) | explained: H3, 448 subagent requests recorded only as stream snapshots (about 953 missing per request, within the 589-1,393 observed) |
| opus-5-5 | thinking | 23% | 175,124 | in output | explained: H3, thinking is reported only in final records (0 on the 448) |
| sonnet-5 | input | 1% | 116,484 | $0.23 (1.0%) | unexplained 99%; lead H1 |
| sonnet-5 | cacheWrite | 89% | 157,110 | $0.39 (1.7%) | unexplained 11%; lead H1 |
| sonnet-5 | cacheRead | 83% | 11,892,144 | $2.38 (10.4%) | unexplained 17%; lead H1 |
| sonnet-5 | output | 46% | 94,914 | $0.95 (4.1%) | explained: H3, 248 snapshot-only requests (about 383 missing per request, within the 767 observed) |
| sonnet-5 | thinking | 37% | 42,685 | in output | explained: H3 |
| haiku-4-5 | input, output | 0% | 903, 15 | $0.001 (0.0%) | explained: H1, no `assistant` record uses haiku, an auxiliary call by construction |
| haiku-4-5 | cacheWrite, cacheRead | - | 0 | - | nothing to explain (0 on both sides) |
| all | cacheWrite5m, cacheWrite1h | - | - | - | cost-state has no split; H4: the transcript split reproduces Claude Code's cost (sonnet exactly, opus 85.2% implied against 84.4%) |
| all | costUSD | 73% | - | $22.85 | explained $9.49 (41.4% of the $22.95 kind gaps, H3); unexplained $13.46 (58.6%), lead H1, with H2 at most $1.46 inside it |

With complete output the transcript would recover 84.4% ($72.37 of $85.73).

## 4. Active time of #7 under both caps

```
node scripts/metrics.mjs session 6ecbd7a4-061e-42d6-8c8a-941e7dae43c2 --idle 5 --tool 5 --json
node scripts/metrics.mjs feature products-excel-upload --idle 5 --tool 10 --json
```

| Scope | Caps (idle / tool) | Merged active | Main thread | Agent-minutes | Parallelism | Lead | Waiting |
|---|---|---|---|---|---|---|---|
| session `6ecbd7a4` | 5 / 5 | 217.5 | 152.1 | 404.8 | 1.86 | 5,098.1 | 4,880.6 |
| session `6ecbd7a4` | 5 / 10 | 217.7 | 152.1 | 405.0 | 1.86 | 5,098.1 | 4,880.4 |
| feature `products-excel-upload` | 5 / 5 | 210.2 | 144.7 | 397.5 | 1.89 | 5,090.8 | 4,880.6 |
| feature `products-excel-upload` | 5 / 10 | 210.4 | 144.7 | 397.6 | 1.89 | 5,090.8 | 4,880.4 |

All figures in minutes. The 10-minute tool cap adds 0.2 min to #7: few tool gaps exceed 5 min. The main thread is 152.1 under D5 with either cap (user decision 1, 2026-09-29). The prototype's 162.3 also counted two `system/away_summary` records (+7.9 min) and `queue-operation` records (+2.2 min), which are written inside idle gaps.

## 5. Pricing verification

`scripts/lib/model-pricing.json` (`recordedAt` 2026-09-29) was checked against https://platform.claude.com/docs/en/about-claude/pricing on 2026-09-29, table "Model pricing", USD per MTok (input / 5m write / 1h write / cache hit / output): Opus 5.5 4 / 5 / 8 / 0.20 / 20; Opus 5 5 / 6.25 / 10 / 0.50 / 25; Sonnet 5 2 / 2.50 / 4 / 0.20 / 10 (the introductory $2/$10 is now standard); Haiku 4.5 1 / 1.25 / 2 / 0.10 / 5; Fable 5.1 10 / 12.50 / 20 / 0.25 / 50. The same page states that 4.6 and later models bill a 1M context at standard rates, so the cost-state key `claude-opus-5[1m]` resolves to the base id.

Self-check, cost-state's own tokens priced with the table against cost-state's `costUSD`:

| Model | costUSD | Every write at 5m | Every write at 1h | Implied write rate | Implied 5m share |
|---|---|---|---|---|---|
| opus-5-5 | 66.331863 | 64.251483 | 78.261255 | 5.4455 | 85.2% |
| sonnet-5 | 19.392502 | 19.392502 | 21.438439 | 2.5000 | 100.0% |
| haiku-4-5 | 0.000978 | 0.000978 | 0.000978 | - | - |

Sonnet and haiku match to the micro-dollar; opus matches with an 85.2% 5m share against the transcript's own 84.4%. The table reproduces Claude Code's pricing.

## 6. Result: the warning moves to the pricing self-check

User decision 2026-09-29, amended definitions section 5 "Rule for v1": `RECONCILE_MIN` is removed. The card and `reconcile` warn (never fail) when a model's **pricing self-check** diverges by more than `PRICING_TOLERANCE = 0.05` (`scripts/lib/pipeline-metrics.mjs`): the last `cost-state` record of each process in scope, its `inputTokens`, `cacheCreationInputTokens` (split 5m/1h by the transcript's share for that model, all 5m when the transcript has no writes of it), `cacheReadInputTokens` and `outputTokens` priced with `model-pricing.json`, against its `costUSD`. The recovered ratio and the `unattributed` row stay on the card as information without a threshold.

Self-check of #7 (`reconcile 6ecbd7a4-...`, section 1):

| Model | cost-state costUSD | Priced with the table | Transcript 5m share | Divergence |
|---|---|---|---|---|
| opus-5-5 | $66.33 | $66.44 | 84.4% | 0.2% |
| sonnet-5 | $19.39 | $19.39 | 100% | 0.0% |
| haiku-4-5 | $0.00 | $0.00 | no writes (5m) | 0.0% |

All within 5%: #7's card prints "pricing check within 5%" and no warning. The baseline features are all within 5% too (largest divergence: `catalog-authorization`, `claude-opus-5[1m]` 2.95%; `research/baseline-2026-09.md`).

Measured evidence kept for the record: in auto mode with subagents the transcript recovers 62-97% of the reference total (`00d68c5c` 62%, `0bb70a42` 72%, `6ecbd7a4` 73%, `0f92618d` 74%, `1321a167` 90%, `488be2d6` 96.6% over both processes; the non-auto control `ecb6d00e` 100%); #7 would reach 84.4% even with complete output. A recovered threshold would therefore fire on every feature, while the self-check isolates what the price table controls: a divergence above 5% means `model-pricing.json` is stale and is re-recorded from the source URL.
