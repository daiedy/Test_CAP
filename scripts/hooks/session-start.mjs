/**
 * SessionStart hook: injects project state, framework digest and toolchain check into context.
 * Plain stdout is added to Claude's context. Never fails.
 */
import path from 'node:path';
import fs from 'node:fs';
import { readStdinJson, repoRoot, run, readLines, exists } from '../lib/hook-utils.mjs';

try {
  const input = readStdinJson();
  const root = repoRoot();
  const out = [];

  out.push(`# Контекст проекта Test_CAP (SessionStart, source=${input.source || 'unknown'})`);

  const state = path.join(root, 'docs', 'STATE.md');
  if (exists(state)) {
    out.push('', '## docs/STATE.md (первые 40 строк)', readLines(state, 40));
  } else {
    out.push('', 'docs/STATE.md отсутствует: создай его перед завершением работы.');
  }

  const updates = path.join(root, 'docs', 'framework', 'UPDATES.md');
  if (exists(updates)) {
    const lines = fs.readFileSync(updates, 'utf8').split('\n');
    const idx = lines.findIndex((l) => /^##\s+\d{4}-\d{2}-\d{2}/.test(l));
    if (idx >= 0) {
      out.push(
        '',
        '## Последний дайджест обновлений фреймворков',
        lines.slice(idx, idx + 16).join('\n')
      );
    }
  }

  // Toolchain check against docs/architecture/STACK.md expectations.
  let expectedNode = 22;
  let expectedCds = 10;
  const stack = path.join(root, 'docs', 'architecture', 'STACK.md');
  if (exists(stack)) {
    const text = fs.readFileSync(stack, 'utf8');
    const n = text.match(/Node\.js\s*\|\s*(\d+)/);
    const c = text.match(/cds-dk`?\s*глобально\s*\|\s*(\d+)/);
    if (n) expectedNode = Number(n[1]);
    if (c) expectedCds = Number(c[1]);
  }
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const cds = run('cds', ['--version'], { timeoutMs: 15_000 });
  const cdsMatch = cds.stdout.match(/@sap\/cds-dk[^\d]*(\d+)\.(\d+)\.(\d+)/);
  const cdsVersion = cdsMatch ? `${cdsMatch[1]}.${cdsMatch[2]}.${cdsMatch[3]}` : null;
  const warn = [];
  if (nodeMajor !== expectedNode)
    warn.push(`Node ${process.versions.node}, ожидается ${expectedNode}.x`);
  if (!cdsVersion) warn.push('глобальный `cds` не найден: npm i -g @sap/cds-dk@10');
  else if (Number(cdsMatch[1]) !== expectedCds)
    warn.push(`@sap/cds-dk ${cdsVersion}, ожидается ${expectedCds}.x`);
  out.push(
    '',
    '## Окружение',
    `Node ${process.versions.node}, @sap/cds-dk ${cdsVersion || 'не найден'}.` +
      (warn.length ? ` ВНИМАНИЕ: ${warn.join('; ')}.` : ' Соответствует STACK.md.')
  );

  out.push(
    '',
    'Протокол: MCP-first (cds-mcp для CDS и хендлеров, fiori-mcp для аннотаций и manifest, ui5-mcp для UI5), ' +
      'спецификация в docs/features/<name>/ до кода, реестр docs/registry/ до новых функций. Правила в CLAUDE.md и .claude/rules/.'
  );

  process.stdout.write(out.join('\n') + '\n');
} catch (e) {
  process.stdout.write(`SessionStart hook: не удалось собрать контекст (${e.message}).\n`);
}
process.exit(0);
