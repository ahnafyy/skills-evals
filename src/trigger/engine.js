'use strict';

/**
 * Tier 2 — trigger & routing evals. Deterministic, free, CI-safe.
 *
 * For every eval case file:
 *   - positive prompts must rank their artifact within top_k against all
 *     other artifacts of the same kind (its "routing pool");
 *   - positive paths must match the artifact's routing globs;
 *   - negative prompts must not rank the artifact #1, and when an `owner`
 *     is declared, the owner must outrank it (a real pairwise routing test
 *     instead of one that passes vacuously when the prompt matches nothing);
 *   - negative paths must not match the routing globs.
 *
 * Catalog-wide: no two descriptions in the same pool may be near-duplicates
 * (cosine similarity above threshold) — guards against overlapping artifacts
 * drifting in.
 */

const crypto = require('crypto');
const { buildCorpus, vec, cosine, rank } = require('./text');
const { matchGlob } = require('../glob');
const { caseArtifactName, validateCaseShape, resolveArtifact } = require('../cases');

function triggerId(type, text) {
  return crypto.createHash('sha256').update(`${type}:${text}`).digest('hex').slice(0, 16);
}

function shortKey(key) {
  return key.split(':').slice(1).join(':');
}

/**
 * Run all Tier-2 checks.
 * @param {{ artifacts: Array, cases: Array, config: object }} opts
 * @returns {{ findings, triggers, collisions, stats }}
 */
