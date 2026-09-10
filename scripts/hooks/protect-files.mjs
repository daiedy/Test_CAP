/**
 * PreToolUse hook (Edit|Write|MultiEdit): denies edits to protected files and
 * reminds about the reuse registry when a new shared module is created.
 * Bypass for deliberate maintenance: PIPELINE_ALLOW_PROTECTED=1
 */
import path from 'node:path';
import {
  readStdinJson,
  repoRoot,
  rel,
  insideRepo,
  isUnder,
  emitJson,
  exists,
} from '../lib/hook-utils.mjs';
import { protectedHit, reasonFor } from '../lib/protected-paths.mjs';

const REUSE_WATCH = ['srv/lib/**', 'app/**/webapp/ext/**'];

try {
  const input = readStdinJson();
  const tool = input.tool_name || '';
  const filePath = input.tool_input?.file_path;
  if (!['Edit', 'Write', 'MultiEdit'].includes(tool) || !filePath) process.exit(0);

  const root = repoRoot();
  const r = rel(filePath, root);
  if (!insideRepo(r)) process.exit(0);

  if (process.env.PIPELINE_ALLOW_PROTECTED !== '1') {
    const hit = protectedHit(r);
    if (hit) {
      const why = reasonFor(hit);
      emitJson({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Editing "${r}" is denied by the pipeline: ${why}. For a deliberate edit the user starts the session with PIPELINE_ALLOW_PROTECTED=1.`,
        },
      });
      process.exit(0);
    }
  }

  const isNew = tool === 'Write' && !exists(path.resolve(root, r));
  if (isNew && isUnder(r, REUSE_WATCH)) {
    emitJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `A new file "${r}" is being created. Before that, check docs/registry/REUSE-CATALOG.md and docs/registry/UI-ARTIFACTS.md for duplicates and call mcp__cds-mcp__search_model on the topic. If a counterpart exists, extend it instead of creating a new file.`,
      },
    });
  }
} catch {
  // advisory hook: never break the tool call on internal errors
}
process.exit(0);
