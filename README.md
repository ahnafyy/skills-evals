# skills-evals

**Know when your agent skills stop working.**

`skills-evals` validates, trigger-tests, and regression-tests every agent artifact in your repo — Claude/Copilot skills (`SKILL.md`), Copilot instructions and custom agents, Claude custom agents, Cursor rules, and prompt files — so you find out in CI when a skill stops triggering or behaving as intended after your codebase (or the skill) changed.

Zero dependencies. Node ≥ 18.17. Compatible with Anthropic skill-creator's `evals.json` schema.

📖 **Full documentation: [ahnafyy.github.io/skills-evals](https://ahnafyy.github.io/skills-evals/)** (or browse [docs/](docs/))

## Quick start

```bash
npx skills-evals list                    # see what it found in your repo
npx skills-evals init                    # scaffold eval case stubs
npx skills-evals run                     # tiers 1+2 (free, deterministic, CI-safe)
npx skills-evals run --update-baseline   # snapshot for regression detection — commit it
npx skills-evals behavioral my-skill     # tier 3 — a real agent proves the skill still works
```

### Or let an agent set it up for you

This repo ships an installable **[setup-skills-evals](skills/setup-skills-evals/)** skill that walks any agent (Claude Code, GitHub Copilot, Cursor, …) through the whole setup — it inventories your artifacts, asks what you want to test, fills in the eval cases from your answers, and wires up CI plus your local runner (npm, Gradle, Make, or a `.sh`).

It's a native [Agent Skill](https://agentskills.io) (open standard) — no CLI or middleman. Drop the `SKILL.md` into your agent's skills folder:

```bash
# Claude Code
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  --create-dirs -o .claude/skills/setup-skills-evals/SKILL.md
# GitHub Copilot: same file at .github/skills/setup-skills-evals/SKILL.md
# Cursor: save it as a rule at .cursor/rules/setup-skills-evals.mdc
```

Then ask your agent: *"set up skills-evals in this repo"*. See [skills/setup-skills-evals/](skills/setup-skills-evals/) for the exact path per agent.

## What it discovers

| Format | Files | Routing |
| --- | --- | --- |
| Skills (Claude & Copilot) | `**/SKILL.md` | description |
| Copilot instructions | `.github/copilot-instructions.md`, `**/*.instructions.md`, `AGENTS.md` | always / `applyTo` globs |
| Copilot custom agents | `**/*.agent.md`, `.github/agents/*.md` | description |
| Claude custom agents | `.claude/agents/*.md` | description |
| Cursor rules | `.cursor/rules/**/*.mdc` | `alwaysApply` / `globs` / description |
| Prompt files | `**/*.prompt.md` | manual |

## The three tiers

| Tier | What it checks | Where | Cost |
| --- | --- | --- | --- |
| 1. Structural | Frontmatter, naming, description limits, "use when" triggers, glob validity | CI (`validate`, `run`) | Free |
| 2. Trigger & routing | Positive prompts rank their artifact top-k; negative prompts don't; no two descriptions near-collide | CI (`run`) | Free |
| 3. Behavioral | An agent following the artifact satisfies its `expectations[]` | Scheduled CI (`behavioral`) | A cheap model run |

Tiers 1 and 2 are free and deterministic, so they gate every PR. **Tier 3 is where the real value is** — it's the only tier that proves an agent following your skill actually does the right thing, and it belongs on a schedule (e.g. nightly/weekly) so drift in the underlying codebase or model surfaces on its own. Point it at a cheap, fast model: most of the signal is *did the agent take the right actions*, which small models judge fine.

Tier 2 is a deterministic lexical approximation of routing (stemmed TF-IDF over descriptions, ranked **within each kind's pool** — skills compete with skills, Claude agents with Claude agents). It can't judge semantics — that's Tier 3's job — but it catches the two failure modes that dominate real trigger bugs: a description missing the vocabulary users actually say (false negative), and an over-broad description that outranks the right artifact (false positive). Glob-routed artifacts (`applyTo`, Cursor `globs`) are tested with file **paths** instead of prompts.

## Regression detection (the point of all this)

```bash
skills-evals run --update-baseline   # snapshot; commit .skills-evals/baseline.json
skills-evals run                     # every later run diffs against the snapshot
```

The baseline stores every trigger outcome, collision pairs, the rank-1 rate, and a **content hash of each artifact**. On later runs:

- a previously-passing trigger that now fails on an **unchanged** artifact → **error** (catalog drift: another artifact now wins that routing);
- the same failure on a **changed** artifact → **warning** (expected churn — review, then re-baseline);
- a new description collision → **error**;
- a rank-1 rate drop → **warning**.

So when a teammate adds a new skill whose description hijacks your skill's prompts — or an edit quietly breaks routing — CI fails with the exact prompt that regressed.

## Eval case format

One file per artifact: `evals/cases/<name>.json`. The `evals[]` array is [Anthropic skill-creator's `evals.json` schema](https://github.com/anthropics/skills/tree/main/skills/skill-creator) verbatim, so its tooling works against these files unmodified.

```json
{
  "artifact": "test-driven-development",
  "kind": "skill",
  "trigger": {
    "positive": [
      { "prompt": "Write a failing test for this bug before fixing it", "top_k": 1 }
    ],
    "negative": [
      { "prompt": "Draft a commit message for these changes", "owner": "commit-messages" }
    ]
  },
  "evals": [
    {
      "id": 1,
      "prompt": "Fix the reported rounding bug in the invoice totals, test-first.",
      "expected_output": "A failing test demonstrating the bug, a minimal fix, full suite passing",
      "files": ["invoice-app/"],
      "expectations": [
        "A failing test is written and shown failing before the fix",
        "The implementation is the minimum needed to pass"
      ],
      "trust_level": "provisional"
    }
  ]
}
```

- `positive` prompts are realistic user asks that should route to this artifact (`top_k` defaults to 3; tighten to 1 for a signature ask). Don't copy the description — that games the eval.
- `negative` prompts belong to a different artifact. Declaring that artifact in `owner` turns the negative into a real pairwise routing test: the owner must outrank this artifact, preventing vacuous passes.
- For glob-routed artifacts use `{ "path": "src/app/index.ts" }` entries instead of prompts.
- `trust_level: "provisional"` marks a behavioral eval without fixtures; its results are a sanity check, not evidence.

## Behavioral evals (Tier 3)

This is the tier that matters most: a real agent follows the artifact and a grader checks it did the right thing. Run it on a schedule so codebase and model drift surface on their own, and point it at a cheap, fast model to keep it running often.

```bash
skills-evals behavioral test-driven-development --dry-run   # print the plan, no model call
skills-evals behavioral test-driven-development             # execute + grade
skills-evals behavioral my-skill --adapter copilot --grader claude
```

Each eval runs in a throwaway workspace (fixtures from `files[]` materialized out of `evals/fixtures/`), captures the execution trace, and grades the **trace** — not the model's final prose — against `expectations[]`. The trace is fenced as untrusted data in the grader prompt and piped over stdin; grader output is validated as JSON before being written to `.skills-evals/results/` (gitignored) in skill-creator's `grading.json` shape.

### Executor adapters

| Adapter | Binary | Trace | Fidelity |
| --- | --- | --- | --- |
| `claude` (default) | `claude` | stream-json with tool calls | Full — grades what the agent *did* |
| `copilot` | `copilot` | final response text | Degraded — grades conservatively |
| `cursor` | `cursor-agent` | final response text | Degraded — grades conservatively |

Register your own:

```js
const { registerAdapter } = require('skills-evals');
registerAdapter({
  name: 'my-runtime',
  traceKind: 'text',
  run({ prompt, systemPrompt, cwd, tools, timeoutMs }) { /* return trace */ },
  judge(graderPrompt, { timeoutMs }) { /* return raw grading */ },
});
```

## GitHub Action

```yaml
- uses: ahnafyy/skills-evals@v0.1.0
  with:
    root: .
    # optional — run tier 3 in CI (needs the adapter CLI + credentials):
    # behavioral: my-skill, my-other-skill
    # adapter: claude|copilot|cursor   (default: config file, then claude)
```

Fails the job on any error-level finding, including baseline regressions. Tiers 1+2 need no secrets; see [CI docs](docs/ci.md) for adapter selection.

## Programmatic API

```js
const {
  discover, validateCatalog, loadCases, runTriggerEvals,
  buildBaseline, loadBaseline, diffBaseline, runBehavioral, loadConfig,
} = require('skills-evals');

const config = loadConfig(process.cwd());
const artifacts = discover(config.root, { exclude: config.exclude });
const tier1 = validateCatalog(artifacts);
const tier2 = runTriggerEvals({ artifacts, cases: loadCases(config.casesDir), config });
```

## Configuration

Optional `skills-evals.config.json` at the repo root:

```json
{
  "casesDir": "evals/cases",
  "fixturesDir": "evals/fixtures",
  "topK": 3,
  "collisionWarn": 0.5,
  "collisionError": 0.75,
  "minPositive": 3,
  "minNegative": 2,
  "minEvals": 1,
  "exclude": ["examples/**"],
  "behavioral": {
    "adapter": "claude",
    "tools": "Read,Glob,Grep,Edit,Write,Bash"
  }
}
```

## Documentation

The full docs live at **[ahnafyy.github.io/skills-evals](https://ahnafyy.github.io/skills-evals/)** — a static site rendered straight from the markdown in [docs/](docs/):

- [Getting started](docs/getting-started.md) — install, scaffold, first run
- [How it works](docs/how-it-works.md) — the pipeline and the three tiers in depth
- [Supported formats](docs/formats.md) — every artifact format and its routing mode
- [Eval case format](docs/case-format.md) — the full case-file schema
- [Regression detection](docs/regression-detection.md) — baselines and drift rules
- [Behavioral evals](docs/behavioral-evals.md) — Tier 3, adapters, custom runtimes
- [CLI reference](docs/cli.md) · [Configuration](docs/configuration.md) · [API](docs/api.md) · [CI](docs/ci.md)

## Prior art

- [Anthropic skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) — the `evals.json` behavioral schema, adopted verbatim.

What `skills-evals` adds: multi-format artifact discovery (Copilot + Claude + Cursor), deterministic TF-IDF trigger routing with per-kind pools, path-based trigger tests for glob-routed artifacts, trace-graded behavioral evals with pluggable executor adapters, and baseline snapshots with change-aware regression diffing.

## License

MIT
