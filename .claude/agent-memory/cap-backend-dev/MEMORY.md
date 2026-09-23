# Memory index

- [Registry regeneration deadlocks the subagent gate](project_registry-regen-gate-deadlock.md) — never run `npm run docs:registry` as a subagent; PostToolUse asks for it, SubagentStop blocks on it, and the revert is denied too.
