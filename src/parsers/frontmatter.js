'use strict';

/**
 * Minimal YAML-ish frontmatter parser.
 *
 * Supports the subset of YAML actually used by agent artifacts: scalar
 * values, quoted strings, booleans, inline arrays ([a, b]), and simple
 * block lists. Deliberately not a general YAML parser — zero dependencies.
 */

function unquote(v) {
  return v.replace(/^['"]|['"]$/g, '');
}

/**
 * Parse frontmatter from the top of a markdown file.
 * @param {string} content
 * @returns {{ data: object|null, body: string }} data is null when no
 *   frontmatter block is present; body is the content after the block.
 */
function parseFrontmatter(content) {
  const m = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { data: null, body: content };

  const data = {};
  let currentKey = null;

  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Block list item under the current key: "  - value"
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(listItem[1].trim()));
      continue;
    }

    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key || /\s/.test(key)) continue;
    let value = line.slice(idx + 1).trim();
    currentKey = key;

    if (value === '') {
      data[key] = ''; // may be filled in by a following block list
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => unquote(v.trim()))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      data[key] = value === 'true';
    } else {
      data[key] = unquote(value);
    }
  }

  return { data, body: content.slice(m[0].length) };
}

module.exports = { parseFrontmatter };
