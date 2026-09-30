# pipeline-metrics: verification

Date: 2026-09-29. Agent: `test-backend`. Plan step 11, phase 5, acceptance criterion 27.

Short form (PLAN step 11): the commands, the session id, record counts per kind, the card of the restarted session. No conversation content is quoted: only record kinds, aggregates, timestamps and whether a transcript `message.content` is a string.

## Session under test

- Session id: `9be203c7-d642-4363-8948-bb5450d2d5fc` (the `/feature` orchestrator session).
- How it was started: SessionStart `source: fork`, after the hooks commit `273c615` (2026-09-29 21:27 +04), so it loaded the new `.claude/settings.json` registrations (orchestrator decision, instead of a manual restart).
- Event log: `.pipeline/metrics-9be203c7-d642-4363-8948-bb5450d2d5fc.jsonl`.
- The id is passed explicitly to every command: `.pipeline/current-session` held `326296f3-f6f1-4565-a061-8ed1d810c0fc` at the start of this check, written by one of two concurrent sessions (`326296f3...`, `b90fb588...`), the known Risks item "Concurrent sessions overwrite `.pipeline/current-session`".

## Checks

### 1. The CLI parses the session and the log holds the five kinds (criterion 27): pass

```
$ node scripts/metrics.mjs session 9be203c7-d642-4363-8948-bb5450d2d5fc --json > /tmp/claude-vr-session.json; echo "exit=$?"
exit=0
$ node -e '<count by event over .pipeline/metrics-9be203c7-d642-4363-8948-bb5450d2d5fc.jsonl>'
records: 18
{"session":1,"prompt":6,"agent-start":3,"turn-end":4,"agent-stop":2,"phase":2}
```

Record timeline (kind and keys only):

```
2026-09-29T17:37:01.109Z session     source,transcriptPath,branch
2026-09-29T17:39:29.663Z prompt
2026-09-29T17:40:12.441Z agent-start agent,agentType
2026-09-29T17:40:12.440Z agent-start agent,agentType
2026-09-29T17:40:17.796Z turn-end    blocked
2026-09-29T17:40:53.266Z prompt
2026-09-29T17:40:57.532Z agent-stop  agent,agentType,transcriptPath,model,requests,tokens,costUSD,activeMin,leadMin,toolCalls,firstTs,lastTs
2026-09-29T17:40:57.911Z prompt
2026-09-29T17:41:12.499Z turn-end    blocked
2026-09-29T17:46:48.736Z prompt
2026-09-29T17:46:57.341Z agent-stop  agent,agentType,transcriptPath,model,requests,tokens,costUSD,activeMin,leadMin,toolCalls,firstTs,lastTs
2026-09-29T17:47:06.462Z prompt
2026-09-29T17:47:37.200Z phase       feature,phase,raw
2026-09-29T17:47:46.829Z turn-end    blocked
2026-09-29T18:37:25.621Z prompt
2026-09-29T18:37:45.436Z phase       feature,phase,raw
2026-09-29T18:37:45.507Z agent-start agent,agentType
2026-09-29T18:37:50.182Z turn-end    blocked
```

`--json` prints the report object (`research/data-flow.md`: "`--json` prints the report object"), not a list of records, so each kind is traced to the field it feeds:

| Kind | Count in the log | Where it shows in the `--json` report |
|---|---|---|
| `session` | 1 | `dirOf()` in `scripts/metrics.mjs` takes the transcript directory from its `transcriptPath`; the report parsed: `sessionIds: ["9be203c7-..."]`, `versions: ["2.1.284"]`, `calls: 125` |
| `prompt` | 6 | `prompts: 6` (`events.length ? promptEvents : transcriptPrompts`) |
| `phase` | 2 | `phaseSource: "markers"`, `phases["5"].rounds: 1` |
| `agent-start` | 3 | not read by the report: `launches: 3` comes from the agent transcripts (D9); the equal count is a coincidence of this session, see finding F1 |
| `agent-stop` | 2 | the live drift self-check (`warnings: agent-stop-drift:<agent>`, check 5) |
| `turn-end` | 4 | not read by the report (not required by criterion 27) |

Verdict: criterion 27 holds. The event log of the forked session holds all five required kinds, and the CLI parses it (exit 0). Four of the kinds feed the report. `agent-start` is written but read by nothing (finding F1, not blocking).

### 2. Every live `agent-stop` joins an `agent-start` on the bare id: pass

```
$ node -e '<agent-start / agent-stop records of the log, with the transcript file check>'
session transcript exists: true subagents dir: true
subagent files: agent-a4b01183c4c95fc09.jsonl agent-a66bf678b09121d7e.jsonl agent-a73cd8b16c3527834.jsonl (+ .meta.json each)
2026-09-29T17:40:12.441Z agent-start agent=a66bf678b09121d7e type=cap-backend-dev
2026-09-29T17:40:12.440Z agent-start agent=a73cd8b16c3527834 type=docs-keeper
2026-09-29T17:40:57.532Z agent-stop  agent=a73cd8b16c3527834 type=docs-keeper     transcript=agent-a73cd8b16c3527834.jsonl exists=true model=claude-sonnet-5-5
2026-09-29T17:46:57.341Z agent-stop  agent=a66bf678b09121d7e type=cap-backend-dev transcript=agent-a66bf678b09121d7e.jsonl exists=true model=claude-opus-5-5
2026-09-29T18:37:45.507Z agent-start agent=a4b01183c4c95fc09 type=test-backend
stop a73cd8b16c3527834 has start: true
stop a66bf678b09121d7e has start: true
```

| agent (bare id) | agentType | `agent-start` | `agent-stop` | transcript |
|---|---|---|---|---|
| `a66bf678b09121d7e` | `cap-backend-dev` | 17:40:12.441Z | 17:46:57.341Z | `agent-a66bf678b09121d7e.jsonl` |
| `a73cd8b16c3527834` | `docs-keeper` | 17:40:12.440Z | 17:40:57.532Z | `agent-a73cd8b16c3527834.jsonl` |
| `a4b01183c4c95fc09` | `test-backend` | 18:37:45.507Z | none yet (this verification run) | `agent-a4b01183c4c95fc09.jsonl` |

No record carries the `agent-` prefix. The SubagentStart id (`agent-<id>` in the hooks reference) and the SubagentStop id normalize to the same bare id through `metricsAgent()`, and that id also names the transcript file. Neither stop was resumed, so there is one start per agent. With a resume, the log would show one more `agent-start` per resume.

### 3. No `agent-stop` or `gate` record from a Claude Code internal agent: pass

