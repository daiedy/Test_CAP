#!/usr/bin/env node
// Probe of the Claude Code hook facts F1-F8 of `docs/features/context-hygiene/CONTEXT.md`
// ("All: probe facts and fallbacks (step 2)"), PLAN step 2.
//
// The probe runs in a throwaway project OUTSIDE the repository: its own `.claude/settings.json`
// registers one probe hook per event and `.claude/agents/hook-probe.md` defines one probe agent.
// The repository's settings and hooks are never touched. The hooks are this file, copied into
// the temp project and called as `node <dir>/hook-probe.mjs hook <mode>`.
//
// Usage (Node 22):
//   node hook-probe.mjs build <dir> [variant]
//                                       build the temp project, print the headless command;
//                                       variant `handback` (default: auto mode, the agent reports
//                                       through SubagentHandback), `plain-first` (auto mode, the
//                                       agent's first turn ends in plain text before any handback,
//                                       so SubagentStop fires before a report), `manual` (dontAsk
//                                       mode with allowed tools: no SubagentHandback tool at all),
//                                       `handback-gate` (auto mode; the first SubagentHandback is
//                                       denied with a 12,000-char reason, and every SubagentStop
//                                       after a delivered report exits 2, at most twice per agent),
//                                       `handback-limit` (auto mode, F9; every SubagentHandback is
//                                       denied with a neutral reason, the agent calls it again only
//                                       when Claude Code tells it the report was not delivered, so
//                                       the attempts count the platform's retries; no stop blocks)
//   node hook-probe.mjs run <dir>       run that command (claude -p, cwd = <dir>), save the JSON result
//   node hook-probe.mjs analyze <dir>   print the evidence: hook input keys, transcript record
//                                       kinds, keys, sizes and probe tokens (no prompt text)
//   node hook-probe.mjs hook <mode>     hook runtime, called by the temp project's settings
//
// Environment: CLAUDE_BIN (default `claude` on PATH), PROBE_MODEL (default `claude-haiku-5-5`).
// Privacy (docs/metrics/definitions.md): `analyze` prints keys, kinds, sizes and the probe's own
// tokens only; the hook logs with the full stdin stay in the temp project.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const MARKER = 'probe.json';
const AGENT = 'hook-probe';
const F2_SIZES = [9500, 10000, 10001, 10500];
const F6_SIZE = 12000;
const TOKEN_RE = /PROBE-[A-Z0-9][A-Z0-9-]*/g;

// ---------------------------------------------------------------------------------------------
// Sized probe strings: exact length, BEGIN and END markers, a position marker every 1,000 chars,
// so a cut or a preview shows where it happened.

function sized(label, n, instruction = '') {
  const head = `PROBE-${label}-BEGIN ${instruction}`;
  const tail = ` PROBE-${label}-END`;
  const body = Array.from({ length: n }, () => '.');
  for (let at = 1000; at < n; at += 1000) {
    const mark = `[@${at}]`;
    for (let i = 0; i < mark.length && at + i < n; i++) body[at + i] = mark[i];
  }
  for (let i = 0; i < head.length; i++) body[i] = head[i];
  for (let i = 0; i < tail.length; i++) body[n - tail.length + i] = tail[i];
  const s = body.join('');
  if (s.length !== n) throw new Error(`sized(${label}) is ${s.length}, not ${n}`);
  return s;
}

const f6Instruction = (label) =>
  `Instruction from the probe stop hook: reply with one line "PROBE-${label}-SEEN", the last ` +
  `position marker [@N] you can see in this message, and "END visible" or "END missing" for the ` +
  `PROBE-${label}-END marker; then carry on with what you were doing. `;

// ---------------------------------------------------------------------------------------------
// build

function repoRoot() {
  return resolve(dirname(SELF), '..', '..', '..', '..');
}

function guardDir(dir) {
  const abs = resolve(dir);
  const root = repoRoot();
  if (abs === root || abs.startsWith(root + sep)) {
    throw new Error(`refusing ${abs}: the probe project must live outside the repository`);
  }
  if (existsSync(abs) && readdirSync(abs).length && !existsSync(join(abs, MARKER))) {
    throw new Error(`refusing ${abs}: not empty and not a probe project (no ${MARKER})`);
  }
  return abs;
}

