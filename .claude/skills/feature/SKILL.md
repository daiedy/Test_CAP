---
name: feature
description: Feature orchestrator from research to documentation with gates between phases. Use on requests "make a feature", "add an entity/screen/action", "implement ..." (Russian: «сделай фичу», «добавь сущность/экран/действие», «реализуй ...»). Delegates to the subagents architect, ux-designer, cap-backend-dev, fiori-app-dev or ui5-freestyle-dev, test-backend, test-ui, ui-verifier, reviewer, docs-keeper. Only the user starts it: if the user describes a code change without typing the command, propose `/feature <name>` (or `/spec` for a plan only) and wait.
argument-hint: <feature description> | #<issue number>
disable-model-invocation: true
---

# Feature: $ARGUMENTS

You are the orchestrator. You do not write code yourself, you delegate to subagents through the Agent tool, passing each one the feature name and the path to `docs/features/<name>/`. There are gates between phases. Choose the gate mode once at the start and do not ask again.

## Phase 0. Preparation

1. Argument `#N` (ADR-0019): the kebab-name is the issue title before the colon, the request is the issue body (`gh issue view N --json title,body`). A plain description: come up with a kebab-name. Confirm the name with the user together with the gate mode:
   - **semi-autonomous** (default): after each phase show the result and wait for "next";
   - **autonomous**: stop only at plan approval and on red checks;
   - **manual**: wait after each phase, do not run checks automatically.
2. Check that the tree is clean: `git status --porcelain`. If there are foreign changes, ask whether to continue.
3. Create the branch `feature/<name>` and the directory `docs/features/<name>/`. For an issue: `node scripts/backlog.mjs status N in-progress`; the STATE `Feature` line reads `<name> (#N)`.

## Phase 1. Research and plan

Delegate to `architect`: write CONTEXT.md (the implementers' brief), PLAN.md and, for experiments and framework facts, `research/*.md`; a PLAN.md left by `/spec` is reviewed, not rewritten. If the feature has a UI, after architect delegate to `ux-designer` for SCREENS.md. Gate: run `node scripts/check-feature-docs.mjs <name>` and hand a red result back to `architect`; then show the user the plan and the open questions; do not proceed without an explicit "approved" (in all modes). On approval, `architect` sets the ADR status by replacing the whole `Status:` sentence with the accepted form from `templates/adr.md`, never by appending to the proposed one.

## Phase 2. Backend

Delegate to `cap-backend-dev` with the plan steps that relate to db/srv/_i18n. Then `test-backend` for the backend acceptance criteria. Gate: `npm run lint` and `npm test` are green, the output is attached in the reports. If the phase changed the OData model, the snapshot (`npx vitest -u`) and `app/products/webapp/localService/metadata.xml` were regenerated in this same phase, so the sync test in `test/metadata.test.js` is green here and not deferred to phase 3. Commit `feat(srv): <name> backend`.

## Phase 3. UI

If the plan has a UI: delegate to `fiori-app-dev` (or `ui5-freestyle-dev` if the plan chose freestyle), then `test-ui`. Gate: `npm run lint` in `app/products` without errors, `npm test` green (the metadata snapshot updated deliberately). Commit `feat(app): <name> ui`.

## Phase 4. Verification

Delegate to `ui-verifier` with a per-scenario turn budget and the instruction to write `VERIFICATION.md` incrementally; if it stops at its turn limit, resume it with SendMessage ("continue from scenario N") instead of starting a new agent. Gate: `VERIFICATION.md` with the verdict "ready for review". On defects go back to phase 2 or 3 with an exact list of defects (no more than two rounds, then ask the user).

## Phase 5. Review

Delegate to `reviewer`. Gate: zero blocking findings. Send the findings to the corresponding developer, then a repeated review only of the fixed items.

## Phase 6. Documentation

Delegate to `docs-keeper`: registry, CHANGELOG, STATE, SUMMARY, LESSONS, and a line in PATTERNS for a new pattern. Gate: `node scripts/check-docs-fresh.mjs` green. Commit `docs: <name> summary and registry`.

## Phase 7. Completion

For an issue: `node scripts/backlog.mjs close N --summary docs/features/<name>/SUMMARY.md` (posts the summary, drops the labels, closes), then `node scripts/prune-feature.mjs <name>` keeps only `SUMMARY.md` with a permalink to the full record (ADR-0019); commit `docs: <name> close #N and prune`; STATE `Feature: none`. Show the user: the list of commits, what is closed from the acceptance criteria, what remains in the open debt. Push and pull request only on the user's instruction.

## Orchestrator rules

- After every phase gate, update the `Feature`, `Phase`, `Last commit` and `Next` lines of the `## Now` section of `docs/STATE.md` before starting the next phase; never add a paragraph there (ADR-0018). The Stop hook requires STATE to reflect changed code and to keep the template shape, and the orchestrator is the one who knows the phase state.
- All artifacts of the feature (CONTEXT, PLAN, SUMMARY, VERIFICATION, ADRs, commit messages, code comments) are written in English; the conversation with the user is in `PIPELINE_LANG` (printed by the SessionStart briefing) or, unset, in the user's language.

- Pass to every agent: the feature name, the path to the feature directory, the plan step numbers, the gate mode, the requirement of a report in the protocol format, and its reading list (ADR-0018):

  | Role | Reads | Does not read |
  |---|---|---|
  | `cap-backend-dev`, `test-backend` | PLAN.md, CONTEXT.md | SCREENS.md; `research/` unless a step names a file |
  | `fiori-app-dev`, `ui5-freestyle-dev`, `test-ui` | PLAN.md, CONTEXT.md, SCREENS.md | `research/` unless a step names a file |
  | `ui-verifier` | PLAN.md, SCREENS.md | CONTEXT.md, `research/` |
  | `reviewer` | everything in the feature directory | `docs/ai-pipeline-plan.md` |
  | `docs-keeper` | PLAN.md and the agents' reports | `research/` |
- Never skip the review and documentation phases, even in autonomous mode.
- If an agent returned "ADR needed" or "no pattern", stop the pipeline and hand the question to the user.
- Commits only for the files of the phase (`git add <files>`), message in conventional commits style, no `git add -A`.
- The orchestrator verifies, it does not fix. A defect in an agent's output goes back to the owning agent (or the resumed one) with the evidence, even when the fix looks like one line. If the agent is dead and you must act, run exactly the check the acceptance criterion names: for a UI artifact the browser or the framework's own request shape (`$batch`), not a hand-typed request. A bare `curl GET` once passed a mock fixture that failed on the `$batch` path the application uses (CHANGELOG 2026-09-16).
- Any agent may stop at its turn limit or stall on the stream watchdog. Before relaunching, read `git status` for what it already wrote; resume it with SendMessage ("continue from ..."; for an agent with nothing on disk: "first tool call: write the file"). Relaunch only if it does not answer, and hand the new instance the on-disk state instead of the original brief.