```
$ node -e '<turn-end and gate records; agent-stop/gate with empty agentType or a missing transcript file>'
2026-09-29T17:40:17.796Z turn-end false
2026-09-29T17:41:12.499Z turn-end false
2026-09-29T17:47:46.829Z turn-end false
2026-09-29T18:37:50.182Z turn-end false
agent-stop/gate records with empty agentType or missing transcript: 0
agent-start records with empty agentType: 0
$ node -e '<count of .pipeline/mcp-audit-9be203c7-....jsonl by event|agent|agentType>'
{ "mcp|a66bf678b09121d7e|cap-backend-dev": 2, "edit|a66bf678b09121d7e|cap-backend-dev": 17,
  "edit|main|main": 2, "edit|a4b01183c4c95fc09|test-backend": 1 }
```

- Both `agent-stop` records carry an `agentType` and a transcript file that exists (check 2). The log has no `gate` record, which is consistent: all four `turn-end` records say `blocked: false` and no subagent was blocked.
- The subagents directory holds exactly the three typed agents, and the MCP audit log names no other agent.
- Limit: an internal SubagentStop leaves no trace by design, so this run cannot show that one fired. Step 7 observed one about every 32 s during a subagent run. `cap-backend-dev` ran here for 6.6 min (`leadMin`), and no untyped record appeared. That fits the `internalAgent()` filter in `subagent-stop.mjs` (line 157: `const metered = !internalAgent(input)`). It is indirect evidence only: without a probe, which would mean editing a hook and is out of scope for this step, the run cannot show that an internal stop fired at all.

### 4. `prompt` records: hand-back deliveries count as prompts (finding F3)

`prompt` records with a `command`: 0 of 6 (no prompt in the post-fork window starts with `/`).

Each `prompt` record was lined up against the main transcript after the fork (17:37:01Z). Only record `type`, `timestamp`, whether `message.content` is a string, and the kind enums `origin`, `isMeta`, `queue-operation.operation` and `attachment.type` were read. No text was read.

```
$ node -e '<log records and transcript user records with string content, merged by time>'
prompt records with command: 0 of 6
$ node -e '<transcript queue-operation / attachment kinds and string-user origin after the fork>'
```

