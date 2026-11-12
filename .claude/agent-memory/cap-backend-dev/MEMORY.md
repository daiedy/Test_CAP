# Memory index

- [cds add data touches mta.yaml](cds-add-data-touches-mta.md) — the generator silently merges its mta facet into protected mta.yaml; git status after it (2026-10-09)
- [Worktree Bash guard and file writes](worktree-bash-guard-file-writes.md) — heredocs, `VAR=... npx`, `rm -rf "$T"`, `cd X && rm glob` refused; literal /tmp paths; zsh keeps `$var` unsplit (2026-10-27)
- [OpenAPI converter: local copy wins](openapi-converter-local-copy.md) — cds compile uses the project's @cap-js/openapi; 1.7.0 gives Swagger UI 500 on drafts, root pinned at 1.6.0 (2026-10-25)
- [Registry chain in a temp copy](registry-chain-in-temp-copy.md) — prove docs:registry / --fix changes in an rsync copy with linked node_modules; no dated-header churn (2026-10-26)
- [Read a pinned action at its ref](pinned-action-read-at-ref.md) — default-branch README != pinned release; wiki-action v5.0.6 has no subfolder/blob link rewrite (2026-10-26)
- [Sandbox hook run from a scratch script](sandbox-hook-run-from-scratch.md) — createSandbox() from /tmp .mjs with stubbed global expect; red lint and red npm test setups (2026-11-11)
- [vitest -u runs the whole suite](vitest-u-runs-whole-suite.md) — file filter ignored, -u rewrites any mismatching snapshot; check test/__snapshots__ after (2026-11-12)
- [Claude Code hook runtime facts](claude-code-hook-runtime-facts.md) — internal SubagentStop ~32 s, live reload, agent_id join; 2.1.322: SubagentStop block after a handback is dropped, 10,000-char cap; denied handback: 3 nudges then withheld; compaction = `compact_boundary`; PostToolBatch in subagents, exact turn count at hook time (2026-11-13)
