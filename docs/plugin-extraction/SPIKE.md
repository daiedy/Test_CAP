# Trial plugin: what the documentation does not say

Step 3 of issue #65. Run on 2026-11-19 with Claude Code 2.1.326.

## Method

A throwaway plugin `trial` was loaded with `claude -p --plugin-dir <plugin>` into an empty git project outside this repository (model `haiku`, `--setting-sources project`; three runs, 0.015 USD together). The first run answered the main questions; the second added an agent `probe-project` and `userConfig`; the third checked the bundled server with the options unset. The plugin held:

- two skills: `hello` (user-invocable) and `protocol` (`user-invocable: false`, meant for preloading);
- two agents that differ only in how they name the skill and the MCP tools: `probe-bare` (`skills: protocol`, `tools: ..., mcp__echo__*`) and `probe-prefixed` (`skills: trial:protocol`, `tools: ..., mcp__plugin_trial_echo__*`), both with `memory: project`;
- `hooks/hooks.json` with a logging script on SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, SubagentStart, SubagentStop and Stop; the script also returned a marker text as `additionalContext`;
- a dependency-free MCP server `echo` with the tools `ping` and `fail`.

The plugin, the hook log of the run and the resolution probe are kept in `.pipeline/plugin-audit/` (`trial-plugin/`, `trial-hooks.jsonl`, `resolve-probe.mjs`; gitignored).

## Results

| Question | Result | Consequence for the move |
|---|---|---|
| How does a plugin agent name a skill of the same plugin in `skills:`? | Both forms preload the skill: `protocol` and `trial:protocol`. | Use the prefixed form: a project may hold its own skill with the same bare name. |
| Where does `memory: project` write for a plugin agent? | `<project>/.claude/agent-memory/<plugin>-<agent>/` (`trial-probe-bare`): the colon of the agent name becomes a dash. | The memory stays in the project. Test_CAP's folders (`architect`, `reviewer`, ...) are renamed when it switches to the plugin. |
| What are the tools of a bundled MCP server called, and which pattern grants them? | `mcp__plugin_trial_echo__ping`. In an agent's `tools` the wildcard `mcp__plugin_trial_echo__*` grants them; `mcp__echo__*` grants nothing. | If the servers are bundled: rename in every agent's `tools`, in `MCP_RULES`, in the protocol routing table and in the reason texts. If they stay in the project's `.mcp.json`, the names stay as today. |
| Can a plugin hook hand text to the model as `additionalContext`? | Yes, on SessionStart, PreToolUse, PostToolUse and PostToolBatch, on the main thread and inside subagents, and on SubagentStart for the subagent. | A rule can be delivered by a hook when an agent touches a matching file. Role briefs and turn notes keep working from a plugin. |
| Which events fire from plugin hooks? | All nine that were declared, including PostToolUseFailure for the failing MCP call and PostToolUse for `Skill` and MCP calls. | The hook wiring of `.claude/settings.json` can move to `hooks/hooks.json`. |
| What does a hook see as the agent type? | The prefixed name: `agent_type` is `trial:probe-bare`. | Every table keyed by agent type follows (`BRIEF_ROLES`, `HOME_PHASE`, the `maxTurns` lookup). A report file named `report-<type>-<id>.md` would carry a colon: replace it. |
| Which variables does a hook process get? | `CLAUDE_PROJECT_DIR` (the project), `CLAUDE_PLUGIN_ROOT` (the plugin folder), `CLAUDE_PLUGIN_DATA` (`~/.claude/plugins/data/trial-inline` for `--plugin-dir`); the working directory is the project. The same inside subagents. | `repoRoot()` reads `CLAUDE_PROJECT_DIR`; script paths start at `CLAUDE_PLUGIN_ROOT`. |
| Are the variables replaced inside skill text? | Yes: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` arrived as paths. | A skill can say `node ${CLAUDE_PLUGIN_ROOT}/scripts/wiki.mjs ...` instead of `node scripts/wiki.mjs ...`. |
| May a plugin agent's `tools` name an MCP server that is not part of the plugin? | Yes (second run): with `tools: Read, mcp__projecho__*` the agent got and called `mcp__projecho__ping` of a server configured outside the plugin. | The option "servers stay in the project's `.mcp.json`" keeps today's tool names (`mcp__cds-mcp__*`) in the agents and in `MCP_RULES`. |
| Do plugin user settings (`userConfig`) reach a hook without being configured? | No (second and third run): with `lang` declared with `default: "en"`, the hook saw no `CLAUDE_PLUGIN_OPTION_LANG`. Values are saved with `claude plugin configure <plugin> --values-stdin`. Hooks and the bundled MCP server still ran with the options unset. | Every script applies its own default when the variable is absent. |
| Can a script in the plugin load the project's CAP runtime? | A bare `import '@sap/cds'` from outside the project fails with `ERR_MODULE_NOT_FOUND`; `createRequire(<project>/package.json)('@sap/cds')` resolves it (10.2.2 here). | `gen-registry.mjs` and `wiki.mjs`, the only two scripts with a third-party import, load `@sap/cds` through `createRequire` from the project root. |

Side observations:

- A skill with `user-invocable: false` is still listed to the model, as `trial:protocol`.
- `memory: project` gave both agents `Edit` although their `tools` named only `Read`, `Write`, `Bash`.
- `claude plugin validate` passed with warnings. For the public directory it asks for a README of at least 40 words, a licence (a `LICENSE` file or `license` in `plugin.json`) and a square PNG icon of 512 to 2048 px.

## Not settled

- The `SubagentHandback` matcher. The headless subagents had no such tool and ended in plain text, so only SubagentStop fired (with `last_assistant_message`). The hand-over gate has both routes; check the tool route in an interactive session before relying on it.
- A configured `userConfig` value arriving in a hook as `CLAUDE_PLUGIN_OPTION_<KEY>` (only the unset case was run).
- In the second run, started with `--mcp-config`, the first turn listed no tool of the bundled server; in the first and third run they were there. One observation, cause not found: a start-up race or an effect of the flag.
- Plugin skills with `paths:` as a carrier of path rules.
- Colon names on Windows (agent types in file names).
