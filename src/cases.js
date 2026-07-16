'use strict';

/**
 * Eval case files: one JSON file per artifact in <casesDir>/<name>.json.
 *
 * Format (a superset of Anthropic skill-creator's evals.json — the evals[]
 * array is that schema verbatim, so skill-creator tooling works unmodified):
 *
 *   {
 *     "artifact": "<name>",          // or "skill_name" for compatibility
 *     "kind": "skill",               // optional; required only when the name
 *                                    // is ambiguous across kinds
 *     "trigger": {
 *       "positive": [{ "prompt": "...", "top_k": 3 } | { "path": "src/a.ts" }],
 *       "negative": [{ "prompt": "...", "owner": "other-artifact" } | { "path": "..." }]
 *     },
 *     "evals": [
 *       { "id": 1, "prompt": "...", "expected_output": "...",
 *         "files": ["fixture/paths"], "expectations": ["..."],
 *         "trust_level": "provisional" }
 *     ]
 *   }
 */

const fs = require('fs');
const path = require('path');

function loadCases(casesDir) {
  if (!fs.existsSync(casesDir)) return [];
  return fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(casesDir, f), 'utf8');
      try {
        return { file: f, data: JSON.parse(raw) };
      } catch (e) {
        return { file: f, parseError: e.message };
      }
    });
}

/** The artifact name a case file declares ('artifact', or 'skill_name' for compat). */
function caseArtifactName(data) {
  return data.artifact || data.skill_name || '';
}

/** Validate a case file's shape. Returns findings ({ level, code, message }). */
function validateCaseShape(c, config) {
  const out = [];
  const d = c.data;
  const expected = c.file.replace(/\.json$/, '');

  if (caseArtifactName(d) !== expected) {
    out.push({
      level: 'error',
      code: 'case/name-mismatch',
      message: `${c.file}: artifact "${caseArtifactName(d) || '(missing)'}" does not match filename`,
    });
  }

  for (const ev of d.evals || []) {
    const shapeOk =
      Number.isInteger(ev.id) &&
      typeof ev.prompt === 'string' &&
      typeof ev.expected_output === 'string' &&
      Array.isArray(ev.expectations) &&
      ev.expectations.length > 0 &&
      ev.expectations.every((x) => typeof x === 'string');
    if (!shapeOk) {
      out.push({
        level: 'error',
        code: 'case/bad-eval-shape',
        message: `${c.file}: eval id=${ev.id} does not match the evals.json schema (id, prompt, expected_output, expectations[])`,
      });
    }
  }

  for (const [type, list] of [['positive', d.trigger?.positive], ['negative', d.trigger?.negative]]) {
    for (const t of list || []) {
      const hasPrompt = typeof t.prompt === 'string' && t.prompt.trim();
      const hasPath = typeof t.path === 'string' && t.path.trim();
      if (!hasPrompt && !hasPath) {
        out.push({
          level: 'error',
          code: 'case/bad-trigger',
          message: `${c.file}: a ${type} trigger needs either "prompt" or "path"`,
        });
      }
    }
  }

  const pc = (d.trigger?.positive || []).length;
  const nc = (d.trigger?.negative || []).length;
  const ec = (d.evals || []).length;
  if (pc < config.minPositive || nc < config.minNegative || ec < config.minEvals) {
    out.push({
      level: 'warn',
      code: 'case/below-minimums',
      message: `${expected}: below documented minimums (${pc} positive/${nc} negative/${ec} behavioral; want ${config.minPositive}/${config.minNegative}/${config.minEvals})`,
    });
  }

  return out;
}

/**
 * Resolve which artifact a case file targets.
 * @returns {{ artifact?: object, error?: string }}
 */
function resolveArtifact(d, expectedName, artifacts) {
  const matches = artifacts.filter(
    (a) => a.name === expectedName && (!d.kind || a.kind === d.kind),
  );
  if (matches.length === 0) {
    return { error: `no ${d.kind || ''} artifact named "${expectedName}" exists`.replace(/\s+/g, ' ') };
  }
  if (matches.length > 1) {
    return {
      error: `"${expectedName}" is ambiguous across kinds (${matches.map((a) => a.kind).join(', ')}) — add a "kind" field`,
    };
  }
  return { artifact: matches[0] };
}

module.exports = { loadCases, caseArtifactName, validateCaseShape, resolveArtifact };
