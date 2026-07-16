'use strict';

/**
 * Per-format parsers that normalize every supported agent artifact into a
 * single shape so validation, trigger routing, and behavioral evals work
 * uniformly across formats.
 *
 * Normalized artifact:
 *   {
 *     kind:      'skill' | 'instructions' | 'copilot-agent' | 'claude-agent'
 *                | 'cursor-rule' | 'prompt',
 *     name:      string,           // identity within its kind
 *     key:       `${kind}:${name}`,// identity within the catalog
 *     description: string,         // the routing text agents choose by
 *     body:      string,           // markdown after frontmatter
 *     filePath:  string,           // absolute
 *     relPath:   string,           // repo-relative, '/'-separated
 *     routing:   { mode: 'description'|'glob'|'always'|'manual', globs?: string[] },
 *     meta:      object,           // raw frontmatter (or {})
 *     hasFrontmatter: boolean,
 *   }
 */

const path = require('path');
const { parseFrontmatter } = require('./frontmatter');
const { normalizeGlobs } = require('../glob');

const KINDS = ['skill', 'instructions', 'copilot-agent', 'claude-agent', 'cursor-rule', 'prompt'];

const KIND_LABELS = {
  skill: 'skill',
  instructions: 'instructions file',
  'copilot-agent': 'custom agent',
  'claude-agent': 'custom agent',
  'cursor-rule': 'rule',
  prompt: 'prompt file',
};

function makeArtifact(props) {
  const a = {
    description: '',
    meta: {},
    hasFrontmatter: false,
    ...props,
  };
  a.key = `${a.kind}:${a.name}`;
  return a;
}

function str(v) {
  return v === undefined || v === null ? '' : String(v);
}

function parseSkill(content, filePath, relPath) {
  const { data, body } = parseFrontmatter(content);
  const dirName = path.basename(path.dirname(filePath));
  return makeArtifact({
    kind: 'skill',
    name: data && data.name ? str(data.name).trim() : dirName,
    dirName,
    description: data ? str(data.description).trim() : '',
    body,
    filePath,
    relPath,
    routing: { mode: 'description' },
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

function parseInstructions(content, filePath, relPath) {
  const base = path.basename(filePath);
  const { data, body } = parseFrontmatter(content);

  if (base.endsWith('.instructions.md')) {
    const applyTo = data ? data.applyTo : undefined;
    const globs = applyTo !== undefined && applyTo !== '' ? normalizeGlobs(applyTo) : [];
    return makeArtifact({
      kind: 'instructions',
      name: base.replace(/\.instructions\.md$/, ''),
      description: data ? str(data.description).trim() : '',
      body,
      filePath,
      relPath,
      routing: globs.length ? { mode: 'glob', globs } : { mode: 'always' },
      meta: data || {},
      hasFrontmatter: !!data,
    });
  }

  // copilot-instructions.md or AGENTS.md — always-on instructions.
  let name;
  if (base === 'copilot-instructions.md') {
    name = 'copilot-instructions';
  } else {
    const dir = relPath.split('/').slice(0, -1).join('/');
    name = dir ? `${dir}/AGENTS` : 'AGENTS';
  }
  return makeArtifact({
    kind: 'instructions',
    name,
    description: data ? str(data.description).trim() : '',
    body,
    filePath,
    relPath,
    routing: { mode: 'always' },
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

function parseCopilotAgent(content, filePath, relPath) {
  const { data, body } = parseFrontmatter(content);
  // Both conventions: VS Code's <name>.agent.md and the Copilot coding
  // agent's .github/agents/<name>.md.
  const base = path.basename(filePath).replace(/\.agent\.md$/, '').replace(/\.md$/, '');
  return makeArtifact({
    kind: 'copilot-agent',
    name: data && data.name ? str(data.name).trim() : base,
    fileBase: base,
    description: data ? str(data.description).trim() : '',
    body,
    filePath,
    relPath,
    routing: { mode: 'description' },
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

function parseClaudeAgent(content, filePath, relPath) {
  const { data, body } = parseFrontmatter(content);
  const base = path.basename(filePath).replace(/\.md$/, '');
  return makeArtifact({
    kind: 'claude-agent',
    name: data && data.name ? str(data.name).trim() : base,
    fileBase: base,
    description: data ? str(data.description).trim() : '',
    body,
    filePath,
    relPath,
    routing: { mode: 'description' },
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

function parseCursorRule(content, filePath, relPath) {
  const { data, body } = parseFrontmatter(content);
  const name = path.basename(filePath).replace(/\.mdc$/, '');
  const description = data ? str(data.description).trim() : '';
  const globsRaw = data ? data.globs : undefined;
  const globs = globsRaw !== undefined && globsRaw !== '' ? normalizeGlobs(globsRaw) : [];
  const alwaysApply = data ? data.alwaysApply === true : false;

  let routing;
  if (alwaysApply) routing = { mode: 'always' };
  else if (globs.length) routing = { mode: 'glob', globs };
  else if (description) routing = { mode: 'description' };
  else routing = { mode: 'manual' };

  return makeArtifact({
    kind: 'cursor-rule',
    name,
    description,
    body,
    filePath,
    relPath,
    routing,
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

function parsePrompt(content, filePath, relPath) {
  const { data, body } = parseFrontmatter(content);
  const name = path.basename(filePath).replace(/\.prompt\.md$/, '');
  return makeArtifact({
    kind: 'prompt',
    name,
    description: data ? str(data.description).trim() : '',
    body,
    filePath,
    relPath,
    routing: { mode: 'manual' },
    meta: data || {},
    hasFrontmatter: !!data,
  });
}

const PARSERS = {
  skill: parseSkill,
  instructions: parseInstructions,
  'copilot-agent': parseCopilotAgent,
  'claude-agent': parseClaudeAgent,
  'cursor-rule': parseCursorRule,
  prompt: parsePrompt,
};

function parse(kind, content, filePath, relPath) {
  const fn = PARSERS[kind];
  if (!fn) throw new Error(`Unknown artifact kind: ${kind}`);
  return fn(content, filePath, relPath);
}

module.exports = { KINDS, KIND_LABELS, parse, PARSERS };
