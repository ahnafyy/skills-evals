'use strict';

/**
 * skills-evals — programmatic API.
 *
 *   const { discover, validateCatalog, runTriggerEvals, loadConfig } = require('skills-evals');
 *   const config = loadConfig(root);
 *   const artifacts = discover(root, { exclude: config.exclude });
 *   const tier1 = validateCatalog(artifacts);
 *   const tier2 = runTriggerEvals({ artifacts, cases: loadCases(config.casesDir), config });
 */

const { discover, classify } = require('./discover');
const { parse, KINDS, KIND_LABELS } = require('./parsers');
const { parseFrontmatter } = require('./parsers/frontmatter');
const { matchGlob, globToRegExp, normalizeGlobs } = require('./glob');
const { validateCatalog } = require('./validate');
const { loadCases, validateCaseShape, resolveArtifact } = require('./cases');
const { runTriggerEvals } = require('./trigger/engine');
const text = require('./trigger/text');
const { buildBaseline, loadBaseline, saveBaseline, diffBaseline, artifactHash } = require('./baseline');
const { runBehavioral } = require('./behavioral/runner');
const { getAdapter, registerAdapter, adapters } = require('./behavioral/adapters');
const { buildGraderPrompt, parseGrading } = require('./behavioral/grader');
const { materializeWorkspace } = require('./behavioral/workspace');
const { loadConfig, DEFAULTS } = require('./config');
const { printFindings, countLevels, summaryLine } = require('./report');

module.exports = {
  // discovery + parsing
  discover,
  classify,
  parse,
  parseFrontmatter,
  KINDS,
  KIND_LABELS,
  // globs
  matchGlob,
  globToRegExp,
  normalizeGlobs,
  // tier 1
  validateCatalog,
  // tier 2
  loadCases,
  validateCaseShape,
  resolveArtifact,
  runTriggerEvals,
  text,
  // baseline / regression
  buildBaseline,
  loadBaseline,
  saveBaseline,
  diffBaseline,
  artifactHash,
  // tier 3
  runBehavioral,
  getAdapter,
  registerAdapter,
  adapters,
  buildGraderPrompt,
  parseGrading,
  materializeWorkspace,
  // config + reporting
  loadConfig,
  DEFAULTS,
  printFindings,
  countLevels,
  summaryLine,
};
