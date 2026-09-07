---
name: review
description: Review of the current changes against conventions, patterns and registries by the reviewer agent. Use when the user says "check the code", "review", "what is wrong with the changes" (Russian: «проверь код», «ревью», «что не так с изменениями»), before a commit.
disable-model-invocation: true
---

Delegate to `reviewer` via Agent: a review of the current diff (`git diff`, new files) against `docs/architecture/CONVENTIONS.md`, `PATTERNS.md`, `docs/registry/*` and, if present, `docs/features/<name>/PLAN.md`. Pass the feature name if known.

Show the user the review result without changes. If there are blocking findings, propose which agent to hand them to, and wait for the decision.
