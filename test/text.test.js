'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stem, tokenize, buildCorpus, rank } = require('../src/trigger/text');

test('stem clusters related word forms', () => {
  assert.equal(stem('conflicts'), stem('conflict'));
  assert.equal(stem('branching'), stem('branch'));
  assert.equal(stem('committing'), stem('commit'));
});

test('tokenize drops stopwords and short tokens', () => {
  const tokens = tokenize('Use this when you need to fix a bug');
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('use'));
  assert.ok(tokens.includes(stem('fix')));
  assert.ok(tokens.includes(stem('bug')));
});

test('rank puts the matching artifact first', () => {
  const artifacts = [
    { key: 'skill:tdd', name: 'test-driven-development', description: 'Write a failing test before implementing any fix. Use when fixing bugs.' },
    { key: 'skill:commits', name: 'commit-messages', description: 'Draft clear conventional commit messages. Use when committing changes.' },
  ];
  const corpus = buildCorpus(artifacts);
  const ranking = rank('Write a failing test for this bug before fixing it', corpus);
  assert.equal(ranking[0].key, 'skill:tdd');
  assert.ok(ranking[0].score > 0);
});

test('rank scores zero for unrelated vocabulary', () => {
  const artifacts = [
    { key: 'skill:tdd', name: 'test-driven-development', description: 'Write a failing test before any fix.' },
  ];
  const corpus = buildCorpus(artifacts);
  const ranking = rank('quantum blockchain synergy', corpus);
  assert.equal(ranking[0].score, 0);
});
