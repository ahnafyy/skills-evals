'use strict';

/**
 * Baseline snapshots + regression diffing — the core answer to "did my
 * skills stop working after the codebase or the skills changed?"
 *
 * `skills-evals run --update-baseline` snapshots per-trigger outcomes,
 * collision pairs, the rank-1 rate, and a content hash of every artifact.
 * Subsequent runs diff against the snapshot:
 *
 *   - a previously-passing trigger that now fails on an UNCHANGED artifact is
 *     an error (catalog drift: something else moved the ranking);
 *   - the same failure on a CHANGED artifact is a warning (expected churn —
 *     you edited it, re-baseline after review);
 *   - a new collision pair is an error;
 *   - a rank-1 rate drop is a warning.
 *
 * Commit the baseline file; results dirs stay gitignored.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASELINE_VERSION = 1;

function artifactHash(a) {
  return crypto.createHash('sha256').update(`${a.description}\n${a.body}`).digest('hex').slice(0, 24);
}

/** Build a baseline object from a catalog + trigger eval results. */
function buildBaseline({ artifacts, triggerResult }) {
  const b = {
    version: BASELINE_VERSION,
    generatedAt: new Date().toISOString(),
    rank1Rate: triggerResult.stats.rank1Rate,
    artifacts: {},
    triggers: {},
    collisions: triggerResult.collisions
      .map((c) => `${c.a}|${c.b}`)
      .sort(),
  };
  for (const a of artifacts) {
    b.artifacts[a.key] = { hash: artifactHash(a), kind: a.kind };
  }
  for (const t of triggerResult.triggers) {
    if (!b.triggers[t.artifactKey]) b.triggers[t.artifactKey] = {};
    b.triggers[t.artifactKey][t.id] = { type: t.type, text: t.text, rank: t.rank, passed: t.passed };
  }
  return b;
}

function loadBaseline(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveBaseline(file, baseline) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`);
}

/**
 * Diff a previous baseline against the current run.
 * @returns {{ findings: Array, improvements: Array }}
 */
function diffBaseline(prev, current) {
  const findings = [];
  const improvements = [];
  if (!prev) return { findings, improvements };

  for (const [key, prevTriggers] of Object.entries(prev.triggers || {})) {
    const curArtifact = current.artifacts[key];
    const shortName = key.split(':').slice(1).join(':');
    if (!curArtifact) {
      findings.push({
        level: 'warn',
        code: 'baseline/artifact-removed',
        message: `${shortName}: artifact in baseline no longer exists — re-baseline if intentional`,
      });
      continue;
    }
    const changed = (prev.artifacts?.[key]?.hash || '') !== curArtifact.hash;

    for (const [id, prevT] of Object.entries(prevTriggers)) {
      const nowT = current.triggers[key]?.[id];
      if (!nowT) {
        findings.push({
          level: 'warn',
          code: 'baseline/trigger-removed',
          message: `${shortName}: ${prevT.type} trigger removed from eval case ("${prevT.text}")`,
        });
        continue;
      }
      if (prevT.passed && !nowT.passed) {
        findings.push({
          level: changed ? 'warn' : 'error',
          code: changed ? 'baseline/regression-after-change' : 'baseline/regression',
          message: changed
            ? `${shortName}: ${prevT.type} trigger regressed after the artifact changed ("${prevT.text}") — review, then re-baseline`
            : `${shortName}: ${prevT.type} trigger regressed but the artifact did NOT change ("${prevT.text}") — catalog drift: another artifact now wins this routing`,
        });
      } else if (!prevT.passed && nowT.passed) {
        improvements.push(`${shortName}: ${prevT.type} trigger now passes ("${prevT.text}")`);
      }
    }
  }

  const prevCollisions = new Set(prev.collisions || []);
  for (const pair of current.collisions) {
    if (!prevCollisions.has(pair)) {
      findings.push({
        level: 'error',
        code: 'baseline/new-collision',
        message: `new description collision since baseline: ${pair.replace('|', ' ↔ ')}`,
      });
    }
  }

  if (
    typeof prev.rank1Rate === 'number' &&
    typeof current.rank1Rate === 'number' &&
    current.rank1Rate < prev.rank1Rate
  ) {
    findings.push({
      level: 'warn',
      code: 'baseline/rank1-drop',
      message: `trigger rank-1 rate dropped: ${(prev.rank1Rate * 100).toFixed(0)}% → ${(current.rank1Rate * 100).toFixed(0)}% — descriptions are drifting toward each other`,
    });
  }

  return { findings, improvements };
}

module.exports = { BASELINE_VERSION, artifactHash, buildBaseline, loadBaseline, saveBaseline, diffBaseline };
