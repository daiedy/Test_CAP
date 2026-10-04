/**
 * Texts of the pipeline scripts in PIPELINE_LANG (PATTERNS "Language of the chat and the
 * briefing", ADR-0019): `scripts/i18n/pipeline.properties` overlaid with
 * `pipeline_<lang>.properties`. The one i18n loader of `scripts/`; backlog.mjs re-exports it, and
 * pipeline-metrics.mjs imports it from here, so neither depends on the other for a text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, exists } from './hook-utils.mjs';

export const DEFAULT_LANG = 'en';

/**
 * PIPELINE_LANG from the environment, else from .claude/settings.local.json `env`, else 'en'.
 * @param {object} env process environment
 * @param {object|null} settings parsed settings.local.json, or null
 * @returns {string} lowercase language code
 */
export function pickLang(env = process.env, settings = null) {
  const fromEnv = (env.PIPELINE_LANG || '').trim().toLowerCase();
  if (fromEnv) return fromEnv;
  const fromSettings = (settings?.env?.PIPELINE_LANG || '').trim().toLowerCase();
  return fromSettings || DEFAULT_LANG;
}

/**
 * The personal `.claude/settings.local.json`, the second source of PIPELINE_LANG.
 * @param {string} root repo root
 * @returns {object|null} parsed settings, or null when missing or unparsable
 */
export function readLocalSettings(root = repoRoot()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * `key=value` lines of a .properties text; blank lines and `#` comments are skipped.
 * @param {string} text file content
 * @returns {Record<string, string>} texts by key
 */
export function parseProperties(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * Base bundle overlaid with pipeline_<lang>.properties when it exists.
 * @param {string} lang language code
 * @param {string} root repo root
 * @returns {Record<string, string>} texts by key
 */
export function loadBundle(lang = DEFAULT_LANG, root = repoRoot()) {
  const dir = path.join(root, 'scripts', 'i18n');
  const base = parseProperties(fs.readFileSync(path.join(dir, 'pipeline.properties'), 'utf8'));
  const file = path.join(dir, `pipeline_${lang}.properties`);
  if (lang !== DEFAULT_LANG && exists(file))
    return { ...base, ...parseProperties(fs.readFileSync(file, 'utf8')) };
  return base;
}

/**
 * The text of a key with `{0}`, `{1}`, ... replaced by the arguments; the key itself when missing.
 * @param {Record<string, string>} bundle from `loadBundle`
 * @param {string} key text key
 * @param {...unknown} args placeholder values
 * @returns {string} the text
 */
export function t(bundle, key, ...args) {
  const text = bundle[key] ?? key;
  return text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}
