'use strict';

/**
 * Repo walker + artifact classifier. Finds every supported agent artifact
 * and parses it into the normalized catalog shape.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('./parsers');
const { matchGlob } = require('./glob');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out',
  'coverage', '.next', '.venv', 'vendor', '.skills-evals',
]);

/** Classify a repo-relative ('/'-separated) path into an artifact kind, or null. */
function classify(relPath) {
  const p = relPath;
  const base = p.split('/').pop();
  if (base === 'SKILL.md') return 'skill';
  if (base === 'copilot-instructions.md') return 'instructions';
  if (base.endsWith('.instructions.md')) return 'instructions';
  if (base === 'AGENTS.md') return 'instructions';
  if (base.endsWith('.agent.md')) return 'copilot-agent';
  if (base.endsWith('.prompt.md')) return 'prompt';
  // Copilot coding agent convention: plain .md files in .github/agents/
  if (/(^|\/)\.github\/agents\/[^/]+\.md$/.test(p) && base !== 'README.md') return 'copilot-agent';
  if (/(^|\/)\.claude\/agents\/[^/]+\.md$/.test(p)) return 'claude-agent';
  if (/(^|\/)\.cursor\/rules\/.+\.mdc$/.test(p)) return 'cursor-rule';
  return null;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && !['.github', '.claude', '.cursor'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

/**
 * Discover all agent artifacts under root.
 * @param {string} root
 * @param {{ exclude?: string[] }} [options]
 * @returns {Array} sorted artifact catalog
 */
function discover(root, options = {}) {
  const exclude = options.exclude || [];
  const artifacts = [];
  for (const file of walk(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const kind = classify(rel);
    if (!kind) continue;
    if (exclude.length && matchGlob(exclude, rel)) continue;
    const content = fs.readFileSync(file, 'utf8');
    artifacts.push(parse(kind, content, file, rel));
  }
  artifacts.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return artifacts;
}

module.exports = { discover, classify, walk };