| `prompt` ts | Transcript record at the same moment | What it is |
|---|---|---|
| 17:39:29.663Z | user, string content, `origin=human`, 17:39:29.598Z | a human prompt |
| 17:40:53.266Z | `queue-operation` enqueue 17:40:53.171Z, dequeue .196Z; user, string, `origin=peer`, `isMeta=true`, 17:40:53.205Z (docs-keeper `lastTs` 17:40:53.176Z, +29 ms) | the docs-keeper hand-back delivery |
| 17:40:57.911Z | `agent-stop` docs-keeper 17:40:57.532Z; `queue-operation` enqueue 17:40:57.554Z with `attachment type=queued_command`, `remove` 17:40:57.922Z; no string user record | a queued command delivered into the turn after the stop (the background agent's completion notice) |
| 17:46:48.736Z | enqueue 17:46:48.651Z, dequeue .673Z; user, string, `origin=peer`, `isMeta=true`, 17:46:48.681Z (cap-backend-dev `lastTs` 17:46:48.655Z, +26 ms) | the cap-backend-dev hand-back delivery |
| 17:47:06.462Z | `agent-stop` cap-backend-dev 17:46:57.341Z; enqueue 17:46:57.774Z with `attachment type=queued_command`, `remove` 17:47:06.468Z; no string user record | a queued command after the stop |
| 18:37:25.621Z | user, string, `origin=human`, 18:37:25.544Z | a human prompt |

Tool uses after the fork: `{"Bash":7,"Agent":3,"Read":1,"Edit":2}`. There was no `SendMessage` in this session. The parent session `1b11fc6b-1754-4ede-a6a7-659d3a7ad7eb` answers it instead: its log has live records from 17:14:27Z (see "Further observations").

```
$ node -e '<parent main transcript: SendMessage tool_use, queue-operation, queued_command, string user origin; subagent af71 string user origin; parent log records; merged by time>'
2026-09-29T17:14:42.732Z LOG agent-stop cap-backend-dev
2026-09-29T17:14:43.092Z MAIN queue enqueue
2026-09-29T17:14:43.092Z MAIN attachment queued_command
2026-09-29T17:14:48.668Z MAIN tool_use SendMessage
2026-09-29T17:14:52.703Z MAIN tool_use SendMessage
2026-09-29T17:14:53.750Z SUB af71 user(string) origin=coordinator
2026-09-29T17:14:53.814Z LOG agent-start cap-backend-dev
2026-09-29T17:14:53.831Z LOG prompt
2026-09-29T17:14:53.832Z LOG agent-start architect
2026-09-29T17:14:53.851Z MAIN queue remove
...
2026-09-29T17:19:20.508Z MAIN tool_use SendMessage
2026-09-29T17:19:21.579Z LOG agent-start test-backend
2026-09-29T17:19:28.353Z LOG turn-end
```

A SendMessage delivery does not fire UserPromptSubmit. It arrives in the subagent transcript as `origin=coordinator` and fires SubagentStart (a resume `agent-start`). The `prompt` at 17:14:53.831Z pairs with the `queued_command` removal at 17:14:53.851Z, which was enqueued at the 17:14:42.732Z stop, not with the SendMessage. All 8 `prompt` records of the parent log are deliveries: 4 `origin=peer` hand-backs and 4 `queued_command` removals, each within 70 ms of its transcript record.

Answer: yes. UserPromptSubmit fires for a subagent hand-back delivery (`origin=peer`) and for a queued command delivered after a background agent stops (`queued_command`). The card's `prompts: 6` counts 2 human prompts and 4 deliveries. With background agents, each agent adds about 2, so for a `/feature` run the figure is roughly human prompts + 2 × launches.

Finding F3 (important, not blocking criterion 27): `prompts` does not measure the user prompts that `research/data-flow.md` section 2 defines ("Counts user prompts"). The live and the transcript paths also count different things. `prompts: events.length ? promptEvents : transcriptPrompts`, and `slim()` in `scripts/lib/transcript-usage.mjs` marks every string user record as a prompt, `peer` and `task-notification` included, but not `queued_command` attachments. Here the transcript path would give 4 after the fork (2 human + 2 peer), against 6 from the events. `prompts` is a field of the committed `docs/metrics/history.jsonl` line: the 4 baseline lines come from the transcript path (the first line has `prompts: 27`), and every new feature will come from the event path. So the next `compare` will set two different definitions side by side. The transcript carries the kind that separates the cases, `origin` = `human` | `peer` | `task-notification`, which is an enum, not content. A decision (architect) is needed before step 13 records this feature's line.

### 5. Live `agent-stop` against the CLI re-parse: drift present on both agents (finding F4)

The card warns `agent-stop-drift:a66bf678b09121d7e` and `agent-stop-drift:a73cd8b16c3527834` (`DRIFT_MAX` = 1%). Each figure was computed with the project parser: the live record, the same file re-parsed now, and the scope re-parse the report uses (`scopeThreads`).

```
$ node /tmp/claude-vr-drift.mjs   # transcript-usage.mjs: requests/usageByModel on the file, and scopeThreads over loadSession
agent a73cd8b16c3527834 docs-keeper: file mtime 2026-09-29T17:40:57.653Z, last record 2026-09-29T17:40:57.552Z, stop ts 2026-09-29T17:40:57.532Z
  requests live/single/scope: 7 8 8
  input         live        14 single        16 scope        16
  cacheWrite5m  live     34141 single     35435 scope     35435
  cacheWrite1h  live         0 single         0 scope         0
  cacheRead     live    173459 single    207600 scope    207600
  output        live       105 single       819 scope       819
  total        live 207719 single 243870 scope 243870  drift live-vs-scope 14.82%
agent a66bf678b09121d7e cap-backend-dev: file mtime 2026-09-29T17:46:57.873Z, last record 2026-09-29T17:46:57.772Z, stop ts 2026-09-29T17:46:57.341Z
  requests live/single/scope: 31 32 32
  input         live        62 single        64 scope        64
  cacheWrite5m  live    135711 single    138356 scope    138356
  cacheWrite1h  live         0 single         0 scope         0
  cacheRead     live   2847034 single   2983531 scope   2983531
  output        live      9563 single    10541 scope    10541
  total        live 2992370 single 3132492 scope 3132492  drift live-vs-scope 4.47%
```

The last records of each agent transcript (kinds only):

```
docs-keeper      17:40:52.271Z assistant tool_use=SubagentHandback
                 17:40:53.176Z user tool_result                      <- live lastTs
                 17:40:57.439Z assistant text stop_reason=end_turn   <- the missing request
                 17:40:57.551Z / .552Z attachment                    (file mtime 17:40:57.653Z, hook append 17:40:57.532Z)
cap-backend-dev  17:46:47.561Z assistant tool_use=SubagentHandback
                 17:46:48.655Z user tool_result                      <- live lastTs
                 17:46:57.274Z assistant text stop_reason=end_turn   <- the missing request
                 17:46:57.771Z / .772Z attachment                    (file mtime 17:46:57.873Z, hook append 17:46:57.341Z)
$ node /tmp/claude-vr-drift2.mjs   # the same file re-parsed, cut at the live lastTs
docs-keeper: re-parse cut at live lastTs 2026-09-29T17:40:53.176Z: requests 7 (live 7), tokens {...} identical to live: true
cap-backend-dev: re-parse cut at live lastTs 2026-09-29T17:46:48.655Z: requests 31 (live 31), tokens {...} identical to live: true
```

Finding F4 (important, not blocking criterion 27): SubagentStop fires before Claude Code flushes the agent's final `end_turn` message to `agent_transcript_path`. The record carries a timestamp from before the hook ran, but the file is written after the hook reads it. Every live `agent-stop` therefore misses exactly one request: the final text turn after `SubagentHandback`. Cut at the live `lastTs`, the re-parse equals the live record in every kind, so the parser and the hook agree and the difference is only this race. Consequences:

- `agent-stop-drift` fires for every agent of every session (4.5% to 14.8% here, and larger for short agents). The warning, meant to detect a transcript format change (PLAN Risks), turns into constant noise.
- The card's figures come from the re-parse, so they are correct. Only the live record's `requests`, `tokens` and `costUSD` understate.

Possible directions for `cap-backend-dev`/`architect`, not decided here: compare the drift on the re-parse cut at the live `lastTs` (like with like, and a real format change still shows), or accept one missing trailing `end_turn` request in the comparison. Waiting inside the hook for the file to grow is fragile.

### 6. The card of the session and the briefing line: rendered, with findings F2, F5, F6

The card in the default language (`PIPELINE_LANG=ru` from the environment), quoted as rendered output. It was taken while this verification agent was running, so the `test-backend` row and phase 5 include this run so far.

```
$ node scripts/metrics.mjs session 9be203c7-d642-4363-8948-bb5450d2d5fc
## Стоимость: сессия 9be203c7-d642-4363-8948-bb5450d2d5fc

Сессий 1 (2026-09-29 .. 2026-09-29), длительность 17ч 5м, активно 2ч 7м, ожидание 14ч 58м, агенто-минуты 2ч 14м (параллельность 1.1); порог простоя 5 мин, порог инструмента 10 мин; фазы: маркеры; цены 2026-09-29; Claude Code 2.1.284

Стоимость $9.40 (записи cost-state нет); токены вход 358 / запись в кэш 687K / чтение кэша 17.3M / выход 76.4K; попадание в кэш 96%; контекст в среднем 112K, пик 233K

| Фаза | Раунды | Активно | Ожидание | Вызовы | Стоимость | Стоимость доработок |
|---|---|---|---|---|---|---|
| 0 | - | 1ч 46м | 14ч 13м | 73 | $6.49 | $0.00 |
| 2 | - | 6м | 0м | 32 | $1.50 | $0.00 |
| 5 | 1 | 14м | 45м | 47 | $1.41 | $1.19 |
| 6 | - | 0м | 0м | 8 | $0.00 | $0.00 |

| Агент | Запуски | Возобновления | Активно | Вызовы / maxTurns | Стоимость | Доработки |
|---|---|---|---|---|---|---|
| main | - | - | 1ч 57м | 76 / - | $6.71 | 0 |
| cap-backend-dev | 1 | 0 | 7м | 32 / 60 | $1.50 | 0 |
| docs-keeper | 1 | 0 | 1м | 8 / 80 | $0.00 | 0 |
| test-backend | 1 | 0 | 9м | 44 / 60 | $1.19 | 1 ($1.19) |

Гейты: блокировок: 0; ревью н/д; критерии н/д; MCP запросов 2, без обоснования 0, неудачных 0; правок под правилом с запросом 1/1; промпты 6; строки н/д; сжатий контекста 0

Предупреждения: agent-stop-drift:a66bf678b09121d7e, agent-stop-drift:a73cd8b16c3527834, unknown-model:claude-sonnet-5-5
exit=0
```

The SessionStart briefing, run offline (`GH_CONFIG_DIR` set to an empty temp dir, no token). That is why it prints "GitHub unavailable, queue from cache"; the metrics line is the one under test:

```
$ GH_CONFIG_DIR=$(mktemp -d) GH_TOKEN= GITHUB_TOKEN= node scripts/backlog.mjs briefing
...
Последняя записанная фича: products-excel-upload (#7), стоимость $62.02, активно 3ч 30м, доработки 21% стоимости (node scripts/metrics.mjs compare).
...
exit=0
$ tail -1 docs/metrics/history.jsonl  (feature, issue, costUSD, activeMin, reworkShare)
products-excel-upload 7 62.0186 210.4 0.213
```

Briefing: pass. The line matches the last `history.jsonl` entry ($62.0186 → $62.02, 210.4 min → 3h 30m, 0.213 → 21%).

Card: rendered (exit 0), but four of its figures are misleading:

- **F2, the `docs-keeper` row shows `$0.00` and phase 6 shows `$0.00` for 8 priced calls.** `docs-keeper`, `ui-verifier` and `upstream-watcher` run on `model: sonnet`, which resolves to `claude-sonnet-5-5`. `scripts/lib/model-pricing.json` has no such key: `perMTok` holds `claude-fable-5-1`, `claude-opus-5-5`, `claude-opus-5`, `claude-sonnet-5` and `claude-haiku-4-5-20251001`. The live `agent-stop` correctly has `costUSD: null`, and `byModel["claude-sonnet-5-5"].costUSD` is `null` with the `unknown-model` warning. `threadOf()` in `scripts/lib/pipeline-metrics.mjs` then coerces it (`costUSD: cost.costUSD ?? 0`), so the agent row, the phase row and the rework sums show zero. D4 says "an unknown model yields `null` plus a warning, never zero". Every future card will understate the documentation phase until the table carries the Sonnet 5.5 price, and this feature's step 13 `record` will commit that understatement. Severity: important. The table needs the price verified against the published list (not done here), and the row aggregation should keep `null`.
- **F5, the card of a forked session counts the parent's pre-fork history.** The fork copied all 326 pre-fork records of the parent session `1b11fc6b-1754-4ede-a6a7-659d3a7ad7eb` into `9be203c7-....jsonl`, with the same `uuid` (326 of 326) and `requestId` (62 of 62), rewriting `sessionId`. This card therefore includes the parent's 62 main-thread requests ($5.67 of the $9.40 total), a lead time from 01:41Z (17 h 5 min), the phase 0 row (73 calls, $6.49) and JSON `resumes: 11` (all 11 SendMessage calls are pre-fork; after the fork the tool uses are `{"Bash":7,"Agent":3,"Read":1,"Edit":2}`).

  ```
  $ node /tmp/claude-vr-fork.mjs
  main thread pre-fork (copied from parent): {"calls":62,"usd":5.6746}  first ts 2026-09-29T01:41:20.976Z
  main thread post-fork: {"calls":14,"usd":1.0335}
  pre-fork records with a uuid also in the parent transcript: 326 of 326
  ```

  A feature report that joins both sessions dedupes the copies by `uuid` and `requestId` (D1, `scopeThreads`), so the `feature` card of step 13 is not affected by construction. That was not executed here, because the `feature` command queries `gh`. The `session` card, which `/retro` section 1 reads, double counts. Severity: minor. A `session` record with `source: fork` gives the reader the cut point (the record's `ts`).
- **F6, phase attribution does not match this plan's phase numbers.** The `/feature` skill numbers its phases 0 preparation, 1 plan, 2 backend, 3 UI, 4 verification, 5 review, 6 documentation, 7 completion, and `HOME_PHASE` follows it (`test-backend: 2`, `reviewer: 5`, `docs-keeper: 6`). This PLAN numbers its own phases 2 parser, 3 hooks, 4 skills, 5 verification, 6 review, 7 documentation, 8 completion, and STATE carries them (`Phase: 5: verification`). Consequences on this card:
  - The phase 5 marker is read as review, and the planned `test-backend` launch of step 11 is flagged as rework. `reworkOf()` with markers: phase at launch `5` ≠ home `2`. That is 1 launch and $1.19 so far.
  - `cap-backend-dev` and `docs-keeper` launched at 17:40:12Z, before this session's first marker (17:47:37Z). They fall back to home phases 2 and 6, although they did plan phase 4 work (commit `7a623b8` at 17:47:14Z). The orchestrator changed STATE through Bash before that (see the process finding), so there was no marker.
  - `Phase: 8: completion` is outside the parser's 0-7 range. `phaseOf("8: completion")` returns `none`, and `phaseOf("8: completion (plan step 14)")` returns `none` as well. A label that contains a digit 0-7 elsewhere would take that digit instead.
  
  Severity: important for this feature's own `## Cost` card and history line, not a code defect in isolation. A decision is needed (architect or orchestrator): write the skill's phase number in the STATE marker, or renumber the plan.
- F4 (check 5) puts the two `agent-stop-drift` warnings on the card. F3 (check 4) inflates `промпты 6`.

### 7. The live `session` record: pass

```
$ node -e '<the session record of the log>'
{"ts":"2026-09-29T17:37:01.109Z","source":"fork","branch":"feature/pipeline-metrics","transcriptPath":"~/.claude/projects/-Users-anton-straltsou-github-Test-CAP/9be203c7-d642-4363-8948-bb5450d2d5fc.jsonl"}
```

`source: fork` and `branch: feature/pipeline-metrics`, as expected. The session started 9 min 50 s after the hooks commit `273c615` (17:27:11Z). `transcriptPath` exists and names this session.

## Automated tests

Run at verification time to record the committed state. This step changed no code.

```
$ npm test
 Test Files  10 passed (10)
      Tests  127 passed (127)
   Duration  8.00s
```

## Process finding (orchestrator)

The orchestrator changed `docs/STATE.md` through Bash before its latest Edit-tool edit. A Bash write fires no PostToolUse `Edit|Write`, so `post-edit.mjs` wrote no `phase` record for it. The session holds 2 `phase` records (17:47:37Z and 18:37:45Z) and no marker for plan phase 4. As a result, `cap-backend-dev` and `docs-keeper` (launched 17:40:12Z) fall back to home phases 2 and 6 on the card (F6). This is how the hook is specified (a marker only from an Edit/Write of STATE), not a hook defect. Phase markers need STATE edits through Edit or Write, and the `/feature` skill's `Phase: <N>: <label>` rule (step 10) should say so.

## Further observations

- **Hooks registered mid-session fire in that session (Claude Code 2.1.284).** The parent session `1b11fc6b-1754-4ede-a6a7-659d3a7ad7eb` started at 01:41Z, long before step 7, yet its log has live `prompt`, `agent-start`, `agent-stop` and `turn-end` records from 17:14:27Z. That is 13 min before the hooks commit (17:27:11Z), with real agent ids whose transcript files exist. It has no `session` record, since SessionStart had already fired. The PLAN Risks item "Hooks load at session start ... step 11 needs one restart" did not hold: only the `session` record needed a new session.

  ```
  $ node -e '<parent metrics log: ts, event, agent, agentType, transcript file exists>'
  2026-09-29T17:14:27.518Z prompt  command=-
  2026-09-29T17:14:42.732Z agent-stop agent=af71b644fa68b0314 type=cap-backend-dev file=true
  2026-09-29T17:14:53.814Z agent-start agent=af71b644fa68b0314 type=cap-backend-dev file=true
  ... (8 prompt, 3 agent-start, 4 agent-stop, 4 turn-end; last 17:27:21.227Z)
  ```

- The parent log also shows a resume: `af71b644…` has `agent-stop` 17:14:42Z → `agent-start` 17:14:53Z (SendMessage) → `agent-stop` 17:18:58Z. So SubagentStart fires on a resume, as the hook comment says, and the reader's "last `agent-stop` per agent" rule is exercised.
- F1 detail: nothing reads the `agent-start` records. `launches` and `resumes` come from the transcripts (`Agent` and `SendMessage` tool uses, D9), and no consumer outside the hook references `agent-start`. The record is correct and joins `agent-stop` (check 2). Whether it should feed the resume count, which the transcript derives from SendMessage including pre-fork copies (F5), or be dropped, is a reviewer/architect call.

## Findings

| # | Severity | Finding | Evidence | For |
|---|---|---|---|---|
| F1 | minor | `agent-start` is written but read by no consumer; `launches`/`resumes` come from the transcripts | checks 1, 2; `grep -rl agent-start scripts .claude test templates` finds only `scripts/hooks/subagent-start.mjs`, its registration in `.claude/settings.json`, `test/hooks-metrics.test.js` and `test/fixtures/metrics-log.jsonl`, and no reader | reviewer, architect |
| F2 | important | `claude-sonnet-5-5` (the model of `docs-keeper`, `ui-verifier`, `upstream-watcher`) is missing from `model-pricing.json`, and `threadOf()` turns the `null` cost into `$0.00` on agent and phase rows (D4: never zero) | check 6 | cap-backend-dev (table entry after a price check; keep `null` in the rows) |
| F3 | important | `prompts` counts turn inputs, not user prompts: a hand-back (`origin=peer`) and a `queued_command` after each background agent stop both fire UserPromptSubmit (2 human of 6 here, 0 human of 8 in the parent). The transcript fallback counts a different set, so live and baseline `history.jsonl` lines differ in definition | check 4 | architect (definition before step 13 records the line) |
| F4 | important | SubagentStop fires before the final `end_turn` message is flushed to the agent transcript. Every live `agent-stop` misses one request, so `agent-stop-drift` fires on every agent (4.5%, 14.8%) and stops being a format-change signal | check 5 | cap-backend-dev |
| F5 | minor | The card of a forked session counts the parent's copied pre-fork history ($5.67 of $9.40, 62 of 76 main calls, lead from 01:41Z, `resumes: 11`); the feature scope dedupes by construction | check 6 | cap-backend-dev |
| F6 | important (this feature's own card) | STATE `Phase:` of this plan (5 verification ... 8 completion) contradicts the skill numbering that `HOME_PHASE` uses (4 verification, 5 review, 6 documentation, 7 completion): the planned step 11 launch is flagged as rework and `8: completion` parses to `none` | check 6 | architect or orchestrator |

None of these blocks criterion 27. F2, F3 and F6 change the figures that step 13 will commit (`## Cost`, the `history.jsonl` line), so they need a decision before step 13, not before review.

## Verdict

Ready for review. Criterion 27 holds: the forked session `9be203c7-d642-4363-8948-bb5450d2d5fc` (`source: fork`, after `273c615`) logged `session` 1, `prompt` 6, `phase` 2, `agent-start` 3, `agent-stop` 2 (and `turn-end` 4). `node scripts/metrics.mjs session <id> --json` parses it (exit 0). Every live `agent-stop` joins an `agent-start` on the bare id, and no internal-agent record exists. The six findings go to review and to the decision before step 13; none of them is blocking.

## Round 2

Date: 2026-09-30. Agent: `test-backend`. Plan step 11e, phase 4 verification round 2, acceptance criteria 27 and 30-32 (30: D13 turn inputs, 31: D12 rework against the approved plan, 32: drift cut at `lastTs`). Fix round 1 is committed (`71c2976`). No hook changed since round 1, so no restart: the session under test is the same orchestrator session `9be203c7-d642-4363-8948-bb5450d2d5fc`, passed explicitly to every command. Only record `type`, `timestamp`, `uuid`, `origin.kind`, `attachment.type`, `attachment.origin.kind`, `commandMode` and whether `message.content` is a string are read; no text.

Scratch scripts (in `/tmp`, not committed) import the project parser (`scripts/lib/transcript-usage.mjs`, `scripts/lib/pipeline-metrics.mjs`) only where the check is "the same rule on the same input"; the D13 count and the launch list read the raw JSONL independently.

### R2-1. Turn inputs equal an independent count by `origin.kind` (criterion 30): pass

```
$ node scripts/metrics.mjs session 9be203c7-d642-4363-8948-bb5450d2d5fc --json > /tmp/claude-vr2-session.json; echo "exit=$?"
exit=0
prompts 7 | handbacks 25 | notifications 30 | reworkSource "plan" | planCommit "c10c4f0ac2654bf47c11ee0e91f4a7bea1251b64" | warnings [] | phaseSource "markers" | calls 521
$ node /tmp/claude-vr2-d13.mjs <main transcript of 9be203c7> 2026-09-29T17:37:01.109Z   # uuid-deduped; user(string) by origin.kind, queued_command by attachment.origin.kind, else commandMode
unique uuids 633 duplicate uuid lines skipped 0 isSidechain 0
combos {"user(string) origin=-":3,"user(string) origin=human":7,"user(string) origin=peer":25,"qc origin=task-notification recOrigin=- mode=task-notification":20,"user(string) origin=task-notification":10}
all      {"none":3,"human":7,"peer":25,"task-notification":30 (20 queued_command + 10 user)}
preFork  {"none":3,"human":3,"peer":13,"task-notification":15 (12 queued_command + 3 user)}
postFork {"human":4,"peer":12,"task-notification":15 (8 queued_command + 7 user)}
$ node /tmp/claude-vr2-d13.mjs <main transcript of the parent 1b11fc6b>
unique uuids 328 ... {"none":3,"human":3,"peer":13,"task-notification":15}
$ node /tmp/claude-vr2-drift.mjs ...   # first line: the event log by kind
log records 91 {"session":1,"prompt":31,"agent-start":16,"turn-end":22,"agent-stop":14,"phase":5,"gate":2}
```

| Count | CLI `session --json` | Independent count, whole file | Pre-fork copy (F5) | Parent `1b11fc6b` whole file | Post-fork |
|---|---|---|---|---|---|
| `prompts` (`human`) | 7 | 7 | 3 | 3 | 4 |
| `handbacks` (`peer`) | 25 | 25 | 13 | 13 | 12 |
| `notifications` (`task-notification`) | 30 | 30 | 15 | 15 | 15 |
| no `origin` (not counted) | - | 3 | 3 | 3 | 0 |

- The session scope reads the whole forked file, copied history included (F5, open debt), and the CLI equals the independent count over the whole file on all three figures. Like with like on the copy: the pre-fork part equals the parent's own file (3/13/15).
- The 3 string `user` records without `origin` are counted by neither side (D13 "not counted").
- No `queued_command` attachment carries `origin.kind` `human` or `peer` in this session; all 20 are `task-notification` in both `attachment.origin.kind` and `commandMode`.
- Cross-check with the live hook: the 31 `prompt` event records (all after the fork, when the hook existed) equal the post-fork turn inputs 4 + 12 + 15 = 31. UserPromptSubmit fires once per turn input of any kind, which is why D13 no longer counts the events (F3), and the CLI no longer reads them (`prompts` 7, not 31).

### R2-2. No `agent-stop-drift`; every live `agent-stop` equals its re-parse cut at `lastTs` (criterion 32): pass

`warnings: []` on the session report (R2-1). Each live record was compared with the agent file re-parsed by the project parser (`readTranscript`, `requests`, `usageByModel`), once cut at the record's `lastTs` (the rule the report applies) and once in full:

```
$ node /tmp/claude-vr2-drift.mjs .pipeline/metrics-9be203c7-....jsonl <session dir>
stop ts                  agent             agentType       start last  lastTs                    req live/cut/full  tokens live / cut / full           drift cut / full
2026-09-29T17:40:57.532Z a73cd8b16c3527834 docs-keeper     true  true  2026-09-29T17:40:53.176Z  7/7/8        207719 / 207719 / 243870                 0.00% / 14.82%
2026-09-29T17:46:57.341Z a66bf678b09121d7e cap-backend-dev true  true  2026-09-29T17:46:48.655Z  31/31/32     2992370 / 2992370 / 3132492              0.00% / 4.47%
2026-09-29T18:52:01.105Z a4b01183c4c95fc09 test-backend    true  true  2026-09-29T18:51:46.746Z  63/63/64     5485890 / 5485890 / 5629204              0.00% / 2.55%
2026-09-29T19:14:25.452Z a681308637609d94b cap-backend-dev true  false 2026-09-29T19:14:06.496Z  59/59/144    8689284 / 8689284 / 34092785             0.00% / 74.51%
2026-09-29T22:56:13.906Z a03ef8f00e8372b1a architect       true  false 2026-09-29T22:56:07.053Z  9/9/27       478887 / 478887 / 2141255                0.00% / 77.64%
2026-09-29T22:56:57.560Z a03ef8f00e8372b1a architect       true  false 2026-09-29T22:56:51.700Z  13/13/27     758106 / 758106 / 2141255                0.00% / 64.60%
2026-09-29T23:03:34.325Z a681308637609d94b cap-backend-dev true  false 2026-09-29T23:03:23.486Z  105/105/144  21030140 / 21030140 / 34092785           0.00% / 38.31%
2026-09-29T23:06:24.780Z a03ef8f00e8372b1a architect       true  true  2026-09-29T23:06:24.700Z  27/27/27     2141255 / 2141255 / 2141255              0.00% / 0.00%
2026-09-29T23:11:00.018Z a681308637609d94b cap-backend-dev true  false 2026-09-29T23:10:50.268Z  133/133/144  30121422 / 30121422 / 34092785           0.00% / 11.65%
2026-09-29T23:32:58.003Z afb6622aacd744453 test-backend    true  false 2026-09-29T23:32:45.973Z  52/52/64     10887265 / 10887265 / 14636406           0.00% / 25.62%
2026-09-29T23:33:03.979Z afb6622aacd744453 test-backend    true  false 2026-09-29T23:33:02.552Z  54/54/64     11489483 / 11489483 / 14636406           0.00% / 21.50%
2026-09-29T23:35:55.409Z a681308637609d94b cap-backend-dev true  true  2026-09-29T23:35:55.294Z  144/144/144  34092785 / 34092785 / 34092785           0.00% / 0.00%
2026-09-29T23:38:32.283Z afb6622aacd744453 test-backend    true  false 2026-09-29T23:38:31.997Z  63/63/64     14313803 / 14313803 / 14636406           0.00% / 2.20%
2026-09-29T23:38:39.277Z afb6622aacd744453 test-backend    true  true  2026-09-29T23:38:38.946Z  64/64/64     14636406 / 14636406 / 14636406           0.00% / 0.00%
```

- 14 live `agent-stop` records for 6 agents; every one has an `agent-start` on the bare id. The report compares the last stop per agent (`last true`, 6 rows); cut at `lastTs`, all 14 equal the re-parse in requests and tokens (0.00%).
- The full-file column shows what the old comparison would have warned on: the F4 race (one request short, 2.5% to 14.8%) and, new in this round, the earlier stops of resumed agents (`a681...`, `a03e...`, `afb6...`), which are short by the whole later resume (up to 77.6%). The cut handles both.
- Three last stops (`a03e...` 23:06:24, `a681...` 23:35:55, `afb6...` 23:38:39) are not one request short: `lastTs` is within 0.1-0.3 s of the stop, and the full file equals the live record. The race is not constant. Where the file was already complete, the cut changes nothing.

### R2-3. Rework launches against the approved plan `c10c4f0` (criterion 31): pass

```
$ node scripts/metrics.mjs feature pipeline-metrics --json > /tmp/claude-vr2-feature.json; echo "exit=$?"
exit=0
reworkSource "plan" | planCommit "c10c4f0ac2654bf47c11ee0e91f4a7bea1251b64" | phaseSource "markers" | launches 12 | resumes 23 | reworkUSD 16.6523 | reworkShare 0.174
agent rows: cap-backend-dev launches=4 reworkLaunches=1 reworkUSD=12.1447; architect launches=3 reworkLaunches=2 reworkUSD=4.0448; test-backend launches=4 reworkLaunches=1 reworkUSD=0.4628; docs-keeper launches=1 reworkLaunches=0
$ node /tmp/claude-vr2-launches.mjs   # agent files of the report's 8 sessions (meta agentType, toolUseId), Agent tool_use ts from the main transcripts,
                                      # phase markers of the feature (phaseMarkers), planAssignments(git show c10c4f0:PLAN.md), reworkOf
markers 2026-09-29T17:47:37.200Z 5 | 2026-09-29T19:02:47.478Z 2 | 2026-09-29T23:39:09.735Z 4
plan c10c4f0 {"architect":["1"],"cap-backend-dev":["2","3","4"],"test-backend":["2","3","5"],"docs-keeper":["4","7"],"reviewer":["6"]}
```

| # | Launch (Agent tool_use, UTC) | Session | Agent | Type | Phase at launch | Planned in `c10c4f0` | Rework |
|---|---|---|---|---|---|---|---|
| - | 09-28 23:57:05 | `d84a82c7` | no agent file | `claude-code-guide` | before first marker | - | no (not a thread, see below) |
| - | 09-29 00:24:29 | `d84a82c7` | no agent file | `architect` | before first marker | - | no (not a thread) |
| 1 | 09-29 01:44:35 | `1b11fc6b` | `aea1f448...` | `cap-backend-dev` | before first marker (home 2) | n/a | no |
| 2 | 02:09:18 | `1b11fc6b` | `a56c6b78...` | `architect` | before first marker (home 1) | n/a | no |
| 3 | 11:39:54 | `1b11fc6b` | `a3627842...` | `test-backend` | before first marker (home 2) | n/a | no |
| 4 | 17:01:02 | `1b11fc6b` | `af71b644...` | `cap-backend-dev` | before first marker (home 2) | n/a | no |
| 5 | 17:40:00 | `9be203c7` | `a66bf678...` | `cap-backend-dev` | before first marker (home 2) | n/a | no |
| 6 | 17:40:11 | `9be203c7` | `a73cd8b1...` | `docs-keeper` | before first marker (home 6) | n/a | no |
| 7 | 18:37:43 | `9be203c7` | `a4b01183...` | `test-backend` (step 11) | 5 | yes (5) | no |
| 8 | 19:02:35 | `9be203c7` | `aa9d8972...` | `architect` | 5 | no | **yes** |
| 9 | 19:02:44 | `9be203c7` | `a6813086...` | `cap-backend-dev` | 5 | no | **yes** |
| 10 | 22:54:29 | `9be203c7` | `a03ef8f0...` | `architect` | 2 | no (only 1) | **yes** |
| 11 | 23:11:11 | `9be203c7` | `afb6622a...` | `test-backend` | 2 | yes (2) | no |
| 12 | 09-30 00:26:59 | `9be203c7` | `a2464f6c...` | `test-backend` (this step, 11e) | 4 | no (2, 3, 5) | **yes** |

- 4 rework launches = the expected 3 of the first 12 (19:02:35, 19:02:44, 22:54) + 0 later `architect` launches in phase 2 (none happened after 22:54) + 1 for this step's `test-backend` in phase 4. The CLI's agent rows agree: `architect` 2, `cap-backend-dev` 1, `test-backend` 1 (its $0.46 is this run so far, the phase 4 `reworkUSD`).
- The 4 `fork` threads of `1321a167` (09-29 00:32-00:34, branch `main`) are outside the feature scope and not in the table; the CLI's `launches` 12 excludes them too.
- Count difference, not a flag difference: `research/definitions.md` D12 live counts "12 launches up to 22:54, 8 before the first marker" by `Agent` tool uses, which includes the two `d84a82c7` launches. That session has no session directory at all (`ls .../d84a82c7-.../subagents`: no such file or directory), so D9 (launches are agent threads) gives the CLI 10 launches up to 22:54 and 12 with this step. Both launches precede the first marker, so no rework flag changes. Their cost is outside every transcript and shows up in `unattributedUSD` and in R2-4.

### R2-4. The feature report and its pricing self-check warnings: parses; the warnings are not a table error

```
$ node scripts/metrics.mjs feature pipeline-metrics --json   # R2-3, exit=0, 1.5 s
sessionIds 8 | costUSD 95.7681 | costPartial false | costStateUSD 89.5506 | costStateProcesses 7 | recovered 0.7 | unattributedUSD 26.8206 | pricingOk false
prompts 25 | handbacks 28 | notifications 34
warnings ["pricing-check:claude-fable-5-1","pricing-check:claude-haiku-4-5-20251001"]
pricingCheck {"claude-opus-5-5":{"costUSD":69.5544,"pricedUSD":69.9169,"share5m":0.848,"divergence":0.0052},
              "claude-haiku-4-5-20251001":{"costUSD":0.4629,"pricedUSD":0.5135,"share5m":0,"divergence":0.1094},
              "claude-fable-5-1":{"costUSD":69.8375,"pricedUSD":75.781,"share5m":0,"divergence":0.0851}}
$ node /tmp/claude-vr2-pricing.mjs    # processesOf over the 8 sessions; per process: cost-state modelUsage priced with the table at all-5m and all-1h cache writes, and the 5m share that reproduces costUSD
$ node /tmp/claude-vr2-pricing2.mjs   # the same, with the 5m/1h split of the process's own whole-session transcripts, and those transcripts' tokens
```

`pricingCheck()` sums the cost-state tokens of the processes' last records (whole, not apportioned) and prices their cache writes at the 5m/1h split of the feature-scoped transcript (`share5m`), then compares with the same records' `costUSD`. Per process (tokens: input / cache write / cache read / output):

| Model | Process (session) | cost-state tokens | Whole-session transcript tokens | `costUSD` | Table, all 5m | Table, all 1h | Implied 5m share | Table at the session's own split |
|---|---|---|---|---|---|---|---|---|
| `claude-fable-5-1` | `1790641666617` (`1321a167`) | 53,239 / 921,673 / 35,468,043 / 329,787 | 3,322 / 822,421 (5m 269,863, 1h 552,558) / 27,613,769 / 127,710 | 41.5938 | 37.4097 | 44.3222 (+6.56%) | 0.395 | 42.0540 (+1.11%, share 0.328) |
| `claude-fable-5-1` | `1790631844695` (`d84a82c7`) | 101,251 / 688,271 / 24,137,659 / 170,230 | 1,592 / 241,983 (all 1h) / 13,830,117 / 87,559 | 26.1088 | 24.1618 | 29.3238 (+12.31%) | 0.623 | 29.3238 (+12.31%, share 0) |
| `claude-fable-5-1` | `1790643101956` (`ecb6d00e`) | 162 / 69,532 / 397,648 / 12,865 | identical | 2.1349 | 1.6134 | **2.1349 (0.00%)** | 0.000 | 2.1349 (0.00%) |
| `claude-fable-5-1` | sum (the card) | | scope: 270,254 writes, all 1h (`share5m` 0) | 69.8375 | 63.1849 | 75.7810 (+8.51%) | 0.472 | |
| `claude-haiku-4-5-20251001` | `1790646078927` (`1b11fc6b`) | 907 / 0 / 0 / 16 | none | 0.0010 | 0.0010 | 0.0010 | - | 0.0010 (0.00%) |
| `claude-haiku-4-5-20251001` | `1790631844695` (`d84a82c7`) | 144,170 / 80,835 / 650,162 / 20,391 | none | 0.4222 | 0.4122 | 0.4728 (+11.98%) | 0.835 | 0.4122 (-2.37%, no writes: all 5m) |
| `claude-haiku-4-5-20251001` | `1790645541750` (`265a4208`) | 18 / 17,294 / 44,528 / 125 | identical | 0.0397 | 0.0267 | **0.0397 (0.00%)** | 0.000 | 0.0397 (0.00%) |
| `claude-haiku-4-5-20251001` | sum (the card) | | scope: 17,294 writes, all 1h (`share5m` 0) | 0.4629 | 0.4399 | 0.5135 (+10.94%) | 0.688 | |

Cause, per the three candidates:

- **Not the table.** Where cost-state and the transcript hold the same tokens (`ecb6d00e` fable, `265a4208` and `1b11fc6b` haiku), the table reproduces `costUSD` to the cent. For every other process, `costUSD` lies between the all-5m and the all-1h price (implied 5m share 0.395, 0.623, 0.835, all within 0-1). A wrong price would put it outside that interval.
- **Not the process apportioning.** The check does not apportion: `processShare()` scales only `costStateUSD`, and `pricingCheck()` prices and compares the same whole-process records.
- **Cost-state includes usage outside the transcripts, priced at the wrong cache split.** `d84a82c7`'s cost-state holds 64x the fable input, 2.8x the cache writes and 1.7x the cache reads of its transcript, and all its haiku usage. Its two `Agent` launches have no agent transcript (R2-3), and the other auxiliary calls are not in any transcript either. `1321a167` holds 16x the input and 2.6x the output of its transcript. The check prices those tokens at the feature scope's split (fable and haiku: all 1h, `share5m` 0), while the implied splits show that 40-84% of the process writes were 5m. A second, smaller part is the scope cut: `1321a167`'s whole session writes 33% at 5m, but its feature-scoped records only at 1h. At its own split the process diverges +1.11% instead of +6.56%.
- `claude-opus-5-5` passes (0.52%) only because the scope's split (0.848) happens to be close to the implied one (0.869).

Finding R2-F7 (important, not blocking criteria 27 and 30-32): the pricing self-check raises `pricing-check` for two models whose table prices are exact, so `pricingOk: false` and both warnings will stand on this feature's `## Cost` card at step 13 (`record` refuses only on `unknown-model`, so step 13 is not blocked). The check cannot tell a wrong price from an unknown 5m/1h split of tokens that no transcript holds. Directions for `architect` (definitions section 5) and `cap-backend-dev`, not decided here: warn only when no split in 0-1 reproduces a process's `costUSD` within the tolerance (the implied-share test above, which is exact at 0 or 1 for the fully transcribed processes), or run the check only on processes whose cost-state tokens do not exceed their transcripts'. The table was not changed.

### R2-5. Round 1 findings F2, F3, F4, F6

| # | Status | Evidence |
|---|---|---|
| F2 | resolved | `scripts/lib/model-pricing.json` has `claude-sonnet-5-5` (input 2, cacheWrite5m 2.5, cacheWrite1h 4, cacheRead 0.2, output 10). The feature report shows `byModel["claude-sonnet-5-5"].costUSD` 0.1383, the `docs-keeper` row $0.1383 and phase 6 $0.1383 (round 1: $0.00), with no `unknown-model` warning. `threadOf()` now carries `costUSD: cost.costUSD` with `costPartial` (line 498), not `?? 0`, and `sumCost()` returns `null` when only unpriced parts exist. The Sonnet 5.5 price was not re-checked against the published list in this step. |
| F3 | resolved | R2-1: `prompts`/`handbacks`/`notifications` 7/25/30 from the transcript by `origin.kind` equal the independent count. The 31 `prompt` event records (= 4 + 12 + 15 post-fork turn inputs) are no longer counted. |
| F4 | resolved | R2-2: all 14 live `agent-stop` records equal the re-parse cut at `lastTs` (0.00%), and `warnings: []`. Round 1 had `agent-stop-drift` on both agents at 4.47% and 14.82%, the same two stops that now show 0.00% at the cut. |
| F6 | resolved (by the 2026-09-30 decision; residual stated in PLAN Risks) | The markers from 19:02:47 use the skill's numbers (`5` 17:47:37 → `2` 19:02:47 → `4` 23:39:09). STATE reads `Phase: 4: verification (round 2, plan step 11e; ...)`, which parses to `4` (`11e` is not matched: the digit rule excludes adjacent digits). `8: completion` cannot recur (skill phases 0-7). Step 11's `test-backend` under the old marker `5` is planned against `c10c4f0` (R2-3 row 7). The residual is intended: this step's launch is rework (row 12) because the approved plan numbers verification 5. `SUMMARY.md` states it at step 13. |

F1 (nothing reads `agent-start`) and F5 (a forked session's card counts the copied history) stay open, as listed in `docs/STATE.md`. R2-1 shows F5 in numbers: 3/13/15 of the session's 7/25/30 turn inputs are the parent's copies.

### Automated tests

Run to record the committed state `71c2976`; this step changed no code or test.

```
$ npm test
 Test Files  10 passed (10)
      Tests  130 passed (130)
   Duration  40.39s
```

### Round 2 findings

| # | Severity | Finding | Evidence | For |
|---|---|---|---|---|
| R2-F7 | important | The pricing self-check flags `claude-fable-5-1` (8.51%) and `claude-haiku-4-5-20251001` (10.94%), although the table is exact: it prices cost-state tokens outside any transcript at the feature scope's 5m/1h split (all 1h), so `pricingOk: false` on this feature's card | R2-4: fully transcribed processes 0.00%; others between the all-5m and all-1h prices (implied 5m share 0.395, 0.623, 0.835) | architect (definitions section 5 rule), then cap-backend-dev |
| R2-F8 | minor | `research/definitions.md` D12 live counts launches by `Agent` tool uses ("12 up to 22:54, 8 before the first marker"), while the CLI counts agent threads (D9): 10 up to 22:54, 12 with step 11e. The difference is the 2 `d84a82c7` launches, whose session has no directory. No rework flag differs | R2-3 | architect (wording), docs-keeper at step 13 (`SUMMARY.md` quotes the CLI's figure) |

## Round 2 verdict

Ready for review. On the live session `9be203c7-d642-4363-8948-bb5450d2d5fc`: criterion 27 still holds (the log holds `session` 1, `prompt` 31, `phase` 5, `agent-start` 16, `agent-stop` 14; `session --json` exit 0). Criterion 30 holds: 7/25/30 equals the independent `origin.kind` count. Criterion 31 holds: `reworkSource: "plan"`, `planCommit` `c10c4f0`, 4 rework launches as expected (3 of the first 12 by D12's count plus this step). Criterion 32 holds: no `agent-stop-drift`, and all 14 stops equal the cut re-parse. F2, F3, F4 and F6 are resolved. R2-F7 is a false positive of the pricing warning, not a defect in any figure the card computes. It needs a decision before step 13 writes the `## Cost` card, but it is not blocking. R2-F8 is wording.