function settingsFor(dir) {
  const cmd = (mode) => ({
    type: 'command',
    command: `node '${join(dir, 'hook-probe.mjs')}' hook ${mode}`,
  });
  return {
    hooks: {
      SubagentStart: [
        {
          matcher: AGENT,
          hooks: [cmd('start-f1'), ...F2_SIZES.map((n) => cmd(`start-size-${n}`)), cmd('start-f5')],
        },
      ],
      PreToolUse: [
        { matcher: 'Read', hooks: [cmd('pre-read')] },
        { matcher: 'SendMessage', hooks: [cmd('pre-send')] },
        { matcher: 'SubagentHandback', hooks: [cmd('pre-handback')] },
      ],
      PostToolUse: [{ matcher: 'SubagentHandback', hooks: [cmd('post-handback')] }],
      SubagentStop: [{ matcher: AGENT, hooks: [cmd('subagent-stop')] }],
      Stop: [{ hooks: [cmd('stop')] }],
    },
  };
}

const VARIANTS = ['handback', 'plain-first', 'manual', 'handback-gate', 'handback-limit'];

// `handback-limit` (F9): the agent never retries a denied SubagentHandback on its own, so every
// attempt after the first is one Claude Code asked for.
const F9_RULE = `If a SubagentHandback call is denied, do not call SubagentHandback again on your own and do not change the message: end your turn with exactly the line "PROBE-F9-WAIT-<n>", where <n> is the number in the denial. Call SubagentHandback again, with the same message, only when a message tells you that your report was not delivered.\n`;

function agentFile(dir, variant) {
  const target = join(dir, 'target.txt');
  const step0 =
    variant === 'plain-first'
      ? `Step 0. Your first reply is exactly the line "PROBE-PLAIN-FIRST" and nothing else: call no tool, not even SubagentHandback, and end your turn. Start step 1 only when a message that starts with PROBE-F6 arrives.\n`
      : '';
  const f9 = variant === 'handback-limit' ? F9_RULE : '';
  return `---
name: ${AGENT}
description: Probe agent of the context-hygiene hook probe. Use only when the prompt asks for the hook probe.
tools: Read
model: inherit
maxTurns: ${variant === 'handback-limit' ? 30 : 15}
---

You are a hook probe. Do exactly these steps and nothing else.

${step0}Step 1. Look at every hook context block you received before the task prompt (system reminders added by SubagentStart hooks). For each block write one line: the first 30 characters, the last 30 characters, its length in characters as far as you can tell, and, if it says the text was saved to a file, the file path.
Step 2. Call Read on ${target} with only file_path (no offset, no limit).
Step 3. If step 2 was denied, quote the denial reason exactly, then call Read again with exactly the same input. Write down what the retry returned (the first line of the file, or the new denial).
Step 4. Call Read on ${target} with offset 2 and limit 2. Write down the lines it returned.
Step 5. Deliver your report with the SubagentHandback tool. The message is exactly:
PROBE-F8-REPORT-BEGIN
<your lines from steps 1-4>
PROBE-F8-REPORT-END
If you have no SubagentHandback tool, give the same text as your final reply and say "no SubagentHandback tool" in it.
${f9}
If a message starts with PROBE-F6, follow its instruction, then finish (deliver again only if the message asks for it).
If you later receive a message that starts with PROBE-RESUME, list every token starting with PROBE-F1, PROBE-F2 or PROBE-F5 that you can see anywhere in your context, then deliver a new report with SubagentHandback whose message starts with PROBE-F8-RESUME-BEGIN and ends with PROBE-F8-RESUME-END.
`;
}

