'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { discover } = require('../src/discover');
const { loadCases } = require('../src/cases');
const { loadConfig } = require('../src/config');
const { runTriggerEvals } = require('../src/trigger/engine');

const ROOT = path.join(__dirname, 'fixtures', 'sample-repo');

function run() {
  const config = loadConfig(ROOT);
  const artifacts = discover(ROOT);
  const cases = loadCases(config.casesDir);
  return runTriggerEvals({ artifacts, cases, config });
}

test('sample repo passes tier 2 with zero errors', () => {
  const result = run();
  const errors = result.findings.filter((f) => f.level === 'error');
  assert.deepEqual(errors, []);
});

test('positive prompts rank their artifact and count rank-1s', () => {
  const result = run();
  assert.equal(result.stats.positives, 6);
  assert.ok(result.stats.rank1 >= 4, `expected most positives to rank #1, got ${result.stats.rank1}`);
});

test('path triggers evaluate against routing globs', () => {
  const result = run();
  const tsTriggers = result.triggers.filter((t) => t.artifactKey === 'instructions:typescript');
  assert.equal(tsTriggers.length, 4);
  assert.ok(tsTriggers.every((t) => t.passed));
});

test('coverage warnings for rankable artifacts without case files', () => {
  const result = run();
  const coverage = result.findings.filter((f) => f.code === 'coverage/no-case-file');
  const covered = coverage.map((f) => f.artifact);
  assert.ok(covered.includes('copilot-agent:code-reviewer'));
  assert.ok(covered.includes('claude-agent:test-writer'));
  assert.ok(covered.includes('cursor-rule:api-conventions'));
});

test('vocabulary theft by another artifact produces trigger errors', () => {
  const config = loadConfig(ROOT);
  const artifacts = discover(ROOT);
  // Sabotage both sides: commit-messages steals TDD's vocabulary while TDD's
  // own description loses it — TDD's positive prompts must now fail.
  const sabotaged = artifacts.map((a) => {
    if (a.key === 'skill:commit-messages') {
      return { ...a, description: 'Write failing tests before fixing bugs. Use when fixing a bug, writing a failing test, or adding test coverage.' };
    }
    if (a.key === 'skill:test-driven-development') {
      return { ...a, description: 'Manages database migrations. Use when migrating schemas.' };
    }
    return a;
  });
  const cases = loadCases(config.casesDir);
  const result = runTriggerEvals({ artifacts: sabotaged, cases, config });
  const errors = result.findings.filter((f) => f.level === 'error');
  assert.ok(errors.length > 0, 'sabotaged catalog should produce trigger errors');
});

test('collisions are reported for near-duplicate descriptions', () => {
  const config = loadConfig(ROOT);
  const artifacts = [
    { key: 'skill:a', kind: 'skill', name: 'a', description: 'Review pull requests for style and security issues. Use when reviewing code.', routing: { mode: 'description' }, body: '', relPath: 'a', meta: {}, hasFrontmatter: true },
    { key: 'skill:b', kind: 'skill', name: 'b', description: 'Review pull requests for style and security issues. Use when reviewing code.', routing: { mode: 'description' }, body: '', relPath: 'b', meta: {}, hasFrontmatter: true },
  ];
  const result = runTriggerEvals({ artifacts, cases: [], config });
  assert.ok(result.collisions.some((c) => c.level === 'error'));
});

test('pools are independent: same-vocabulary artifacts in different kinds do not collide', () => {
  const config = loadConfig(ROOT);
  const artifacts = [
    { key: 'skill:a', kind: 'skill', name: 'a', description: 'Review pull requests. Use when reviewing code.', routing: { mode: 'description' }, body: '', relPath: 'a', meta: {}, hasFrontmatter: true },
    { key: 'claude-agent:b', kind: 'claude-agent', name: 'b', description: 'Review pull requests. Use when reviewing code.', routing: { mode: 'description' }, body: '', relPath: 'b', meta: {}, hasFrontmatter: true },
  ];
  const result = runTriggerEvals({ artifacts, cases: [], config });
  assert.deepEqual(result.collisions, []);
});
