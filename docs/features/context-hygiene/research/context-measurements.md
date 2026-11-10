# context-hygiene: measurements

Date: 2026-11-09. Author: `architect`. Read by `architect` and `reviewer`; `cap-backend-dev` reads it for PLAN step 7 (the baseline the `context` command is compared with). Every figure in `CONTEXT.md` "Measured facts" comes from a script in this folder or from a command named here. The scripts read the Claude Code transcripts of this project under `~/.claude/projects/` and print sizes, counts, tool names, program names and file paths only; no prompt, thinking, command text, tool output or file content is printed or stored.

## Scripts

Run from the repository root with Node 22. `<session>` for #28 is `5fcef594-d91b-4697-a0a6-8173de6fc194`. Claude Code prunes transcripts after 30 days, so the #28 figures are reproducible until about 2026-11-25; after that this file is the baseline.

| Script | Prints | Kept |
|---|---|---|
| `measure-transcripts.mjs <session>` | per launch: startup and peak context, delegation message size, tool-result characters by tool and by Bash program, whole-file Read repeats, largest results; session totals | until the prune of the feature folder; PLAN step 7 compares the `context` command with it |
| `measure-context-composition.mjs <session> [agent...]` | characters by block kind (tool result, thinking, tool inputs, attachments) | same |
| `measure-top-files.mjs <session> [N]` | characters delivered per file and per area, deliveries and agents | same |
| `measure-file-deliveries.mjs <session> [agent]` | files delivered more than once to one agent, by route | same |
| `measure-docs.mjs <feature>` | bytes per section of PLAN.md, CONTEXT.md, SCREENS.md; step rows per agent | same |
| `probe-hook-context-history.mjs` | which hook events already delivered `additionalContext`, main and subagent | same |
| `probe-transcript-shape.mjs <agent-file>` | record kinds, block kinds and key names of one transcript | re-run when a Claude Code release changes the format |
| `brief-estimate.mjs [feature]` | brief sizes of an unmarked feature under a stated rule | throwaway after PLAN step 4: `scripts/feature-brief.mjs --all` replaces it |

## The 21 launches of #28

Claude Code 2.1.310. Startup and peak in tokens (`message.usage`: input plus cache read plus cache write of a request), sizes in characters.

| Agent type | Startup | Peak | Requests | Delegation message | Tool results |
|---|---|---|---|---|---|
| `architect` | 25.7K | 220.8K | 51 | 4.5K | 235.0K |
| `cap-backend-dev` | 22.5K | 280.6K | 66 | 4.3K | 243.2K |
| `cap-backend-dev` | 22.9K | 175.0K | 47 | 3.9K | 204.6K |
| `cap-backend-dev` | 22.7K | 142.6K | 46 | 4.7K | 180.9K |
| `cap-backend-dev` | 22.7K | 120.5K | 35 | 2.3K | 142.5K |
| `cap-backend-dev` | 22.1K | 105.5K | 29 | 2.7K | 116.3K |
| `cap-backend-dev` | 22.8K | 104.9K | 37 | 2.5K | 101.0K |
| `test-backend` | 22.5K | 145.5K | 25 | 3.6K | 140.1K |
| `test-backend` | 23.2K | 97.6K | 17 | 4.2K | 69.2K |
| `test-backend` | 23.4K | 90.3K | 22 | 3.8K | 75.6K |
| `ui-verifier` | 32.1K | 60.3K | 27 | 4.3K | 27.2K |
| `reviewer` | 22.2K | 222.7K | 60 | 3.7K | 349.3K |
| `docs-keeper` | 22.9K | 122.4K | 39 | 4.1K | 138.4K |
| `docs-keeper` | 22.3K | 97.6K | 36 | 4.0K | 107.0K |
| `docs-keeper` | 23.3K | 92.6K | 19 | 5.0K | 100.4K |
| `docs-keeper` | 22.7K | 76.0K | 9 | 3.6K | 84.3K |
| `docs-keeper` | 22.2K | 68.5K | 9 | 3.8K | 78.0K |
| `docs-keeper` | 21.5K | 68.1K | 16 | 3.4K | 73.6K |
| `docs-keeper` | 22.1K | 57.9K | 10 | 4.0K | 46.2K |
| `docs-keeper` | 22.4K | 55.3K | 12 | 4.2K | 46.2K |
| `docs-keeper` | 21.5K | 43.1K | 4 | 2.1K | 38.2K |

Totals: tool results 2,597.4K characters in 771 results; Bash 1,700.9K in 474 calls, Read 825.5K in 70, Edit 19.3K, `mcp__cds-mcp__*` 28.9K, `mcp__chrome-devtools__*` 14.2K, Write 7.0K.

## What the figures do and do not say

- Characters, not tokens. Thinking characters include the signature of each block, so 25% overstates thinking.
- A Bash result that names several files is split evenly among them. A file that no longer exists (the pruned #28 folder) is attributed only when it was read through `Read`, so 352.6K for `docs/features/**` is a lower bound. 67% of tool-result characters could be attributed to a file.
- A repeat delivery is counted by path. Two partial reads of different ranges count as a repeat, so 197.3K (7.6%) is an upper bound. The strict figure, a whole-file `Read` of a path the same agent already read whole with no own edit in between, is 0 of 70.
- The issue's "PLAN.md read twice (24K each)" is two launches of `cap-backend-dev`, each reading it once. Each launch has its own context, so that is the role brief's subject, not the read gate's.
- Peak follows the number of requests of a launch (66 requests: 280.6K; 4 requests: 43.1K). The launch granularity of `/feature` is out of scope here; the card will show it per launch.

## Check output, measured 2026-11-09

| Command | Result | Output |
|---|---|---|
| `npm test` | 246 passed in 16 files, 38.9 s | 739 bytes, 19 lines; 6 lines are `ExperimentalWarning: SQLite` printed three times |
| `npx vitest run --silent` in a temp project, 2 of 3 tests red | exit 1 | 3,254 bytes, 86 lines; the drift of 20 lines inside an 88K string is printed as one hunk with context |
| `npm run lint`, `npm run lint:js` | 0 errors, 2 warnings (a gitignored file under `.pipeline/verify/`) | 285 bytes each; both print the same ESLint report |
| `npm run format:check` | clean | 204 bytes |
| `node scripts/check-docs-fresh.mjs` | fresh | 24 bytes |
| `node scripts/wiki.mjs audit` | clean | 18 bytes |
| `app/products`: `npm run lint`, `npm run lint:js` | 0 problems; 0 errors, 10 warnings | 85 and 1,118 bytes |

## Rejected during the research

- A wrapper around the check commands and a custom vitest reporter: nothing to shorten at these sizes (PLAN Q3).
- A hook on Bash prints: 53% of tool-result characters, but a `sed -n` range or a `grep -n` is a precise read, and recognising a print needs a shell parser in a hook (PLAN Q5).
- Copying SCREENS.md sections into the brief: the #10 file is 92.6K characters, close to what one `Read` returns; the brief lists the sections with line ranges instead.
- Inline as the only hand-over: every estimated #10 brief is above 10,000 characters.

## Not measured, named as plan steps

- Delivery of SubagentStart `additionalContext`, the 10,000-character limit, the PreToolUse input of a subagent's `Read`, the deny path, stderr of a blocking hook: PLAN step 2 (facts F1-F6).
- The measured brief sizes of #10 after the migration: PLAN steps 4 and 9 (`feature-brief.mjs --all`, `--record`).
- The output of `npm run test:ui` and the context of UI roles: no UI launch in #28; the card of `/feature #10` gives them.
