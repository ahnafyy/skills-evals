'use strict';

/**
 * Tiny glob matcher for routing globs (`applyTo`, Cursor rule `globs`).
 * Supports **, *, ?, {a,b} alternation, [...] character classes, and
 * comma-separated pattern lists. Paths are always matched with `/` separators.
 */

function escapeRe(c) {
  return /[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}

/** Convert a single glob pattern to a RegExp. */
function globToRegExp(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]*/)*';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        re += escapeRe(c);
        i += 1;
      } else {
        const parts = glob
          .slice(i + 1, end)
          .split(',')
          .map((p) => p.trim().split('').map(escapeRe).join(''));
        re += `(?:${parts.join('|')})`;
        i = end + 1;
      }
    } else if (c === '[') {
      const end = glob.indexOf(']', i);
      if (end === -1) {
        re += escapeRe(c);
        i += 1;
      } else {
        re += glob.slice(i, end + 1);
        i = end + 1;
      }
    } else {
      re += escapeRe(c);
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Split a comma-separated pattern list, ignoring commas inside {a,b} braces. */
function splitPatternList(s) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/** Normalize a glob spec (string with commas, or array) into a pattern list. */
function normalizeGlobs(spec) {
  const list = Array.isArray(spec) ? spec : splitPatternList(String(spec || ''));
  return list.map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Test whether a file path matches any pattern in a glob spec.
 * Patterns without a slash match the basename anywhere in the tree
 * (the convention used by `applyTo` and Cursor rule globs).
 */
function matchGlob(spec, filePath) {
  const p = String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
  return normalizeGlobs(spec).some((g) => {
    let gg = g.replace(/^\.\//, '');
    if (!gg.includes('/')) gg = `**/${gg}`;
    return globToRegExp(gg).test(p);
  });
}

/** Validate that every pattern in a spec compiles. Returns bad patterns. */
function invalidGlobs(spec) {
  const bad = [];
  for (const g of normalizeGlobs(spec)) {
    try {
      globToRegExp(g);
    } catch {
      bad.push(g);
    }
  }
  return bad;
}

module.exports = { globToRegExp, normalizeGlobs, matchGlob, invalidGlobs };
