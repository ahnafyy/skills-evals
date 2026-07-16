'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { discover, classify } = require('../src/discover');

const ROOT = path.join(__dirname, 'fixtures', 'sample-repo');

test('classify covers every .github convention', () => {
  // skills (GitHub Copilot + Claude + bare layout)
  assert.equal(classify('.github/skills/changelog/SKILL.md'), 'skill');
  assert.equal(classify('.claude/skills/changelog/SKILL.md'), 'skill');
  assert.equal(classify('skills/changelog/SKILL.md'), 'skill');
  // instructions
  assert.equal(classify('.github/copilot-instructions.md'), 'instructions');
  assert.equal(classify('.github/instructions/ts.instructions.md'), 'instructions');
  assert.equal(classify('AGENTS.md'), 'instructions');
  assert.equal(classify('packages/api/AGENTS.md'), 'instructions');
  // custom agents: VS Code (*.agent.md) and Copilot coding agent (.github/agents/*.md)
  assert.equal(classify('.github/agents/reviewer.agent.md'), 'copilot-agent');
  assert.equal(classify('.github/agents/reviewer.md'), 'copilot-agent');
  assert.equal(classify('.github/agents/README.md'), null);
  assert.equal(classify('.claude/agents/tester.md'), 'claude-agent');
  // prompts + cursor
  assert.equal(classify('.github/prompts/release.prompt.md'), 'prompt');
  assert.equal(classify('.cursor/rules/api.mdc'), 'cursor-rule');
  // non-artifacts
  assert.equal(classify('README.md'), null);
  assert.equal(classify('docs/how-it-works.md'), null);
});

test('discovers every artifact format in the sample repo', () => {
  const artifacts = discover(ROOT);
  const keys = artifacts.map((a) => a.key);
  assert.ok(keys.includes('skill:test-driven-development'));
  assert.ok(keys.includes('skill:commit-messages'));
  assert.ok(keys.includes('instructions:typescript'));
  assert.ok(keys.includes('instructions:copilot-instructions'));
  assert.ok(keys.includes('instructions:AGENTS'));
  assert.ok(keys.includes('copilot-agent:code-reviewer'));
  assert.ok(keys.includes('copilot-agent:docs-writer'));
  assert.ok(keys.includes('claude-agent:test-writer'));
  assert.ok(keys.includes('cursor-rule:api-conventions'));
  assert.ok(keys.includes('prompt:release-notes'));
  assert.equal(artifacts.length, 10);
});

test('routing modes are classified correctly', () => {
  const byKey = new Map(discover(ROOT).map((a) => [a.key, a]));
  assert.equal(byKey.get('skill:test-driven-development').routing.mode, 'description');
  assert.equal(byKey.get('instructions:typescript').routing.mode, 'glob');
  assert.deepEqual(byKey.get('instructions:typescript').routing.globs, ['**/*.ts', '**/*.tsx']);
  assert.equal(byKey.get('instructions:copilot-instructions').routing.mode, 'always');
  assert.equal(byKey.get('cursor-rule:api-conventions').routing.mode, 'glob');
  assert.equal(byKey.get('prompt:release-notes').routing.mode, 'manual');
  assert.equal(byKey.get('claude-agent:test-writer').routing.mode, 'description');
});

test('exclude globs filter artifacts out', () => {
  const artifacts = discover(ROOT, { exclude: ['skills/**'] });
  assert.ok(!artifacts.some((a) => a.kind === 'skill'));
});

test('walks the native skills folders, including .agents/skills/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-evals-walk-'));
  try {
    const locations = {
      '.claude/skills/a/SKILL.md': '---\nname: a\ndescription: alpha skill\n---\nbody',
      '.github/skills/b/SKILL.md': '---\nname: b\ndescription: bravo skill\n---\nbody',
      '.agents/skills/c/SKILL.md': '---\nname: c\ndescription: charlie skill\n---\nbody',
    };
    for (const [rel, content] of Object.entries(locations)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    const keys = discover(dir).map((art) => art.key).sort();
    assert.deepEqual(keys, ['skill:a', 'skill:b', 'skill:c']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
