'use strict';

/**
 * skills-evals CLI.
 *
 *   skills-evals list                       show discovered artifacts
 *   skills-evals validate                   Tier 1 — structural checks
 *   skills-evals run                        Tiers 1+2 (+ baseline diff)
 *   skills-evals run --update-baseline      snapshot current results
 *   skills-evals init                       scaffold eval case stubs
 *   skills-evals behavioral <name>          Tier 3 — spends tokens
 *
 * Global flags: --root <dir>  --json
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { discover } = require('./discover');
const { validateCatalog } = require('./validate');
const { loadCases } = require('./cases');
const { runTriggerEvals } = require('./trigger/engine');
const { buildBaseline, loadBaseline, saveBaseline, diffBaseline } = require('./baseline');
const { runBehavioral } = require('./behavioral/runner');
const { printFindings, countLevels, summaryLine } = require('./report');

const VALUE_FLAGS = new Set(['root', 'adapter', 'grader']);

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (VALUE_FLAGS.has(key)) args.flags[key] = argv[++i];
      else args.flags[key] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function setup(flags) {
  const root = path.resolve(flags.root || process.cwd());
  const config = loadConfig(root);
  const artifacts = discover(root, { exclude: config.exclude });
  return { root, config, artifacts };
}

function relCases(config) {
  return path.relative(config.root, config.casesDir) || 'evals/cases';
}

// ---------- commands ----------

function cmdList(flags) {
  const { artifacts } = setup(flags);
  if (flags.json) {
    console.log(JSON.stringify(artifacts.map(({ kind, name, relPath, routing, description }) => ({ kind, name, relPath, routing, description })), null, 2));
    return 0;
  }
  if (!artifacts.length) {
    console.log('No agent artifacts found.');
    return 0;
  }
  for (const a of artifacts) {
    const route = a.routing.mode === 'glob' ? `glob: ${a.routing.globs.join(', ')}` : a.routing.mode;
    console.log(`  ${a.kind.padEnd(14)} ${a.name.padEnd(32)} ${route.padEnd(24)} ${a.relPath}`);
  }
  console.log(`\n${artifacts.length} artifact(s)`);
  return 0;
}

function cmdValidate(flags) {
  const { config, artifacts } = setup(flags);
  const { perArtifact, catalog } = validateCatalog(artifacts);

  const all = [...catalog];
  if (!flags.json) console.log(`Validating ${artifacts.length} artifact(s)\n`);
  for (const a of artifacts) {
    const findings = perArtifact.get(a.key) || [];
    all.push(...findings.map((f) => ({ ...f, artifact: a.key })));
    if (flags.json) continue;
    if (!findings.length) {
      console.log(`  ✓  ${a.name} (${a.kind})`);
    } else {
      const hasError = findings.some((f) => f.level === 'error');
      console.log(`${hasError ? '  ✗ ' : '  ⚠ '} ${a.name} (${a.kind})`);
      for (const f of findings) {
        console.log(`       ${f.level === 'error' ? 'ERROR' : 'WARN '}: ${f.message}`);
      }
    }
  }
  const { errors, warnings } = countLevels(all);
  if (flags.json) {
    console.log(JSON.stringify({ findings: all, errors, warnings }, null, 2));
  } else {
    if (catalog.length) printFindings(catalog);
    console.log(`\n${summaryLine({ checked: `${artifacts.length} artifacts`, errors, warnings })}`);
  }
  return errors ? 1 : 0;
}

function cmdRun(flags) {
  const { config, artifacts } = setup(flags);
  const cases = loadCases(config.casesDir);
  config.casesDirLabel = relCases(config);

  // Tier 1
  const tier1 = validateCatalog(artifacts);
  const tier1Findings = [...tier1.catalog];
  for (const [key, findings] of tier1.perArtifact) {
    tier1Findings.push(...findings.map((f) => ({ ...f, artifact: key })));
  }

  // Tier 2
  const tier2 = runTriggerEvals({ artifacts, cases, config });

  // Baseline
  const current = buildBaseline({ artifacts, triggerResult: tier2 });
  let baselineFindings = [];
  let improvements = [];
  const prev = loadBaseline(config.baselineFile);
  if (flags['update-baseline']) {
    saveBaseline(config.baselineFile, current);
  } else if (prev) {
    const diff = diffBaseline(prev, current);
    baselineFindings = diff.findings;
    improvements = diff.improvements;
  }

  const all = [...tier1Findings, ...tier2.findings, ...baselineFindings];
  const { errors, warnings } = countLevels(all);
  const rate = tier2.stats.rank1Rate === null ? 'n/a' : `${(tier2.stats.rank1Rate * 100).toFixed(0)}%`;

  if (flags.json) {
    console.log(JSON.stringify({
      findings: all,
      stats: tier2.stats,
      improvements,
      baselineUpdated: !!flags['update-baseline'],
      errors,
      warnings,
    }, null, 2));
    return errors ? 1 : 0;
  }

  console.log(`Running evals across ${artifacts.length} artifact(s), ${cases.length} case file(s)\n`);
  printFindings(all);
  for (const i of improvements) console.log(`  ✓  improved: ${i}`);
  console.log(`\n${tier2.stats.checksPassed} trigger checks passed — ${errors} error(s), ${warnings} warning(s)`);
  console.log(`trigger rank-1 rate: ${rate} (${tier2.stats.rank1}/${tier2.stats.positives} positive prompts rank their artifact first)`);
  if (flags['update-baseline']) {
    console.log(`baseline written to ${path.relative(config.root, config.baselineFile)} — commit it`);
  } else if (!prev) {
    console.log(`no baseline found — run with --update-baseline to enable regression detection`);
  }
  console.log(errors ? 'FAILED' : 'PASSED');
  return errors ? 1 : 0;
}

function cmdInit(flags) {
  const { config, artifacts } = setup(flags);
  const cases = loadCases(config.casesDir);
  const targets = artifacts.filter(
    (a) => config.coverageKinds.includes(a.kind) && !cases.some((c) => c.file === `${a.name}.json`),
  );
  if (!targets.length) {
    console.log('Every coverable artifact already has an eval case file.');
    return 0;
  }
  fs.mkdirSync(config.casesDir, { recursive: true });
  for (const a of targets) {
    const stub = {
      artifact: a.name,
      kind: a.kind,
      trigger:
        a.routing.mode === 'glob'
          ? {
              positive: [{ path: `TODO: a file path that should match [${a.routing.globs.join(', ')}]` }],
              negative: [{ path: 'TODO: a file path that must NOT match' }],
            }
          : {
              positive: [
                { prompt: `TODO: a realistic user ask that should route to ${a.name}`, top_k: config.topK },
              ],
              negative: [
                { prompt: 'TODO: an ask that belongs to a different artifact', owner: 'TODO-other-artifact-name' },
              ],
            },
      evals: [
        {
          id: 1,
          prompt: `TODO: a task where following ${a.name} should change the outcome`,
          expected_output: 'TODO: what a correct execution produces',
          expectations: ['TODO: a verifiable statement a grader can check against the transcript'],
          trust_level: 'provisional',
        },
      ],
    };
    const file = path.join(config.casesDir, `${a.name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(stub, null, 2)}\n`);
    console.log(`  +  ${path.relative(config.root, file)}`);
  }
  console.log(`\n${targets.length} case stub(s) created — replace the TODOs with realistic prompts (don't copy the description; that games the eval)`);
  return 0;
}

function cmdBehavioral(flags, name) {
  if (!name) {
    console.error('Usage: skills-evals behavioral <artifact-name> [--adapter claude|copilot|cursor] [--grader <name>] [--dry-run]');
    return 1;
  }
  const { config, artifacts } = setup(flags);
  try {
    const { failures } = runBehavioral({
      artifacts,
      config,
      name,
      adapterName: flags.adapter,
      graderName: flags.grader,
      dryRun: !!flags['dry-run'],
    });
    return failures ? 1 : 0;
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    return 1;
  }
}

const HELP = `skills-evals — validate, trigger-test, and regression-test your agent artifacts

Usage:
  skills-evals list                     Show every discovered artifact
  skills-evals validate                 Tier 1: structural checks (CI-safe, free)
  skills-evals run                      Tiers 1+2 + baseline regression diff (CI-safe, free)
  skills-evals run --update-baseline    Snapshot results to .skills-evals/baseline.json
  skills-evals init                     Scaffold eval case stubs for uncovered artifacts
  skills-evals behavioral <name>        Tier 3: run + grade behavioral evals (spends tokens)
    --adapter claude|copilot|cursor       Executor (default: claude)
    --grader <adapter>                    Grader (default: same as executor)
    --dry-run                             Print the plan without executing

Flags:
  --root <dir>    Repo root to scan (default: cwd)
  --json          Machine-readable output (list, validate, run)

Formats discovered: SKILL.md · .github/copilot-instructions.md · *.instructions.md ·
AGENTS.md · *.agent.md · .claude/agents/*.md · .cursor/rules/*.mdc · *.prompt.md
`;

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || 'help';
  try {
    switch (cmd) {
      case 'list': return cmdList(args.flags);
      case 'validate': return cmdValidate(args.flags);
      case 'run': return cmdRun(args.flags);
      case 'init': return cmdInit(args.flags);
      case 'behavioral': return cmdBehavioral(args.flags, args._[1]);
      case 'help':
      case '--help':
        console.log(HELP);
        return 0;
      case 'version':
        console.log(require('../package.json').version);
        return 0;
      default:
        console.error(`Unknown command "${cmd}"\n`);
        console.log(HELP);
        return 1;
    }
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    return 1;
  }
}

module.exports = { main, parseArgs };