const MAIN_PROMPT = `This is a hook probe in a throwaway project. Do exactly this and nothing else:
1. Launch the subagent "${AGENT}" with the Agent tool in the foreground, description "hook probe", prompt "Run the probe procedure of your instructions."
2. When its report arrives, resume it with the SendMessage tool: "to" is the agent ID you received, the message is "PROBE-RESUME: list the PROBE-F1, PROBE-F2 and PROBE-F5 tokens you see and deliver again."
3. Wait for its second report, then reply with one line: "DONE" followed by the agent ID.
If a stop hook gives you an instruction that starts with PROBE-F6, follow it, then continue with the steps above.`;

const MAIN_PROMPT_F9 = `This is a hook probe in a throwaway project. Do exactly this and nothing else:
1. Launch the subagent "${AGENT}" with the Agent tool in the foreground, description "hook probe", prompt "Run the probe procedure of your instructions."
2. Do not resume it and do not send it any message. When it has finished, reply with one line: "DONE", the agent ID, then "report" if its result holds a text between PROBE-F8-REPORT-BEGIN and PROBE-F8-REPORT-END, else "no report".`;

const mainPrompt = (variant) => (variant === 'handback-limit' ? MAIN_PROMPT_F9 : MAIN_PROMPT);

function commandFor(dir, cfg) {
  // `manual`: no auto mode, so no SubagentHandback tool; the three tools the probe needs are
  // allowed explicitly and anything else is denied without a prompt.
  const mode =
    cfg.variant === 'manual'
      ? ['--permission-mode', 'dontAsk', '--allowedTools', 'Read,Agent,SendMessage']
      : ['--permission-mode', 'auto'];
  return [
    cfg.claudeBin,
    '-p',
    mainPrompt(cfg.variant),
    '--output-format',
    'json',
    '--model',
    cfg.model,
    ...mode,
    '--permission-prompts',
    'none',
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--no-chrome',
    '--max-turns',
    '12',
    '--max-budget-usd',
    '3',
    '--session-id',
    cfg.sessionId,
  ];
}

