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
