---
name: verifying-hook-runtime-from-transcripts
description: How to check a hook's live behaviour (fired, silent, lagged count) from subagent transcripts and .pipeline records, and why record-based rates understate silent misses
metadata:
  type: feedback
---

To judge a hook that advises or counts, cross-check its `.pipeline/metrics-<session>.jsonl` records against the subagent transcript `~/.claude/projects/<slug>/<session>/subagents/agent-<id>.jsonl`. Group the `assistant` records by `requestId` to get the turns. Collect the tool_use ids per turn, then join the tool_result timestamps from the `user` records. Hook output appears as `attachment` records (`hook_success`, `hook_additional_context` with the `hookEvent`); a silent hook run leaves none.

**Why:** in agent-turn-budget (#60) VERIFICATION counted "3 of 7 records one short". The threshold batch (turn 54 of a 60-turn run) read 53, stayed silent and left no record, so the real lag rate was higher and the first note also came one turn late. Record-only evidence hides exactly the misses that matter at a threshold.

**Worst-case replay:** to test a count that must survive a lagged read, run the library function on `records.slice(0, k)` (everything before the `assistant` record holding the batch's tool use) and compare with `slice(0, k + 1)`. In the #60 re-review this exposed the documented "one high" case: on a handback turn a text record of the same request comes before its tool use.

**How to apply:** when a feature's VERIFICATION reports a rate taken from hook records, find the threshold turn in the transcript, check that its batch made a tool call and whether a record or attachment exists. Use a scratch `.mjs` under `/tmp`, never in the repo. Related: [[verifying-test-guard-strength]], [[pipeline-review-conventions]].
