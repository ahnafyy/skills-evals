# Programmatic API

Everything the CLI does is exposed as plain functions:

```js
const {
  discover, validateCatalog, loadCases, runTriggerEvals,
  buildBaseline, loadBaseline, saveBaseline, diffBaseline,
  runBehavioral, registerAdapter, loadConfig,
} = require('skills-evals');
```

## Full pipeline example

```js
const {
  loadConfig, discover, validateCatalog, loadCases,
  runTriggerEvals, buildBaseline, loadBaseline, diffBaseline,
} = require('skills-evals');

const config = loadConfig(process.cwd());
const artifacts = discover(config.root, { exclude: config.exclude });

// Tier 1
const tier1 = validateCatalog(artifacts);
// tier1.perArtifact: Map<key, findings[]>, tier1.catalog: catalog-level findings

// Tier 2
const cases = loadCases(config.casesDir);
const tier2 = runTriggerEvals({ artifacts, cases, config });
// tier2.findings, tier2.triggers, tier2.collisions, tier2.stats.rank1Rate

// Regression diff
const current = buildBaseline({ artifacts, triggerResult: tier2 });
const prev = loadBaseline(config.baselineFile);
const { findings, improvements } = diffBaseline(prev, current);
```

Every finding has the shape `{ level: 'error' | 'warn', code: string, message: string, artifact?: string }` — stable `code` values make findings easy to filter or gate on programmatically.

## Key exports

### Discovery & parsing

| Export | Signature |
| --- | --- |
| `discover` | `(root, { exclude? }) → artifacts[]` |
| `classify` | `(relPath) → kind \| null` |
| `parse` | `(kind, content, filePath, relPath) → artifact` |
| `parseFrontmatter` | `(content) → { data, body }` |
| `matchGlob` | `(spec, filePath) → boolean` |

### Tiers

| Export | Signature |
| --- | --- |
| `validateCatalog` | `(artifacts) → { perArtifact, catalog }` |
| `loadCases` | `(casesDir) → cases[]` |
| `runTriggerEvals` | `({ artifacts, cases, config }) → { findings, triggers, collisions, stats }` |
| `runBehavioral` | `({ artifacts, config, name, adapterName?, graderName?, dryRun?, log? }) → { failures, results }` |

### Baseline

| Export | Signature |
| --- | --- |
| `buildBaseline` | `({ artifacts, triggerResult }) → baseline` |
| `loadBaseline` / `saveBaseline` | file I/O |
| `diffBaseline` | `(prev, current) → { findings, improvements }` |
| `artifactHash` | `(artifact) → hash` |

### Adapters & text pipeline

| Export | Signature |
| --- | --- |
| `registerAdapter` | `({ name, traceKind, run, judge })` |
| `getAdapter` | `(name) → adapter` |
| `text` | `{ tokenize, stem, buildCorpus, rank, cosine, … }` — the TF-IDF pipeline, reusable for your own routing experiments |
