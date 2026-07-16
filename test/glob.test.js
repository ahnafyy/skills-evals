'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { matchGlob, invalidGlobs } = require('../src/glob');

test('** matches across directories', () => {
  assert.ok(matchGlob('**/*.ts', 'src/app/index.ts'));
  assert.ok(matchGlob('**/*.ts', 'index.ts'));
  assert.ok(!matchGlob('**/*.ts', 'README.md'));
});

test('comma-separated pattern lists', () => {
  assert.ok(matchGlob('**/*.ts,**/*.tsx', 'src/Button.tsx'));
  assert.ok(!matchGlob('**/*.ts,**/*.tsx', 'src/Button.jsx'));
});

test('trailing ** matches everything under a dir', () => {
  assert.ok(matchGlob('src/api/**', 'src/api/users/handler.js'));
  assert.ok(!matchGlob('src/api/**', 'src/web/index.js'));
});

test('bare ** matches everything', () => {
  assert.ok(matchGlob('**', 'a/b/c.txt'));
});

test('pattern without slash matches basename anywhere', () => {
  assert.ok(matchGlob('*.md', 'docs/deep/nested/file.md'));
});

test('brace alternation', () => {
  assert.ok(matchGlob('**/*.{js,ts}', 'src/x.ts'));
  assert.ok(matchGlob('**/*.{js,ts}', 'src/x.js'));
  assert.ok(!matchGlob('**/*.{js,ts}', 'src/x.py'));
});

test('array specs', () => {
  assert.ok(matchGlob(['src/api/**', 'src/server/**'], 'src/server/app.js'));
});

test('invalidGlobs returns empty for valid patterns', () => {
  assert.deepEqual(invalidGlobs('**/*.ts,src/**'), []);
});
