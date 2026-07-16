---
name: setup-skills-evals
description: Set up the skills-evals library in a repository — discover agent artifacts, interview the user about what to test, scaffold eval cases, and wire CI and local runners. Use when the user wants to set up skills-evals, test their agent skills, add evals for skills or custom agents, check why a skill isn't triggering, or add regression tests for their skills, instructions, or Cursor rules.
---

# Setting up skills-evals

You are helping the user adopt [skills-evals](https://ahnafyy.github.io/skills-evals/) — a zero-dependency library that validates, trigger-tests, and regression-tests agent artifacts (skills, instructions, custom agents, Cursor rules, prompt files). Follow this workflow in order. Ask the interview questions **one at a time** and wait for answers.

## Step 1 — Inventory what exists

```bash
npx skills-evals list
```

Show the user the output. If nothing is discovered, stop and help them create their first artifact (e.g. a `SKILL.md`) before setting up evals.

## Step 2 — Interview the user

Ask these questions one at a time:

1. **"Which of these do you want to write eval tests for?"** — show the discovered artifacts. For each one they pick, also ask:
   - *"What are 3–5 things users actually say that should trigger it?"* (realistic phrasing, not the description restated)
   - *"What nearby asks should it NOT handle, and which artifact owns those instead?"*
2. **"Is this repo on CI?"**
   - GitHub Actions → offer the `ahnafyy/skills-evals@v0.1.0` action or a plain `npx skills-evals run` step.
   - Other CI (CircleCI, GitLab, Jenkins…) → add `npx skills-evals run` to their existing pipeline config.
   - No CI → skip; local runner only.
3. **"How do you want to run it locally?"** — offer to hook into whatever they use:
   - **npm/pnpm/yarn** → add a script to `package.json`
   - **Gradle** → add an `Exec` task
   - **Make** → add a target
   - **plain shell** → create an `evals.sh`

## Step 3 — Scaffold and fill the eval cases

```bash
npx skills-evals init
```

This creates `evals/cases/<name>.json` stubs. Fill each one **from the interview answers**, following these rules:

- ≥ 3 `positive` prompts. Use the user's real phrasing. Never copy the artifact's description — that games the eval. Use `"top_k": 1` for the artifact's signature ask.
- ≥ 2 `negative` prompts, each with `"owner": "<other-artifact>"` when another artifact should win — that makes it a real pairwise routing test.
- For glob-routed artifacts (`applyTo` instructions, Cursor `globs` rules) use `{ "path": "src/example.ts" }` entries instead of prompts.
- Optionally add behavioral `evals[]` (Anthropic skill-creator schema): `prompt`, `expected_output`, `expectations[]`, and `files[]` pointing into `evals/fixtures/`. Mark fixture-less evals `"trust_level": "provisional"`.

## Step 4 — Wire the runners the user chose

**npm script** (`package.json`):

```json
{ "scripts": { "evals": "skills-evals run", "evals:baseline": "skills-evals run --update-baseline" } }
```

**Gradle** (`build.gradle`):

```groovy
tasks.register('skillsEvals', Exec) {
  commandLine 'npx', 'skills-evals', 'run'
}
```

**Make** (`Makefile`):

```makefile
evals:
	npx skills-evals run
```

**Shell** (`evals.sh`, then `chmod +x evals.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail
npx skills-evals run "$@"
```

**GitHub Actions** (`.github/workflows/skills-evals.yml`):

```yaml
name: skills-evals
on: [pull_request, push]
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ahnafyy/skills-evals@v0.1.0
```

## Step 5 — Baseline and verify

```bash
npx skills-evals run                     # fix any errors first
npx skills-evals run --update-baseline   # then snapshot
```

- Fix errors before baselining. Common ones: `trigger/rank-miss` → the description is missing vocabulary from the failing prompt; `collision/error` → two descriptions are near-identical, sharpen their "use when" clauses; `trigger/negative-rank1` → the description is over-broad.
- Commit `.skills-evals/baseline.json` (it is the regression reference, like a lockfile).
- Add `.skills-evals/results/` to `.gitignore`.
- Tell the user: when they intentionally edit a description later, rerun `--update-baseline` and commit the diff in the same PR.

## Behavioral evals (Tier 3) — the high-value tier

This is the tier that actually proves a skill still works after the codebase or model changes, so encourage the user to set it up on a schedule. `npx skills-evals behavioral <name> --dry-run` first (no model call), then without `--dry-run` (runs a real agent; needs the `claude`, `copilot`, or `cursor-agent` CLI installed). Recommend a **scheduled** workflow (nightly or weekly) rather than PR CI — keep it out of PRs so those stay instant, and point the executor and grader at a **cheap, fast model** so it can run often. Offer the scheduled GitHub Actions workflow below.

```yaml
# .github/workflows/behavioral-evals.yml
name: behavioral-evals
on:
  schedule:
    - cron: '0 6 * * 1'   # weekly — nightly is also reasonable
  workflow_dispatch:
permissions:
  contents: read
  copilot-requests: write   # lets Copilot CLI auth with the built-in GITHUB_TOKEN
jobs:
  behavioral:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      # the built-in GITHUB_TOKEN authenticates Copilot CLI in Actions when the
      # workflow grants copilot-requests: write — no PAT or extra secret needed
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @github/copilot
      - run: npx skills-evals behavioral <name> --adapter copilot --grader copilot
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: behavioral-gradings
          path: .skills-evals/results/
```

Swap the executor for `--adapter claude` (needs the `claude` CLI + `ANTHROPIC_API_KEY`) or `--adapter cursor` if that's what the user runs. Whichever they pick, choose a cheap/fast model so the scheduled run stays inexpensive.
