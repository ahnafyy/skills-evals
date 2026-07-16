'use strict';

/**
 * Tier 1 — structural validation.
 *
 * Deterministic checks per artifact kind: frontmatter presence, required
 * fields, naming conventions, description length limits, "when to use"
 * trigger phrases, and glob validity. Errors block CI; warnings do not.
 */

const { invalidGlobs } = require('./glob');

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 1024;
// A skill description should state WHEN to use it, not just what it does.
const DESCRIPTION_TRIGGER = /\buse (this )?when\b|\buse (before|after|during)\b|\bwhen (to use|the user|you)\b/i;

function finding(level, code, message) {
  return { level, code, message };
}

function validateSkill(a) {
  const out = [];
  if (!a.hasFrontmatter) {
    out.push(finding('error', 'skill/no-frontmatter', 'Missing or malformed YAML frontmatter (expected --- block at top of SKILL.md)'));
    return out;
  }
  if (!a.meta.name) {
    out.push(finding('error', 'skill/no-name', "Frontmatter missing required field: 'name'"));
  } else if (a.dirName && a.meta.name !== a.dirName) {
    out.push(finding('error', 'skill/name-mismatch', `Frontmatter name '${a.meta.name}' does not match directory name '${a.dirName}'`));
  }
  if (a.dirName && !KEBAB_CASE.test(a.dirName)) {
    out.push(finding('error', 'skill/not-kebab', `Directory name '${a.dirName}' is not lowercase-hyphen-separated`));
  }
  if (!a.description) {
    out.push(finding('error', 'skill/no-description', "Frontmatter missing required field: 'description'"));
  } else {
    if (a.description.length > MAX_DESCRIPTION_LENGTH) {
      out.push(finding('error', 'skill/description-too-long',
        `Description is ${a.description.length} chars — exceeds the ${MAX_DESCRIPTION_LENGTH}-char limit (agents inject this into the system prompt)`));
    }
    if (!DESCRIPTION_TRIGGER.test(a.description)) {
      out.push(finding('warn', 'skill/no-trigger-phrase',
        'Description has no "when to use" trigger — add a "Use when …" clause so agents know when to route here'));
    }
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'skill/empty-body', 'SKILL.md has no content after frontmatter'));
  }
  return out;
}

function validateInstructions(a) {
  const out = [];
  if (a.relPath.endsWith('.instructions.md')) {
    if (a.routing.mode === 'always') {
      out.push(finding('warn', 'instructions/no-apply-to',
        "No 'applyTo' frontmatter — these instructions apply to every request. Add an applyTo glob to scope them."));
    } else {
      const bad = invalidGlobs(a.routing.globs);
      if (bad.length) {
        out.push(finding('error', 'instructions/bad-glob', `Invalid applyTo glob pattern(s): ${bad.join(', ')}`));
      }
    }
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'instructions/empty-body', 'Instructions file has no content'));
  }
  return out;
}

function validateCopilotAgent(a) {
  const out = [];
  if (!a.description) {
    out.push(finding('warn', 'copilot-agent/no-description',
      "No 'description' frontmatter — the description is shown in the agent picker and used for routing"));
  } else if (a.description.length > MAX_DESCRIPTION_LENGTH) {
    out.push(finding('error', 'copilot-agent/description-too-long',
      `Description is ${a.description.length} chars — exceeds the ${MAX_DESCRIPTION_LENGTH}-char limit`));
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'copilot-agent/empty-body', 'Agent file has no content after frontmatter'));
  }
  return out;
}

function validateClaudeAgent(a) {
  const out = [];
  if (!a.hasFrontmatter) {
    out.push(finding('error', 'claude-agent/no-frontmatter', 'Missing YAML frontmatter — Claude agents require name and description'));
    return out;
  }
  if (!a.meta.name) {
    out.push(finding('error', 'claude-agent/no-name', "Frontmatter missing required field: 'name'"));
  } else {
    if (!KEBAB_CASE.test(a.meta.name)) {
      out.push(finding('warn', 'claude-agent/not-kebab', `Agent name '${a.meta.name}' is not lowercase-hyphen-separated`));
    }
    if (a.fileBase && a.meta.name !== a.fileBase) {
      out.push(finding('warn', 'claude-agent/name-mismatch', `Frontmatter name '${a.meta.name}' does not match filename '${a.fileBase}.md'`));
    }
  }
  if (!a.description) {
    out.push(finding('error', 'claude-agent/no-description',
      "Frontmatter missing required field: 'description' — Claude uses it to decide when to delegate to this agent"));
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'claude-agent/empty-body', 'Agent file has no system prompt content after frontmatter'));
  }
  return out;
}

function validateCursorRule(a) {
  const out = [];
  if (a.routing.mode === 'manual') {
    out.push(finding('warn', 'cursor-rule/manual-only',
      'Rule has no description, globs, or alwaysApply — it can only be invoked manually with @ruleName'));
  }
  if (a.routing.mode === 'glob') {
    const bad = invalidGlobs(a.routing.globs);
    if (bad.length) {
      out.push(finding('error', 'cursor-rule/bad-glob', `Invalid glob pattern(s): ${bad.join(', ')}`));
    }
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'cursor-rule/empty-body', 'Rule file has no content after frontmatter'));
  }
  return out;
}

function validatePrompt(a) {
  const out = [];
  if (!a.description) {
    out.push(finding('warn', 'prompt/no-description', "No 'description' frontmatter — add one so users know what the prompt does"));
  }
  if (!a.body.trim()) {
    out.push(finding('warn', 'prompt/empty-body', 'Prompt file has no content after frontmatter'));
  }
  return out;
}

const VALIDATORS = {
  skill: validateSkill,
  instructions: validateInstructions,
  'copilot-agent': validateCopilotAgent,
  'claude-agent': validateClaudeAgent,
  'cursor-rule': validateCursorRule,
  prompt: validatePrompt,
};

/**
 * Validate a full artifact catalog.
 * @returns {{ perArtifact: Map<string, Array>, catalog: Array }} findings
 */
function validateCatalog(artifacts) {
  const perArtifact = new Map();
  const catalog = [];

  const seen = new Map();
  for (const a of artifacts) {
    if (seen.has(a.key)) {
      catalog.push(finding('error', 'catalog/duplicate',
        `Duplicate ${a.kind} name '${a.name}': ${seen.get(a.key)} and ${a.relPath}`));
    } else {
      seen.set(a.key, a.relPath);
    }
    perArtifact.set(a.key, VALIDATORS[a.kind](a));
  }

  return { perArtifact, catalog };
}

module.exports = { validateCatalog, VALIDATORS, MAX_DESCRIPTION_LENGTH, DESCRIPTION_TRIGGER };