function runTriggerEvals({ artifacts, cases, config }) {
  const findings = [];
  const triggers = []; // per-trigger records, feed the baseline
  let checksPassed = 0;
  let positives = 0;
  let rank1 = 0;

  // Routing pools: artifacts only compete against others of their own kind.
  const pools = new Map();
  for (const a of artifacts) {
    if (a.routing.mode !== 'description') continue;
    if (!pools.has(a.kind)) pools.set(a.kind, []);
    pools.get(a.kind).push(a);
  }
  const corpora = new Map();
  for (const [kind, pool] of pools) corpora.set(kind, buildCorpus(pool));

  // Coverage: rankable artifacts should ship an eval case file.
  for (const a of artifacts) {
    if (!config.coverageKinds.includes(a.kind)) continue;
    if (!cases.some((c) => c.file === `${a.name}.json`)) {
      findings.push({
        level: 'warn',
        code: 'coverage/no-case-file',
        artifact: a.key,
        message: `${a.name} (${a.kind}): no eval case file (${config.casesDirLabel || 'evals/cases'}/${a.name}.json)`,
      });
    }
  }

  for (const c of cases) {
    if (c.parseError) {
      findings.push({ level: 'error', code: 'case/invalid-json', message: `${c.file}: invalid JSON — ${c.parseError}` });
      continue;
    }
    const d = c.data;
    const expected = c.file.replace(/\.json$/, '');
    findings.push(...validateCaseShape(c, config));

    const resolved = resolveArtifact(d, expected, artifacts);
    if (!resolved.artifact) {
      findings.push({ level: 'error', code: 'case/unresolved', message: `${c.file}: ${resolved.error}` });
      continue;
    }
    const a = resolved.artifact;
    const corpus = corpora.get(a.kind);

    // ---- positive triggers ----
    for (const t of d.trigger?.positive || []) {
      const text = t.prompt || t.path || '';
      const record = { artifactKey: a.key, id: triggerId('positive', text), type: 'positive', text, rank: null, passed: false };
      triggers.push(record);

      if (t.path) {
        if (a.routing.mode === 'glob') {
          record.passed = matchGlob(a.routing.globs, t.path);
          if (record.passed) {
            checksPassed++;
          } else {
            findings.push({
              level: 'error', code: 'trigger/path-miss', artifact: a.key,
              message: `${a.name}: positive path does not match routing globs [${a.routing.globs.join(', ')}]\n       "${t.path}"`,
            });
          }
        } else if (a.routing.mode === 'always') {
          record.passed = true;
          checksPassed++;
        } else {
          findings.push({
            level: 'error', code: 'trigger/path-on-prompt-artifact', artifact: a.key,
            message: `${c.file}: path trigger on a ${a.routing.mode}-routed artifact — use "prompt" instead`,
          });
        }
        continue;
      }

      // prompt trigger
      if (a.routing.mode !== 'description') {
        findings.push({
          level: 'error', code: 'trigger/prompt-on-glob-artifact', artifact: a.key,
          message: `${c.file}: prompt trigger on a ${a.routing.mode}-routed artifact — use "path" instead`,
        });
        continue;
      }
      positives++;
      const topK = t.top_k || config.topK;
      const ranking = rank(t.prompt, corpus);
      const idx = ranking.findIndex((r) => r.key === a.key);
      const hit = idx >= 0 ? ranking[idx] : null;
      record.rank = hit && hit.score > 0 ? idx + 1 : null;
      if (idx === 0 && hit.score > 0) rank1++;
      if (idx >= 0 && idx < topK && hit.score > 0) {
        record.passed = true;
        checksPassed++;
      } else if (!hit || hit.score === 0) {
        findings.push({
          level: 'error', code: 'trigger/no-vocabulary', artifact: a.key,
          message: `${a.name}: description shares no vocabulary with a prompt users would say\n       "${t.prompt}"`,
        });
      } else {
        const top = ranking.filter((r) => r.score > 0).slice(0, 3);
        findings.push({
          level: 'error', code: 'trigger/rank-miss', artifact: a.key,
          message: `${a.name}: positive prompt ranked #${idx + 1} (need top ${topK})\n       "${t.prompt}"\n       top 3: ${top.map((r) => `${shortKey(r.key)} (${r.score.toFixed(2)})`).join(', ')}`,
        });
      }
    }

    // ---- negative triggers ----
    for (const t of d.trigger?.negative || []) {
      const text = t.prompt || t.path || '';
      const record = { artifactKey: a.key, id: triggerId('negative', text), type: 'negative', text, rank: null, passed: true };
      triggers.push(record);

      if (t.path) {
        if (a.routing.mode === 'glob') {
          if (matchGlob(a.routing.globs, t.path)) {
            record.passed = false;
            findings.push({
              level: 'error', code: 'trigger/path-overmatch', artifact: a.key,
              message: `${a.name}: negative path matches routing globs (over-broad globs)\n       "${t.path}"`,
            });
          } else {
            checksPassed++;
          }
        } else {
          findings.push({
            level: 'error', code: 'trigger/path-on-prompt-artifact', artifact: a.key,
            message: `${c.file}: negative path trigger on a ${a.routing.mode}-routed artifact`,
          });
        }
        continue;
      }

      if (a.routing.mode !== 'description') {
        findings.push({
          level: 'error', code: 'trigger/prompt-on-glob-artifact', artifact: a.key,
          message: `${c.file}: negative prompt trigger on a ${a.routing.mode}-routed artifact — use "path" instead`,
        });
        continue;
      }
      const ranking = rank(t.prompt, corpus);
      let ok = true;
      if (ranking.length && ranking[0].key === a.key && ranking[0].score > 0) {
        findings.push({
          level: 'error', code: 'trigger/negative-rank1', artifact: a.key,
          message: `${a.name}: ranked #1 for a negative prompt (over-broad description)\n       "${t.prompt}"`,
        });
        ok = false;
      }
      if (t.owner) {
        const ownerKey = `${a.kind}:${t.owner}`;
        const ownerIdx = ranking.findIndex((r) => r.key === ownerKey);
        if (ownerIdx === -1) {
          findings.push({
            level: 'error', code: 'trigger/unknown-owner', artifact: a.key,
            message: `${c.file}: negative declares unknown owner "${t.owner}" (must be a ${a.kind} in the same pool)`,
          });
          ok = false;
        } else {
          const selfIdx = ranking.findIndex((r) => r.key === a.key);
          if (ranking[ownerIdx].score === 0 || ownerIdx > selfIdx) {
            findings.push({
              level: 'error', code: 'trigger/owner-outranked', artifact: a.key,
              message: `${a.name}: declared owner ${t.owner} does not outrank it for negative prompt\n       "${t.prompt}" (owner #${ownerIdx + 1} @ ${ranking[ownerIdx].score.toFixed(2)}, self #${selfIdx + 1})`,
            });
            ok = false;
          }
        }
      }
      record.passed = ok;
      if (ok) checksPassed++;
    }
  }

  // ---- routing collisions per pool ----
  const collisions = [];
  for (const [kind, corpus] of corpora) {
    const keys = [...corpus.docs.keys()];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const va = vec(corpus.docs.get(keys[i]), corpus.idf);
        const vb = vec(corpus.docs.get(keys[j]), corpus.idf);
        const sim = cosine(va, vb);
        if (sim >= config.collisionWarn) {
          const level = sim >= config.collisionError ? 'error' : 'warn';
          collisions.push({ kind, a: keys[i], b: keys[j], sim, level });
          findings.push({
            level,
            code: level === 'error' ? 'collision/error' : 'collision/warn',
            message: `${level === 'error' ? 'collision' : 'overlap'}: ${shortKey(keys[i])} ↔ ${shortKey(keys[j])} (${kind}) descriptions ${(sim * 100).toFixed(0)}% similar`,
          });
        }
      }
    }
  }

  const rank1Rate = positives ? rank1 / positives : null;
  return {
    findings,
    triggers,
    collisions,
    stats: { checksPassed, positives, rank1, rank1Rate },
  };
}

module.exports = { runTriggerEvals, triggerId };
