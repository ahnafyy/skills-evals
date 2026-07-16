'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main } = require('../src/cli');

const ROOT = path.join(__dirname, 'fixtures', 'sample-repo');

function capture(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const code = fn();
    return { code, out: logs.join('\n') };
  } finally {
    console.log = orig;
  }
}

test('list finds all fixture artifacts', () => {
  const { code, out } = capture(() => main(['list', '--root', ROOT]));
  assert.equal(code, 0);
  assert.match(out, /10 artifact\(s\)/);
});

test('validate passes on the sample repo', () => {
  const { code, out } = capture(() => main(['validate', '--root', ROOT]));
  assert.equal(code, 0);
  assert.match(out, /0 error\(s\)/);
});

test('run passes tier 1+2 on the sample repo', () => {
  const { code, out } = capture(() => main(['run', '--root', ROOT]));
  assert.equal(code, 0);
  assert.match(out, /PASSED/);
  assert.match(out, /trigger rank-1 rate/);
});

test('run --json emits machine-readable output', () => {
  const { code, out } = capture(() => main(['run', '--root', ROOT, '--json']));
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.errors, 0);
  assert.ok(Array.isArray(parsed.findings));
});

test('baseline round-trip: update, then clean re-run, then regression', () => {
  // Copy the fixture repo to a tmp dir so baseline writes do not pollute it.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-evals-test-'));
  fs.cpSync(ROOT, tmp, { recursive: true });

  let r = capture(() => main(['run', '--root', tmp, '--update-baseline']));
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(tmp, '.skills-evals', 'baseline.json')));

  r = capture(() => main(['run', '--root', tmp]));
  assert.equal(r.code, 0);

  // Sabotage both sides: TDD loses its vocabulary while commit-messages
  // steals it — TDD's positive prompts now fail and the baseline flags
  // regressions.
  fs.writeFileSync(
    path.join(tmp, 'skills', 'test-driven-development', 'SKILL.md'),
    '---\nname: test-driven-development\ndescription: Manages database migrations. Use when migrating schemas.\n---\n\nBody\n',
  );
  fs.writeFileSync(
    path.join(tmp, 'skills', 'commit-messages', 'SKILL.md'),
    '---\nname: commit-messages\ndescription: Write failing tests before fixing bugs. Use when fixing a bug, writing a failing test, or adding test coverage.\n---\n\nBody\n',
  );
  r = capture(() => main(['run', '--root', tmp]));
  assert.equal(r.code, 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('init scaffolds case stubs for uncovered artifacts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-evals-test-'));
  fs.cpSync(ROOT, tmp, { recursive: true });

  const { code, out } = capture(() => main(['init', '--root', tmp]));
  assert.equal(code, 0);
  assert.match(out, /4 case stub\(s\) created/);
  assert.ok(fs.existsSync(path.join(tmp, 'evals', 'cases', 'code-reviewer.json')));
  assert.ok(fs.existsSync(path.join(tmp, 'evals', 'cases', 'docs-writer.json')));
  assert.ok(fs.existsSync(path.join(tmp, 'evals', 'cases', 'test-writer.json')));
  assert.ok(fs.existsSync(path.join(tmp, 'evals', 'cases', 'api-conventions.json')));

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('behavioral --dry-run prints the plan without executing', () => {
  const { code, out } = capture(() => main(['behavioral', 'test-driven-development', '--root', ROOT, '--dry-run']));
  assert.equal(code, 0);
  assert.match(out, /\[dry-run\] eval 1/);
  assert.match(out, /executor=claude/);
});

test('unknown command exits 1', () => {
  const { code } = capture(() => main(['bogus']));
  assert.equal(code, 1);
});
