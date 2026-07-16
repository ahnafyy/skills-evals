'use strict';

/**
 * Configuration loading. Reads skills-evals.config.json at the root when
 * present and merges it over defaults.
 */

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  casesDir: 'evals/cases',
  fixturesDir: 'evals/fixtures',
  resultsDir: '.skills-evals/results',
  baselineFile: '.skills-evals/baseline.json',
  topK: 3,
  collisionWarn: 0.5,
  collisionError: 0.75,
  minPositive: 3,
  minNegative: 2,
  minEvals: 1,
  // Kinds that get a coverage warning when no eval case file exists.
  coverageKinds: ['skill', 'copilot-agent', 'claude-agent', 'cursor-rule'],
  exclude: [],
  behavioral: {
    adapter: 'claude',
    grader: null, // defaults to the executor adapter
    tools: 'Read,Glob,Grep,Edit,Write,Bash',
    executorTimeoutMs: 15 * 60 * 1000,
    graderTimeoutMs: 5 * 60 * 1000,
  },
};

function loadConfig(root, overrides = {}) {
  let fileConfig = {};
  const file = path.join(root, 'skills-evals.config.json');
  if (fs.existsSync(file)) {
    fileConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    ...overrides,
    behavioral: {
      ...DEFAULTS.behavioral,
      ...(fileConfig.behavioral || {}),
      ...(overrides.behavioral || {}),
    },
    root,
  };
  merged.casesDir = path.resolve(root, merged.casesDir);
  merged.fixturesDir = path.resolve(root, merged.fixturesDir);
  merged.resultsDir = path.resolve(root, merged.resultsDir);
  merged.baselineFile = path.resolve(root, merged.baselineFile);
  return merged;
}

module.exports = { DEFAULTS, loadConfig };
