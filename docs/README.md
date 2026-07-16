# skills-evals

> **Know when your agent skills stop working.**

`skills-evals` validates, trigger-tests, and regression-tests every agent artifact in your repo — Claude/Copilot skills (`SKILL.md`), Copilot instructions and custom agents, Claude custom agents, Cursor rules, and prompt files — so you find out **in CI** when a skill stops triggering or behaving as intended after your codebase (or the skill) changed.

- **Zero dependencies** — plain Node.js ≥ 18.17, nothing to install beyond the package itself
- **Deterministic & CI-safe** — Tiers 1 and 2 are free and reproducible; Tier 3 (real agent runs) is strictly opt-in
- **Multi-format** — one tool for GitHub Copilot, Claude Code, and Cursor artifacts
- **Regression-aware** — baseline snapshots catch routing drift the moment it happens

```bash
npx skills-evals list                    # see what it found in your repo
npx skills-evals init                    # scaffold eval case stubs
npx skills-evals run                     # tiers 1+2 (free, deterministic)
npx skills-evals run --update-baseline   # snapshot for regression detection
npx skills-evals behavioral my-skill     # tier 3 (runs a real agent)
```

## The problem this solves

Agent skills fail silently. You write a `SKILL.md`, it works great — then three months later:

- a teammate adds a new skill whose description **hijacks your skill's prompts**;
- someone edits your description and it **stops matching what users actually say**;
- the codebase changes and the skill's advice **no longer produces correct behavior**;
- two skill descriptions **drift toward each other** until the router can't tell them apart.

Nothing errors. No test fails. You only find out when the agent behaves badly in front of a user. `skills-evals` turns each of those failure modes into a CI failure with the exact prompt that regressed.

## Where to go next

- [Getting started](getting-started.md) — install, scaffold, first run
- [How it works](how-it-works.md) — the three-tier architecture
- [Regression detection](regression-detection.md) — baselines and drift detection
- [CLI reference](cli.md) — every command and flag

## Prior art

The behavioral eval format adopts [Anthropic skill-creator's `evals.json`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) schema verbatim — so skill-creator tooling works against these case files unmodified.

What `skills-evals` adds: multi-format artifact discovery, deterministic TF-IDF trigger routing with per-kind pools, path-based trigger tests for glob-routed artifacts, trace-graded behavioral evals with pluggable executor adapters, and baseline snapshots with change-aware regression diffing.
