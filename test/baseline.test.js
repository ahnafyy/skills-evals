'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBaseline, diffBaseline, artifactHash } = require('../src/baseline');

const artifact = (key, desc) => ({
  key,
  kind: key.split(':')[0],
  description: desc,
  body: 'body',
});

function baselineFor(artifacts, triggers, collisions = [], rank1Rate = 1) {
  return buildBaseline({
    artifacts,
    triggerResult: { triggers, collisions, stats: { rank1Rate } },
  });
}

const T = (artifactKey, id, passed, type = 'positive') => ({ artifactKey, id, type, text: `prompt-${id}`, rank: passed ? 1 : null, passed });

test('regression on an UNCHANGED artifact is an error (catalog drift)', () => {
  const a = artifact('skill:x', 'same description');
  const prev = baselineFor([a], [T('skill:x', 'aaa', true)]);
  const cur = baselineFor([a], [T('skill:x', 'aaa', false)]);
  const { findings } = diffBaseline(prev, cur);
  const reg = findings.find((f) => f.code === 'baseline/regression');
  assert.equal(reg.level, 'error');
});

test('regression on a CHANGED artifact is a warning (expected churn)', () => {
  const prev = baselineFor([artifact('skill:x', 'old description')], [T('skill:x', 'aaa', true)]);
  const cur = baselineFor([artifact('skill:x', 'new description')], [T('skill:x', 'aaa', false)]);
  const { findings } = diffBaseline(prev, cur);
  const reg = findings.find((f) => f.code === 'baseline/regression-after-change');
  assert.equal(reg.level, 'warn');
  assert.ok(!findings.some((f) => f.code === 'baseline/regression'));
});

test('new collision since baseline is an error', () => {
  const a = artifact('skill:x', 'd');
  const prev = baselineFor([a], []);
  const cur = baselineFor([a], [], [{ a: 'skill:x', b: 'skill:y', sim: 0.9, level: 'error' }]);
  const { findings } = diffBaseline(prev, cur);
  assert.ok(findings.some((f) => f.code === 'baseline/new-collision' && f.level === 'error'));
});

test('rank-1 rate drop warns', () => {
  const a = artifact('skill:x', 'd');
  const prev = baselineFor([a], [], [], 0.9);
  const cur = baselineFor([a], [], [], 0.5);
  const { findings } = diffBaseline(prev, cur);
  assert.ok(findings.some((f) => f.code === 'baseline/rank1-drop' && f.level === 'warn'));
});

test('newly passing triggers are reported as improvements', () => {
  const a = artifact('skill:x', 'd');
  const prev = baselineFor([a], [T('skill:x', 'aaa', false)]);
  const cur = baselineFor([a], [T('skill:x', 'aaa', true)]);
  const { improvements } = diffBaseline(prev, cur);
  assert.equal(improvements.length, 1);
});

test('removed artifacts and triggers warn, never crash', () => {
  const prev = baselineFor([artifact('skill:gone', 'd')], [T('skill:gone', 'aaa', true)]);
  const cur = baselineFor([artifact('skill:other', 'd')], []);
  const { findings } = diffBaseline(prev, cur);
  assert.ok(findings.some((f) => f.code === 'baseline/artifact-removed'));
});

test('no baseline means no findings', () => {
  const cur = baselineFor([artifact('skill:x', 'd')], []);
  const { findings, improvements } = diffBaseline(null, cur);
  assert.deepEqual(findings, []);
  assert.deepEqual(improvements, []);
});

test('artifactHash changes when description changes', () => {
  assert.notEqual(artifactHash(artifact('skill:x', 'a')), artifactHash(artifact('skill:x', 'b')));
});
