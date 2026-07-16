'use strict';

/**
 * Tier 3 — behavioral eval runner. Opt-in; spends tokens; never in CI by
 * default. Runs each eval prompt through a headless agent executor in a
 * throwaway workspace, captures the execution trace, and grades the trace
 * against the eval's expectations[].
 */

const fs = require('fs');
const path = require('path');
const { KIND_LABELS } = require('../parsers');
const { getAdapter } = require('./adapters');
const { materializeWorkspace } = require('./workspace');
const { buildGraderPrompt, parseGrading } = require('./grader');
const { loadCases, resolveArtifact } = require('../cases');

/**
 * Run the behavioral evals for one artifact.
 * @param {{ artifacts: Array, config: object, name: string, adapterName?: string,
 *           graderName?: string, dryRun?: boolean, log?: Function }} opts
 * @returns {{ failures: number, results: Array }}
 */
function runBehavioral({ artifacts, config, name, adapterName, graderName, dryRun = false, log = console.log }) {
  const cases = loadCases(config.casesDir);
  const c = cases.find((x) => x.file === `${name}.json`);
  if (!c) throw new Error(`No eval case file for "${name}" (${path.relative(config.root, config.casesDir)}/${name}.json)`);
  if (c.parseError) throw new Error(`${c.file}: invalid JSON — ${c.parseError}`);

  const resolved = resolveArtifact(c.data, name, artifacts);
  if (!resolved.artifact) throw new Error(`${c.file}: ${resolved.error}`);
  const artifact = resolved.artifact;

  const evals = c.data.evals || [];
  if (!evals.length) throw new Error(`"${name}" has no behavioral evals`);

  const executor = getAdapter(adapterName || config.behavioral.adapter);
  const grader = getAdapter(graderName || config.behavioral.grader || executor.name);
  const artifactContent = fs.readFileSync(artifact.filePath, 'utf8');
  const systemPrompt = `Follow this ${KIND_LABELS[artifact.kind]} exactly:\n\n${artifactContent}`;

  if (!dryRun) fs.mkdirSync(config.resultsDir, { recursive: true });

  let failures = 0;
  const results = [];

  for (const ev of evals) {
    const fixtures = (ev.files || []).length;
    if (ev.trust_level === 'provisional' || !fixtures) {
      log(`  note: eval ${ev.id} is provisional (${fixtures ? 'flagged' : 'no fixtures'}) — results are a sanity check, not evidence`);
    }
    if (dryRun) {
      log(`[dry-run] eval ${ev.id}: workspace + ${fixtures} fixture(s); executor=${executor.name} (${executor.traceKind}), grader=${grader.name}; prompt: "${ev.prompt.slice(0, 80)}${ev.prompt.length > 80 ? '…' : ''}"`);
      continue;
    }

    const workspace = materializeWorkspace(ev, config.fixturesDir);
    log(`eval ${ev.id}: executing via ${executor.name} in ${workspace} ...`);
    const trace = executor.run({
      prompt: ev.prompt,
      systemPrompt,
      cwd: workspace,
      tools: config.behavioral.tools,
      timeoutMs: config.behavioral.executorTimeoutMs,
    });

    const graderPrompt = buildGraderPrompt({
      expectations: ev.expectations,
      trace,
      traceKind: executor.traceKind,
    });
    const raw = grader.judge(graderPrompt, { timeoutMs: config.behavioral.graderTimeoutMs });
    const grading = parseGrading(raw);

    const base = path.join(config.resultsDir, `${name}.eval-${ev.id}`);
    if (!grading) {
      fs.writeFileSync(`${base}.grading.raw.txt`, raw);
      log(`  ✗  eval ${ev.id}: grader returned invalid JSON — raw saved to ${path.relative(config.root, base)}.grading.raw.txt`);
      failures++;
      results.push({ id: ev.id, ok: false, grading: null });
      continue;
    }
    fs.writeFileSync(`${base}.grading.json`, `${JSON.stringify(grading, null, 2)}\n`);
    log(`eval ${ev.id}: ${grading.summary.passed}/${grading.summary.total} expectations passed -> ${path.relative(config.root, base)}.grading.json`);
    const ok = grading.summary.passed >= grading.summary.total;
    if (!ok) failures++;
    results.push({ id: ev.id, ok, grading });
  }

  return { failures, results };
}

module.exports = { runBehavioral };
