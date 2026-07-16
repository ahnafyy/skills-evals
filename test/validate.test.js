'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../src/parsers');
const { validateCatalog } = require('../src/validate');

function skill(content, dir = '/repo/skills/my-skill/SKILL.md') {
  return parse('skill', content, dir, dir.replace('/repo/', ''));
}

function findingsFor(artifact) {
  const { perArtifact } = validateCatalog([artifact]);
  return perArtifact.get(artifact.key);
}

function codes(findings) {
  return findings.map((f) => f.code);
}

test('valid skill produces no findings', () => {
  const a = skill('---\nname: my-skill\ndescription: Does the thing. Use when the thing is needed.\n---\n\nBody\n');
  assert.deepEqual(findingsFor(a), []);
});

test('skill without frontmatter errors', () => {
  const a = skill('# no frontmatter\n');
  assert.ok(codes(findingsFor(a)).includes('skill/no-frontmatter'));
});

test('skill name/directory mismatch errors', () => {
  const a = skill('---\nname: other-name\ndescription: X. Use when Y.\n---\nBody\n');
  assert.ok(codes(findingsFor(a)).includes('skill/name-mismatch'));
});

test('skill missing description errors', () => {
  const a = skill('---\nname: my-skill\n---\nBody\n');
  assert.ok(codes(findingsFor(a)).includes('skill/no-description'));
});

test('skill over-long description errors', () => {
  const desc = `Use when ${'x'.repeat(1100)}`;
  const a = skill(`---\nname: my-skill\ndescription: ${desc}\n---\nBody\n`);
  assert.ok(codes(findingsFor(a)).includes('skill/description-too-long'));
});

test('skill without trigger phrase warns', () => {
  const a = skill('---\nname: my-skill\ndescription: Does a thing.\n---\nBody\n');
  const f = findingsFor(a).find((x) => x.code === 'skill/no-trigger-phrase');
  assert.equal(f.level, 'warn');
});

test('claude agent missing description errors', () => {
  const a = parse('claude-agent', '---\nname: my-agent\n---\nPrompt\n', '/r/.claude/agents/my-agent.md', '.claude/agents/my-agent.md');
  assert.ok(codes(findingsFor(a)).includes('claude-agent/no-description'));
});

test('instructions without applyTo warns', () => {
  const a = parse('instructions', 'Some rules\n', '/r/.github/instructions/general.instructions.md', '.github/instructions/general.instructions.md');
  assert.ok(codes(findingsFor(a)).includes('instructions/no-apply-to'));
});

test('cursor rule with no routing warns manual-only', () => {
  const a = parse('cursor-rule', '---\nalwaysApply: false\n---\nRule\n', '/r/.cursor/rules/x.mdc', '.cursor/rules/x.mdc');
  assert.ok(codes(findingsFor(a)).includes('cursor-rule/manual-only'));
});

test('duplicate names in the same kind error at catalog level', () => {
  const a = skill('---\nname: my-skill\ndescription: A. Use when A.\n---\nBody\n');
  const b = skill('---\nname: my-skill\ndescription: B. Use when B.\n---\nBody\n');
  const { catalog } = validateCatalog([a, b]);
  assert.ok(catalog.some((f) => f.code === 'catalog/duplicate'));
});
