# GitHub Action & CI

## The Action

```yaml
name: skills-evals
on:
  pull_request:
  push:
    branches: [main]

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ahnafyy/skills-evals@v0.1.0
        with:
          root: .          # optional, default '.'
          args: ''         # extra args for `skills-evals run`
```

The Action runs `skills-evals run` and fails the job on any error-level finding — structural errors, trigger failures, description collisions, and **baseline regressions**.

> `skills-evals run` (Tiers 1+2) never calls a model or an adapter — it's pure computation, free, and needs no secrets.

## Adapter selection for behavioral evals

Adapters only apply to Tier 3 (`skills-evals behavioral`). The executor and grader are resolved in this order:

1. `--adapter` / `--grader` CLI flags (or the Action's `adapter` / `grader` inputs)
2. `behavioral.adapter` / `behavioral.grader` in `skills-evals.config.json` at the repo root — since this file is committed, **CI picks it up automatically** with no extra workflow config
3. Defaults: adapter `claude`, grader falls back to the executor

```json
{
  "behavioral": {
    "adapter": "copilot",
    "grader": "claude"
  }
}
```

Whichever adapter you pick, its CLI must be installed and authenticated in the CI job:

| Adapter | CLI binary | Auth in CI |
| --- | --- | --- |
| `claude` | `claude` | `ANTHROPIC_API_KEY` |
| `copilot` | `copilot` | `GH_TOKEN` / Copilot subscription auth |
| `cursor` | `cursor-agent` | `CURSOR_API_KEY` |

The Action can run behavioral evals directly via the `behavioral` input:

```yaml
- uses: ahnafyy/skills-evals@v0.1.0
  with:
    behavioral: test-driven-development, commit-messages
    adapter: copilot   # optional — omit to use config / default
  env:
    GH_TOKEN: ${{ secrets.COPILOT_TOKEN }}
```

## With npx instead

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npx skills-evals run
```

## Recommended CI setup

1. **On every PR:** `skills-evals run`. With a committed baseline, this catches routing drift on the exact PR that introduces it — e.g. a new skill whose description hijacks another skill's prompts.
2. **Baseline updates:** when a PR intentionally changes descriptions, run `skills-evals run --update-baseline` locally and commit the refreshed `.skills-evals/baseline.json` in the same PR, so reviewers see the eval diff alongside the change.
3. **Behavioral evals:** keep them out of PR CI (they spend tokens and add latency). Run them on demand or on a schedule:

```yaml
name: behavioral-evals
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1'   # weekly
jobs:
  behavioral:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      # requires a configured claude CLI + API key in the environment
      - run: npx skills-evals behavioral my-most-important-skill
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

To use a different executor, pass `--adapter copilot` / `--adapter cursor` (with the matching CLI installed and its credentials in `env`), or set `behavioral.adapter` in the committed config file.

## What to gitignore vs commit

| Path | Action |
| --- | --- |
| `.skills-evals/baseline.json` | **Commit** — it's the regression reference, like a lockfile |
| `.skills-evals/results/` | Gitignore — per-run behavioral gradings |
| `evals/cases/` | **Commit** — the eval definitions |
| `evals/fixtures/` | **Commit** — behavioral test fixtures |
