# ADR-0019: Backlog in GitHub Issues, feature folders only while in work

Date: 2026-09-25. Status: accepted (user, 2026-09-25, chore `backlog-issues`).

## Context
The project had no place for a planned feature. `docs/STATE.md` carries one `Next` sentence and a debt table; `docs/features/<name>/` is created by `/spec` or `/feature` and holds the specification, review, verification and screenshots of a feature. When the user sent a list of six tasks on 2026-09-25, the first attempt was a `docs/BACKLOG.md` file, the second six folders with a `REQUEST.md` each. The user rejected both: the folder must not accumulate planned or finished material, the queue needs priorities, and the session should open with a short briefing of what is going on and what to do first, in the user's language. The repository already writes issues from automation (`upstream-check.yml`, issue #2), `gh` is authenticated with the `repo` scope, Projects would need a further scope.

## Decision
A planned feature is a GitHub issue with the `feature` label and a body in the shape of `.github/ISSUE_TEMPLATE/feature.yml` (Request, Original, Blocked by, Scope hints, Questions). It is created by the `/backlog` skill from chat or by the issue form in the browser. Priority is a label `prio:P1`, `prio:P2` (default) or `prio:P3`; a dependency is an issue number in the "Blocked by" section. The queue is priority, then age; the recommendation is the item labeled `in-progress`, else the first item whose blockers are all closed: `/spec #N` without a plan, `/feature #N` with `spec-ready`. `scripts/lib/backlog.mjs` computes this from `gh issue list` JSON with a cache in `.pipeline/issues.json` (8 s timeout, never throws); `scripts/backlog.mjs` is the CLI for the skills; the SessionStart hook prints the briefing first (language, now, queue, recommendation, debt count) and demotes the upstream digest to a pointer.

`docs/features/<name>/` exists only from `/spec` to phase 7 of `/feature`. Phase 7 posts `SUMMARY.md` as the closing comment of the issue, closes it, and `scripts/prune-feature.mjs <name>` deletes everything but `SUMMARY.md`, which gains a `## Full record` permalink to the last commit that held the folder. The four features finished before this ADR are pruned the same way.

The language of the briefing, of the `/backlog` output and of the chat is `PIPELINE_LANG`, an `env` entry of `.claude/settings.local.json` (per machine, gitignored), read by the scripts and printed by the briefing so that the model sees it; script texts live in `scripts/i18n/pipeline.properties` with a `pipeline_ru.properties` overlay, which keeps invariant 10 (Russian only in bundles) intact. Everything stored, issue bodies included, stays English.

## Alternatives
| Option | Why rejected |
|---|---|
| `docs/BACKLOG.md` or `REQUEST.md` folders | The user does not want planned material in the repository; two stores drift |
| GitHub Projects with a Priority field | Needs the `project` token scope and GraphQL; the manual card order is hard to read from a script; labels are enough for one developer and do not block a later move |
| Keep full feature folders after completion | Screenshots and four to six files per feature accumulate; git history and the closed issue hold the record |
| Hard-coded language in the hook | The user wants to choose; a per-machine setting keeps the repository language-neutral |

## Consequences
- New: `scripts/lib/backlog.mjs`, `scripts/backlog.mjs`, `scripts/prune-feature.mjs`, `scripts/i18n/pipeline*.properties`, `.github/ISSUE_TEMPLATE/feature.yml`, `.claude/skills/backlog/SKILL.md`, `test/backlog.test.js`.
- Changed: `scripts/hooks/session-start.mjs` (briefing, digest pointer), `spec` and `feature` skills (`#N`, labels, close and prune in phase 7), CLAUDE.md (doc map, invariants 2 and 10, skill table, do-not list), PATTERNS "Infrastructure" rows, CONVENTIONS "Languages" rows, STACK "Setup on a new machine"; `test/prompt-budget.json` re-recorded for the grown prompts.
- `templates/feature/REQUEST.md` and the six `REQUEST.md` folders of 2026-09-25 are replaced by six issues; `docs/STATE.md` `Next` points to the briefing instead of listing the queue.
- Offline sessions see the cached queue with its date, or a one-line notice without a cache.
- Creating, editing or closing an issue outside `/backlog`, `/spec` and `/feature` needs an explicit user request (CLAUDE.md).

## Sources
- GitHub CLI manual: `gh issue list --json`, `gh issue create --body-file`, `gh label create --force`.
- GitHub docs: syntax for issue forms (`.github/ISSUE_TEMPLATE/*.yml`).
- ADR-0018 (context budget: the briefing is a section with a fixed shape, the prompt ratchet is re-recorded).
