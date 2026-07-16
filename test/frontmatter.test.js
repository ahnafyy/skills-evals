'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFrontmatter } = require('../src/parsers/frontmatter');

test('parses scalar frontmatter and body', () => {
  const { data, body } = parseFrontmatter('---\nname: foo\ndescription: "does a thing"\n---\n\n# Body\n');
  assert.equal(data.name, 'foo');
  assert.equal(data.description, 'does a thing');
  assert.equal(body.trim(), '# Body');
});

test('returns null data when no frontmatter', () => {
  const { data, body } = parseFrontmatter('# Just markdown\n');
  assert.equal(data, null);
  assert.equal(body, '# Just markdown\n');
});

test('parses inline arrays and booleans', () => {
  const { data } = parseFrontmatter("---\ntools: ['search', 'fetch']\nalwaysApply: false\n---\nx\n");
  assert.deepEqual(data.tools, ['search', 'fetch']);
  assert.equal(data.alwaysApply, false);
});

test('parses block lists', () => {
  const { data } = parseFrontmatter('---\nglobs:\n  - src/api/**\n  - src/server/**\n---\nx\n');
  assert.deepEqual(data.globs, ['src/api/**', 'src/server/**']);
});

test('handles crlf line endings', () => {
  const { data } = parseFrontmatter('---\r\nname: foo\r\n---\r\nbody');
  assert.equal(data.name, 'foo');
});
