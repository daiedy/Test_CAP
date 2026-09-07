---
name: feature
description: Feature orchestrator from research to documentation with gates between phases. Use on requests "make a feature", "add an entity/screen/action", "implement ..." (Russian: «сделай фичу», «добавь сущность/экран/действие», «реализуй ...»). Delegates to the subagents architect, ux-designer, cap-backend-dev, fiori-app-dev or ui5-freestyle-dev, test-backend, test-ui, ui-verifier, reviewer, docs-keeper.
argument-hint: <feature description>
disable-model-invocation: true
---

# Feature: $ARGUMENTS

You are the orchestrator. You do not write code yourself, you delegate to subagents through the Agent tool, passing each one the feature name and the path to `docs/features/<name>/`. There are gates between phases. Choose the gate mode once at the start and do not ask again.

## Phase 0. Preparation

1. Come up with a kebab-name for the feature from the description, confirm it with the user together with the gate mode:
   - **semi-autonomous** (default): after each phase show the result and wait for "next";
   - **autonomous**: stop only at plan approval and on red checks;
   - **manual**: wait after each phase, do not run checks automatically.
2. Check that the tree is clean: `git status --porcelain`. If there are foreign changes, ask whether to continue.
3. Create the branch `feature/<name>` and the directory `docs/features/<name>/`.

## Phase 1. Research and plan

Delegate to `architect`: write CONTEXT.md and PLAN.md. If the feature has a UI, after architect delegate to `ux-designer` for the "Screens" section. Gate: show the user the plan and the open questions; do not proceed without an explicit "approved" (in all modes).

## Phase 2. Backend

Delegate to `cap-backend-dev` with the plan steps that relate to db/srv/_i18n. Then `test-backend` for the backend acceptance criteria. Gate: `npm run lint` and `npm test` are green, the output is attached in the reports. Commit `feat(srv): <name> backend`.

## Phase 3. UI

If the plan has a UI: delegate to `fiori-app-dev` (or `ui5-freestyle-dev` if the plan chose freestyle), then `test-ui`. Gate: `npm run lint` in `app/products` without errors, `npm test` green (the metadata snapshot updated deliberately). Commit `feat(app): <name> ui`.

## Phase 4. Verification

Delegate to `ui-verifier`. Gate: `VERIFICATION.md` with the verdict "ready for review". On defects go back to phase 2 or 3 with an exact list of defects (no more than two rounds, then ask the user).

## Phase 5. Review

Delegate to `reviewer`. Gate: zero blocking findings. Send the findings to the corresponding developer, then a repeated review only of the fixed items.

## Phase 6. Documentation

Delegate to `docs-keeper`: registry, CHANGELOG, STATE, SUMMARY, LESSONS, and a line in PATTERNS for a new pattern. Gate: `node scripts/check-docs-fresh.mjs` green. Commit `docs: <name> summary and registry`.

## Phase 7. Completion

Show the user: the list of commits, what is closed from the acceptance criteria, what remains in the open debt. Push and pull request only on the user's instruction.

## Orchestrator rules

- After every phase gate, update the line "Active feature" in `docs/STATE.md` (phase done, commit hash, next step) before starting the next phase. The Stop hook requires STATE to reflect changed code, and the orchestrator is the one who knows the phase state.
- All artifacts of the feature (CONTEXT, PLAN, SUMMARY, VERIFICATION, ADRs, commit messages, code comments) are written in English; the conversation with the user is in the user's language.

- Pass to every agent: the feature name, the path to the feature directory, the plan step numbers, the gate mode, and the requirement of a report in the protocol format.
- Never skip the review and documentation phases, even in autonomous mode.
- If an agent returned "ADR needed" or "no pattern", stop the pipeline and hand the question to the user.
- Commits only for the files of the phase (`git add <files>`), message in conventional commits style, no `git add -A`.
