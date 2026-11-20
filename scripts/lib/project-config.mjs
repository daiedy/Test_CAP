/**
 * Project configuration of the pipeline (ADR-0033): the values a pipeline file needs and cannot
 * read from the project itself. They live in `.claude/pipeline.json` of the project, never in a
 * script, a prompt or a rule, so the same pipeline files serve another project unchanged. Names
 * the project already states (services, applications, paths) are not configuration: they are in
 * docs/registry, generated from the model and the manifests.
 *
 * Shape of the file, every key optional:
 *   { "wiki": { "areas": ["ORDERS", "BILLING"] } }
 * `root` is the project root the caller works on, never this script's own location.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WIKI_BUILTIN_AREAS } from './doc-shapes.mjs';

/** The configuration file, relative to the project root. */
export const CONFIG_FILE = '.claude/pipeline.json';
/** An area of a rule id `BR-<AREA>-NNN`: one upper-case word. */
const AREA = /^[A-Z][A-Z0-9]*$/;

/**
 * The name a project gives itself: `name` of its package.json, else the name of its folder.
 * @param {string} root project root
 * @returns {string} the name
 */
export function projectName(root) {
  try {
    const { name } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (typeof name === 'string' && name.trim()) return name.trim();
  } catch {
    // no package.json, or not JSON: the folder name answers
  }
  return path.basename(path.resolve(root));
}

/**
 * The parsed configuration of a project; `{}` when the project has no file.
 * @param {string} root project root
 * @returns {object} the configuration
 * @throws {Error} when the file is not a JSON object, with the file named
 */
export function projectConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  let config;
  try {
    config = JSON.parse(text);
  } catch (e) {
    throw new Error(`${CONFIG_FILE}: not valid JSON (${e.message})`, { cause: e });
  }
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new Error(`${CONFIG_FILE}: must hold a JSON object`);
  return config;
}

/**
 * What is wrong with the configuration of a project, for a check that reports instead of throwing.
 * @param {string} root project root
 * @returns {string[]} findings; empty for a missing or a valid file
 */
export function projectConfigErrors(root) {
  let config;
  try {
    config = projectConfig(root);
  } catch (e) {
    return [e.message];
  }
  const errors = [];
  const areas = config.wiki?.areas;
  if (areas !== undefined && !Array.isArray(areas))
    errors.push(`${CONFIG_FILE}: wiki.areas must be a list of words`);
  for (const a of Array.isArray(areas) ? areas : [])
    if (typeof a !== 'string' || !AREA.test(a))
      errors.push(
        `${CONFIG_FILE}: wiki.areas entry ${JSON.stringify(a)} must be one upper-case word`
      );
  return errors;
}

/**
 * The areas a rule id of the project may carry: the built-in ones, then `wiki.areas` of the
 * configuration in its order. An entry that is no upper-case word is left out here and reported by
 * projectConfigErrors(); a broken file leaves the built-in areas, so a hook never fails on it.
 * @param {string} root project root
 * @returns {string[]} area words, unique
 */
export function wikiRuleAreas(root) {
  let configured = [];
  try {
    const areas = projectConfig(root).wiki?.areas;
    if (Array.isArray(areas))
      configured = areas.filter((a) => typeof a === 'string' && AREA.test(a));
  } catch {
    // reported by projectConfigErrors()
  }
  return [...new Set([...WIKI_BUILTIN_AREAS, ...configured])];
}