function build(dirArg, variant = 'handback') {
  if (!VARIANTS.includes(variant))
    throw new Error(`unknown variant ${variant}: ${VARIANTS.join(', ')}`);
  const dir = guardDir(dirArg);
  rmSync(dir, { recursive: true, force: true });
  for (const d of ['.claude/agents', 'logs', 'state', 'out'])
    mkdirSync(join(dir, d), { recursive: true });
  const cfg = {
    dir,
    sessionId: randomUUID(),
    runToken: randomBytes(4).toString('hex').toUpperCase(),
    claudeBin: process.env.CLAUDE_BIN || 'claude',
    model: process.env.PROBE_MODEL || 'claude-haiku-5-5',
    variant,
    built: new Date().toISOString(),
  };
  writeFileSync(join(dir, MARKER), JSON.stringify(cfg, null, 2) + '\n');
  copyFileSync(SELF, join(dir, 'hook-probe.mjs'));
  writeFileSync(
    join(dir, '.claude/settings.json'),
    JSON.stringify(settingsFor(dir), null, 2) + '\n'
  );
  writeFileSync(join(dir, '.claude/agents', `${AGENT}.md`), agentFile(dir, variant));
  writeFileSync(
    join(dir, 'target.txt'),
    [
      'PROBE-TARGET line 1',
      'PROBE-TARGET line 2',
      'PROBE-TARGET line 3',
      'PROBE-TARGET line 4',
      '',
    ].join('\n')
  );
  const quoted = commandFor(dir, cfg).map((a) =>
    /^[\w./:=-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`
  );
  process.stdout.write(`built ${dir} (session ${cfg.sessionId}, token ${cfg.runToken})\n`);
  process.stdout.write(`cd '${dir}' && ${quoted.join(' ')}\n`);
}

// ---------------------------------------------------------------------------------------------
// run

function cleanEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(CLAUDE|PIPELINE_)/.test(k)) continue; // no nested-session or messaging variables
    env[k] = v;
  }
  return env;
}

function run(dirArg) {
  const dir = resolve(dirArg);
  const cfg = JSON.parse(readFileSync(join(dir, MARKER), 'utf8'));
  const [bin, ...args] = commandFor(dir, cfg);
  const started = Date.now();
  const r = spawnSync(bin, args, {
    cwd: dir,
    env: cleanEnv(),
    input: '',
    encoding: 'utf8',
    timeout: 20 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(join(dir, 'out/result.json'), r.stdout || '');
  writeFileSync(join(dir, 'out/stderr.txt'), r.stderr || '');
  let summary;
  try {
    const j = JSON.parse(r.stdout);
    summary = {
      subtype: j.subtype,
      is_error: j.is_error,
      num_turns: j.num_turns,
      total_cost_usd: j.total_cost_usd,
      session_id: j.session_id,
      resultChars: typeof j.result === 'string' ? j.result.length : null,
      resultTokens: typeof j.result === 'string' ? j.result.match(TOKEN_RE) : null,
    };
  } catch {
    summary = { stdoutBytes: (r.stdout || '').length };
  }
  const out = {
    exit: r.status,
    signal: r.signal,
    error: r.error && String(r.error),
    ms: Date.now() - started,
    stderrBytes: (r.stderr || '').length,
    ...summary,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

// ---------------------------------------------------------------------------------------------
// hook runtime (runs inside the temp project)

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function logLine(dir, file, obj) {
  appendFileSync(join(dir, 'logs', file), JSON.stringify(obj) + '\n');
}

function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { unparsable: l.length };
      }
    });
}

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const expand = (p) => (p && p.startsWith('~/') ? join(homedir(), p.slice(2)) : p);

/** What a transcript says about a SubagentHandback: the records that name it, by kind. */
function handbackInTranscript(file) {
  const f = expand(file);
  if (!f || !existsSync(f)) return { exists: false };
  const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const hits = [];
  lines.forEach((l, i) => {
    if (!l.includes('SubagentHandback')) return;
    let rec;
    try {
      rec = JSON.parse(l);
    } catch {
      hits.push({ line: i, unparsable: true });
      return;
    }
    const blocks = Array.isArray(rec.message?.content) ? rec.message.content : [];
    const use = blocks.find((b) => b.type === 'tool_use' && b.name === 'SubagentHandback');
    hits.push({
      line: i,
      type: rec.type,
      subtype: rec.subtype,
      attachmentType: rec.attachment?.type,
      blockKinds: blocks.map((b) => (b.type === 'tool_use' ? `tool_use:${b.name}` : b.type)),
      handbackMessageChars: use?.input?.message?.length,
      handbackMessageSha: use?.input?.message ? sha(use.input.message) : undefined,
    });
  });
  return { exists: true, bytes: statSync(f).size, lines: lines.length, hits };
}

function hook(mode) {
  const dir = dirname(SELF);
  const cfg = JSON.parse(readFileSync(join(dir, MARKER), 'utf8'));
  const raw = readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = { unparsable: raw.length };
  }
  const now = new Date().toISOString();
  const logFile = `${mode}.jsonl`;
  const prior = readJsonl(join(dir, 'logs', logFile));
  logLine(dir, logFile, { ts: now, mode, input });
  const out = (o) => process.stdout.write(JSON.stringify(o));

  if (mode === 'start-f1') {
    return out({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: `PROBE-F1-TOKEN-${cfg.runToken}`,
      },
    });
  }
  const size = /^start-size-(\d+)$/.exec(mode);
  if (size) {
    const n = Number(size[1]);
    return out({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: sized(`F2-${n}`, n),
      },
    });
  }
  if (mode === 'start-f5') {
    const again = prior.some((p) => p.input?.agent_id === input.agent_id);
    if (!again) return;
    return out({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: `PROBE-F5-RESUME-${cfg.runToken}`,
      },
    });
  }
  if (mode === 'pre-read') {
    const ti = input.tool_input || {};
    const whole = ti.offset === undefined && ti.limit === undefined && ti.pages === undefined;
    const key = sha(`${input.agent_id || 'main'}|${ti.file_path}`);
    const stateFile = join(dir, 'state', `read-${key}`);
    const seen = existsSync(stateFile);
    if (whole && !seen) {
      writeFileSync(stateFile, now);
      logLine(dir, 'decisions.jsonl', {
        ts: now,
        mode,
        decision: 'deny',
        agent_id: input.agent_id,
        file: ti.file_path,
      });
      return out({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `PROBE-F4-DENY-${cfg.runToken}: the first whole read of ${basename(String(ti.file_path))} is denied by the probe; repeat the same call.`,
        },
      });
    }
    logLine(dir, 'decisions.jsonl', {
      ts: now,
      mode,
      decision: 'pass',
      whole,
      agent_id: input.agent_id,
      file: ti.file_path,
    });
    return;
  }
  if (mode === 'pre-send') {
    const to = String(input.tool_input?.to ?? '');
    const base = String(input.transcript_path || '').replace(/\.jsonl$/, '');
    const subDir = join(expand(base), 'subagents');
    const byId = join(subDir, `agent-${to.replace(/^agent-/, '')}.jsonl`);
    let byName = null;
    if (existsSync(subDir)) {
      for (const f of readdirSync(subDir).filter((x) => x.endsWith('.meta.json'))) {
        const meta = readFileSync(join(subDir, f), 'utf8');
        if (to && meta.includes(JSON.stringify(to)))
          byName = join(subDir, f.replace(/\.meta\.json$/, '.jsonl'));
      }
    }
    logLine(dir, 'derived.jsonl', {
      ts: now,
      mode,
      to,
      derivedPath: byId,
      derivedExists: existsSync(byId),
      byName,
      transcript: handbackInTranscript(byId),
      subagentFiles: existsSync(subDir) ? readdirSync(subDir) : null,
    });
    return;
  }
  if (mode === 'pre-handback' || mode === 'post-handback') {
    const msg = input.tool_input?.message;
    // `handback-gate`: deny the agent's first SubagentHandback with a 12,000-char reason, the
    // alternative gate when a SubagentStop block after a handback reaches nobody.
    // `handback-limit` (F9): deny every attempt with a neutral, numbered reason.
    const attempt = prior.filter((p) => p.input?.agent_id === input.agent_id).length + 1;
    const limit = mode === 'pre-handback' && cfg.variant === 'handback-limit';
    const deny =
      limit || (mode === 'pre-handback' && cfg.variant === 'handback-gate' && attempt === 1);
    if (limit) {
      logLine(dir, 'derived.jsonl', {
        ts: now,
        mode,
        agent_id: input.agent_id,
        attempt,
        messageSha: typeof msg === 'string' ? sha(msg) : null,
        decision: 'deny',
      });
      return out({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `PROBE-F9-DENY-${attempt}: the probe denied this report (attempt ${attempt}).`,
        },
      });
    }
    logLine(dir, 'derived.jsonl', {
      ts: now,
      mode,
      agent_id: input.agent_id,
      messageChars: typeof msg === 'string' ? msg.length : null,
      messageSha: typeof msg === 'string' ? sha(msg) : null,
      tool_input_keys: Object.keys(input.tool_input || {}),
      tool_response_type:
        input.tool_response === undefined ? undefined : typeof input.tool_response,
      decision: deny ? 'deny' : 'pass',
    });
    if (deny) {
      return out({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: sized(
            'F6-HANDBACK',
            F6_SIZE,
            'Instruction from the probe handback gate: reply with one line "PROBE-F6-HANDBACK-SEEN", ' +
              'the last position marker [@N] you can see and "END visible" or "END missing" for the ' +
              'PROBE-F6-HANDBACK-END marker; then call SubagentHandback again with the same message. '
          ),
        },
      });
    }
    return;
  }
  if (mode === 'subagent-stop') {
    const last = input.last_assistant_message;
    const reportFile = join(dir, 'logs', `report-${input.agent_type}-${input.agent_id}.md`);
    if (typeof last === 'string') writeFileSync(reportFile, last);
    const handbacks = readJsonl(join(dir, 'logs', 'derived.jsonl')).filter(
      (d) => d.mode === 'pre-handback' && d.agent_id === input.agent_id
    );
    logLine(dir, 'derived.jsonl', {
      ts: now,
      mode,
      agent_id: input.agent_id,
      agent_type: input.agent_type,
      stop_hook_active: input.stop_hook_active,
      lastChars: typeof last === 'string' ? last.length : null,
      lastSha: typeof last === 'string' ? sha(last) : null,
      lastTokens: typeof last === 'string' ? last.match(TOKEN_RE) : null,
      handbackShasSoFar: handbacks.map((h) => h.messageSha),
      transcriptAtStop: handbackInTranscript(input.agent_transcript_path),
    });
    const firstStop = !prior.some((p) => p.input?.agent_id === input.agent_id);
    // `handback-gate`: block every stop that follows a delivered report, at most twice per agent.
    const atStop = handbackInTranscript(input.agent_transcript_path);
    const afterHandback = (atStop.hits || []).some(
      (h) => h.type === 'assistant' && h.handbackMessageChars
    );
    const blocksSoFar = readJsonl(join(dir, 'logs', 'decisions.jsonl')).filter(
      (d) => d.mode === mode && d.agent_id === input.agent_id
    ).length;
    const block =
      input.agent_type === AGENT &&
      cfg.variant !== 'handback-limit' &&
      (cfg.variant === 'handback-gate' ? afterHandback && blocksSoFar < 2 : firstStop);
    if (block) {
      logLine(dir, 'decisions.jsonl', {
        ts: now,
        mode,
        decision: 'block',
        agent_id: input.agent_id,
        afterHandback,
      });
      process.stderr.write(sized('F6-SUBAGENTSTOP', F6_SIZE, f6Instruction('F6-SUBAGENTSTOP')));
      process.exit(2);
    }
    return;
  }
  if (mode === 'stop') {
    if (prior.length === 0 && cfg.variant !== 'handback-limit') {
      process.stderr.write(sized('F6-STOP', F6_SIZE, f6Instruction('F6-STOP')));
      process.exit(2);
    }
    return;
  }
}

// ---------------------------------------------------------------------------------------------
// analyze

function keyShape(obj, depth = 0) {
  if (obj === null || typeof obj !== 'object' || depth > 1) return typeof obj;
  if (Array.isArray(obj)) return `array(${obj.length})`;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, depth < 1 ? keyShape(v, depth + 1) : typeof v])
  );
}

/** Every string inside `rec` that carries a probe token: its key path, length and tokens. */
function probeStrings(rec) {
  const found = [];
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const tokens = v.match(TOKEN_RE);
      if (!tokens) return;
      const marks = v.match(/\[@\d+\]/g);
      found.push({
        path,
        chars: v.length,
        tokens: [...new Set(tokens)],
        lastPositionMarker: marks ? marks[marks.length - 1] : null,
        savedPath: (v.match(/\/[^\s"'`)]+\.(?:txt|md|json|log)/) || [null])[0],
      });
      return;
    }
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(rec, '');
  return found;
}

