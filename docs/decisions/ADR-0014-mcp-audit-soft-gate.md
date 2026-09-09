# ADR-0014: MCP audit with a written reason instead of a hard requirement

Date: 2026-09-09. Status: accepted (user, 2026-09-09, pipeline).

## Context
Invariant 1 (MCP-first) and ADR-0009 require every agent to query the SAP MCP servers before changing a SAP artifact. Until now this lived only in prompts (protocol section 2, agent prompts, the PLAN "Check" column) and was verified by the reviewer reading the agents' reports. Two feature runs showed the calls do happen, but a skipped query is invisible: nothing records it, and the reviewer sees only what the agent chose to write. The user asked for a mechanism that notices a missing query without forcing a query for every trivial edit.

## Decision
- **Audit log.** A PostToolUse hook on `^mcp__|^Skill$` (also on PostToolUseFailure) appends every MCP and skill attempt to `.pipeline/mcp-audit-<session>.jsonl` with the `agent_id` and `agent_type` Claude Code passes to hooks inside subagents; `post-edit.mjs` appends every Edit/Write with the same key. The directory is gitignored; SessionStart prunes files older than 14 days.
- **Soft gate at hand-over.** `subagent-stop.mjs` compares the agent's edited files with the rule table `MCP_RULES` (`scripts/lib/mcp-audit.mjs`): CDS and handlers expect `cds-mcp`, UI annotations expect `fiori-mcp`, UI5 code expects the UI5 MCP or `fiori-mcp`, UI tests accept the `ui5-best-practices-opa5`/`qunit` skills, backend tests expect `cds-mcp`. If a rule has no attempt, the hook blocks once (exit 2) and asks the agent either to run the query or to add a `## MCP not used` section (`path → reason`) to its report. With the section present the agent passes and the reason is logged; if the agent stops again without it (`stop_hook_active`), it passes with a `skipped-unjustified` record and a user-visible message, so no deadlock.
- **Attempt, not answer.** A failed MCP call counts as an attempt; server outages must not block work (protocol section 3 fallback applies).
- **One hard rule.** `app/**/webapp/manifest.json` is denied for Edit/Write by the PreToolUse hook: the manifest is changed only through Fiori MCP `execute_functionality` (invariant 1). This is not a judgment call for the agent, unlike a typo fix in a CDS title.
- **Retro closes the loop.** `/retro` counts `justification` and `skipped-unjustified` records per agent type; a repeated justified skip becomes an exception in `MCP_RULES`, an unjustified one a stricter check or a prompt line.

## Alternatives
| Option | Why rejected |
|---|---|
| Prompt-only (status quo) | a skipped query leaves no trace; the reviewer can only trust the report |
| Hard gate: PreToolUse denies the edit until the query is logged | blocks trivial edits and deadlocks during MCP outages; the user found "always force MCP" excessive |
| Parse the subagent transcript in SubagentStop | `transcript_path` points to the parent transcript; the subagent file location is undocumented |
| Git-status based check | cannot attribute changes to one agent when several run in parallel; the audit log is keyed by `agent_id` |

## Consequences
- Agents gain one extra turn when they skipped a query; nothing else changes for compliant runs.
- Edits made through Bash (`sed`, heredocs) are not seen by the gate; the protocol asks agents to edit through Edit/Write.
- The plugin-prefixed tool names (`mcp__plugin_ui5_ui5-mcp-server__*`) are normalized to the project server name, so the rule table works with either server.
- [x] `scripts/lib/mcp-audit.mjs`, `scripts/hooks/mcp-audit.mjs`, changes in `post-edit.mjs`, `subagent-stop.mjs`, `protect-files.mjs`, `session-start.mjs`, `.claude/settings.json`
- [x] Protocol section 2 step 5 and the report form (section 8), rule `pipeline-config.md`, skill `retro`, CLAUDE.md invariant 8
- [ ] First retro after the marker feature evaluates the log and tunes `MCP_RULES`

## Sources
- Claude Code hooks reference: `agent_id`/`agent_type` in hook inputs inside subagents, SubagentStop exit code 2 blocks and returns the reason to the subagent, `stop_hook_active`, `last_assistant_message`
- ADR-0009 (MCP-first protocol), CLAUDE.md invariants 1 and 8, `docs/features/products-draft-edit/SUMMARY.md` (MCP usage evidence of run 2)
