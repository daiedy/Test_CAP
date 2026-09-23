# ADR-0017: Generated files are sanctioned by their content, not by the write route

Date: 2026-09-23. Status: accepted (user, 2026-09-23, retro of `catalog-authorization`).

## Context

ADR-0016 made the git-based gates (`subagent-stop.mjs`, `stop-gate.mjs`) audit every changed protected path regardless of the tool that wrote it: a changed file with no ADR-0014 `edit` record was written outside Edit/Write and, if protected, blocks. `docs/registry/**` is on the protected list because it is generated and must not be edited by hand.

The two facts collide. The registry's only legal writer is `npm run docs:registry`, which the protocol (section 6) orders every agent to run after a change under `db/`, `srv/` or `app/`; a generator leaves no `edit` record by definition, so its output always looked like a hand write. In the `catalog-authorization` run (2026-09-11 to 2026-09-16) this blocked `cap-backend-dev` and `fiori-app-dev` at SubagentStop and the orchestrator twice at Stop. The SubagentStop advice, `git checkout -- <path>`, is a command `protect-files-bash.mjs` denies to a subagent, and the untracked marker `docs/registry/.stale`, written by the PostToolUse hook, matched `docs/registry/**` too and could neither be read nor removed by a subagent. `stop-gate.mjs` made it circular: its freshness step runs `check-docs-fresh.mjs --fix`, which regenerates exactly the files its earlier protected-path step blocks on, so a revert bought one clean Stop and the next one blocked again. The only exit was a commit.

## Decision

A generated file is sanctioned by its content, not by the route that wrote it.

- `scripts/lib/protected-paths.mjs` gains `GENERATED = ['docs/registry/**']` and `protectedWriteHit(root, r)`. The git-based gates call it instead of `protectedHit()`: for a generated file it returns a hit only when the file lacks the generator header (`recordedHash()` is null), i.e. it was written by hand; otherwise it is the generator's output and passes. Every other protected path is audited unchanged.
- The PreToolUse guards (`protect-files.mjs`, `protect-files-bash.mjs`) keep using `protectedHit()`: a direct Edit/Write of `docs/registry/**`, or a shell command naming it, is still denied for a subagent and asked for the main thread. `test/hooks-protect-bash.test.js` is unchanged.
- The registry's gate is freshness, which already exists: `stop-gate.mjs` step 1 runs `check-docs-fresh.mjs --fix`, which rewrites a stale or hand-edited registry from the sources instead of blocking on it.
- `docs/registry/.stale` joins `PROTECTED_EXCEPTIONS` and `.gitignore`: it is pipeline state, not content.
- `subagent-stop.mjs` no longer tells a subagent to revert; it tells it to stop and report under "## Open questions". The protocol forbids working around a gate by reverting or deleting.
- `test/hooks-registry-gate.test.js` pins the table: generator output passes, a header-less registry file blocks, `.stale` is exempt, every other protected path is unchanged.

## Alternatives

| Option | Why rejected |
|---|---|
| Reorder `stop-gate.mjs` so freshness runs before the protected check | Breaks the cycle for the main thread only; `subagent-stop.mjs` has no `--fix` step and would still block every agent that follows protocol section 6 |
| Remove `docs/registry/**` from the protected list | Loses the PreToolUse denial of a direct hand edit, which is the ordinary case the list exists for |
| Count the registry as sanctioned only when `check-docs-fresh.mjs` reports fresh | Freshness hashes the sources, not the registry content, so it proves nothing about a hand edit either; and a registry regenerated before a later `srv/` edit is legitimately stale yet still generator output. The header check is the honest predicate |
| Have the generator write an ADR-0014 `edit` record for each file | Couples a documentation script to the audit log format and would sanction any script that imitates the record |
| Sanction by `PIPELINE_ALLOW_PROTECTED=1` | The variable is the user's sanction for pipeline maintenance, not for every `/feature` run; setting it for features switches the protection off (ADR-0016) |

## Consequences

- [ ] `npm run docs:registry` is safe for every agent at any point of a feature, as protocol section 6 has always required; the orchestrator no longer reverts the registry to pass a Stop.
- [ ] A registry file written by hand without the generator header still blocks at both gates with a reason naming the generator; one written by hand with a forged header is overwritten by `--fix` at the next Stop (accepted residual, same class as the false negatives ADR-0016 accepts).
- [ ] Rule `pipeline-config.md` documents the exemption; `.gitignore` hides the marker; the backend suite grows by the new test file.
- [ ] `docs/STATE.md` open debt: none added; the four blocks of the `catalog-authorization` run are history in `docs/CHANGELOG.md`.

## Sources

- ADR-0016 (write route), ADR-0014 (MCP audit `edit` records)
- `scripts/hooks/stop-gate.mjs`, `scripts/hooks/subagent-stop.mjs`, `scripts/lib/protected-paths.mjs`, `scripts/lib/file-checks.mjs` (`markStale`), `scripts/check-docs-fresh.mjs`, `scripts/gen-registry.mjs` (removes `.stale`)
- The four blocks: `cap-backend-dev` report of 2026-09-11 (`.claude/agent-memory/cap-backend-dev/project_registry-regen-gate-deadlock.md`), `fiori-app-dev` report of 2026-09-11 (`.claude/agent-memory/fiori-app-dev/project-stale-marker-blocks-subagent-stop.md`), two Stop hook blocks in the orchestrator session of 2026-09-11