function recordKind(rec) {
  const blocks = Array.isArray(rec.message?.content) ? rec.message.content : [];
  return {
    type: rec.type,
    subtype: rec.subtype,
    attachmentType: rec.attachment?.type,
    hookEvent: rec.attachment?.hookEvent ?? rec.hookEvent,
    origin: rec.origin?.kind ?? (typeof rec.origin === 'string' ? rec.origin : undefined),
    isMeta: rec.isMeta || undefined,
    blockKinds: blocks.map((b) => (b.type === 'tool_use' ? `tool_use:${b.name}` : b.type)),
  };
}

/** Characters of a record's message content, text and tool results together. */
function contentChars(rec) {
  const c = rec.message?.content;
  if (typeof c === 'string') return c.length;
  if (!Array.isArray(c)) return 0;
  return c.reduce(
    (n, b) =>
      n +
      (typeof b.text === 'string' ? b.text.length : 0) +
      (typeof b.content === 'string' ? b.content.length : 0),
    0
  );
}

function summarizeTranscript(file) {
  const recs = readJsonl(file);
  const versions = [...new Set(recs.map((r) => r.version).filter(Boolean))];
  const kinds = {};
  const probes = [];
  recs.forEach((rec, i) => {
    const k = recordKind(rec);
    const label = [k.type, k.subtype, k.attachmentType].filter(Boolean).join('/');
    kinds[label] = (kinds[label] || 0) + 1;
    const ps = probeStrings(rec);
    if (
      ps.length ||
      k.isMeta ||
      k.blockKinds.some((b) => /SubagentHandback|SendMessage|Read|Agent/.test(b)) ||
      k.subtype === 'compact_boundary'
    ) {
      probes.push({
        line: i,
        ts: rec.timestamp,
        ...k,
        contentChars: contentChars(rec),
        keys: Object.keys(rec),
        attachmentKeys: rec.attachment ? Object.keys(rec.attachment) : undefined,
        probeStrings: ps,
      });
    }
  });
  return {
    file,
    bytes: existsSync(file) ? statSync(file).size : 0,
    records: recs.length,
    versions,
    kinds,
    probes,
  };
}

