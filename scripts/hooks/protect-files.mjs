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

const PROTECTED = [
  'mta.yaml',
  'xs-security.json',
  'app/**/ui5-deploy.yaml',
  '**/package-lock.json',
  'package-lock.json',
  '.claude/**',
  '.mcp.json',
  'scripts/hooks/**',
  'docs/registry/**',
  'docs/ai-pipeline-plan.md',
];
const PROTECTED_EXCEPTIONS = ['.claude/agent-memory/**'];
const REUSE_WATCH = ['srv/lib/**', 'app/**/webapp/ext/**'];

const REASONS = {
  'docs/registry/**': 'генерируется скриптом; выполни `npm run docs:registry` вместо ручной правки',
  'scripts/hooks/**': 'скрипты хуков меняет только человек; попроси пользователя',
  '.claude/**': 'конфигурация агентов защищена; попроси пользователя внести правку',
  '.mcp.json':
    'конфигурация MCP защищена; версии поднимаются через release-check по решению пользователя',
  'docs/ai-pipeline-plan.md': 'план правится только по прямому запросу пользователя',
};

try {
  const input = readStdinJson();
  const tool = input.tool_name || '';
  const filePath = input.tool_input?.file_path;
  if (!['Edit', 'Write', 'MultiEdit'].includes(tool) || !filePath) process.exit(0);

  const root = repoRoot();
  const r = rel(filePath, root);
  if (!insideRepo(r)) process.exit(0);

  if (process.env.PIPELINE_ALLOW_PROTECTED !== '1') {
    const hit = PROTECTED.find((g) => isUnder(r, g));
    if (hit && !isUnder(r, PROTECTED_EXCEPTIONS)) {
      const why = REASONS[hit] || 'файл защищён; изменение требует явного запроса пользователя';
      emitJson({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Правка «${r}» запрещена конвейером: ${why}. Для осознанной правки пользователь запускает сессию с PIPELINE_ALLOW_PROTECTED=1.`,
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
        additionalContext: `Создаётся новый файл «${r}». Перед этим проверь docs/registry/REUSE-CATALOG.md и docs/registry/UI-ARTIFACTS.md на дубликаты и вызови mcp__cds-mcp__search_model по теме. Если аналог есть, расширь его вместо нового файла.`,
      },
    });
  }
} catch {
  // advisory hook: never break the tool call on internal errors
}
process.exit(0);