function analyze(dirArg) {
  const dir = resolve(dirArg);
  const cfg = JSON.parse(readFileSync(join(dir, MARKER), 'utf8'));
  const logs = {};
  for (const f of readdirSync(join(dir, 'logs')).filter((x) => x.endsWith('.jsonl'))) {
    const rows = readJsonl(join(dir, 'logs', f));
    logs[f] = rows.map((r) =>
      r.input
        ? {
            ts: r.ts,
            hook_event_name: r.input.hook_event_name,
            agent_id: r.input.agent_id,
            agent_type: r.input.agent_type,
            inputKeys: keyShape(r.input),
            tool_input_keys: r.input.tool_input ? Object.keys(r.input.tool_input) : undefined,
            tool_input_to: r.input.tool_input?.to,
            stop_hook_active: r.input.stop_hook_active,
            lastAssistantChars:
              typeof r.input.last_assistant_message === 'string'
                ? r.input.last_assistant_message.length
                : undefined,
          }
        : r
    );
  }
  const reports = readdirSync(join(dir, 'logs'))
    .filter((x) => x.startsWith('report-'))
    .map((f) => {
      const s = readFileSync(join(dir, 'logs', f), 'utf8');
      return { file: f, chars: s.length, sha: sha(s), tokens: s.match(TOKEN_RE) };
    });
  const projects = join(homedir(), '.claude', 'projects');
  const slugDir = readdirSync(projects).find((d) =>
    existsSync(join(projects, d, `${cfg.sessionId}.jsonl`))
  );
  const main = slugDir ? join(projects, slugDir, `${cfg.sessionId}.jsonl`) : null;
  const subDir = slugDir ? join(projects, slugDir, cfg.sessionId, 'subagents') : null;
  const subFiles = subDir && existsSync(subDir) ? readdirSync(subDir) : [];
  const result = {
    session: cfg.sessionId,
    runToken: cfg.runToken,
    model: cfg.model,
    projectSlug: slugDir,
    subagentFiles: subFiles,
    hookLogs: logs,
    savedReports: reports,
    main: main ? summarizeTranscript(main) : null,
    agents: subFiles
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => summarizeTranscript(join(subDir, f))),
    metas: subFiles
      .filter((f) => f.endsWith('.meta.json'))
      .map((f) => ({ file: f, keys: keyShape(JSON.parse(readFileSync(join(subDir, f), 'utf8'))) })),
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// ---------------------------------------------------------------------------------------------

const [cmd, arg, extra] = process.argv.slice(2);
if (cmd === 'build') build(arg || join(process.env.TMPDIR || '/tmp', 'hook-probe'), extra);
else if (cmd === 'run') run(arg);
else if (cmd === 'analyze') analyze(arg);
else if (cmd === 'hook') hook(arg);
else {
  process.stderr.write('usage: node hook-probe.mjs build|run|analyze <dir> | hook <mode>\n');
  process.exit(1);
}
