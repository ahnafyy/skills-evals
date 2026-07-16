# Getting started

## Install

Nothing to install — run it with `npx`:

```bash
npx skills-evals list
```

Or add it to your project:

```bash
npm install --save-dev skills-evals
```

Requires Node.js ≥ 18.17. Zero runtime dependencies.

> **Prefer an agent to do all of this for you?** Install the [setup-skills-evals skill](https://github.com/ahnafyy/skills-evals/tree/main/skills/setup-skills-evals) — a native [Agent Skill](https://agentskills.io), no CLI needed: drop its `SKILL.md` into `.claude/skills/`, `.github/skills/`, or a `.cursor/rules/*.mdc` — and ask your agent (Claude Code, GitHub Copilot, Cursor, …) to *"set up skills-evals in this repo"*. It runs the discovery, interviews you about what to test and how you run things (CI, npm, Gradle, `.sh`), and wires everything below up for you.

## 1. See what it discovers

```bash
npx skills-evals list
```

```
  claude-agent   test-writer               description       .claude/agents/test-writer.md
  copilot-agent  code-reviewer             description       .github/agents/code-reviewer.agent.md
  cursor-rule    api-conventions           glob: src/api/**  .cursor/rules/api-conventions.mdc
  instructions   typescript                glob: **/*.ts     .github/instructions/typescript.instructions.md
  skill          test-driven-development   description       skills/test-driven-development/SKILL.md
```

Every artifact is classified by **kind** and **routing mode** — how an agent decides to use it. See [Supported formats](formats.md).

## 2. Validate structure (Tier 1)

```bash
npx skills-evals validate
```

Checks frontmatter, naming conventions, description length limits, "use when" trigger phrases, and glob validity. Errors exit 1; warnings don't.

## 3. Scaffold eval cases

```bash
npx skills-evals init
```

Creates a stub in `evals/cases/<name>.json` for every skill, agent, and rule that doesn't have one. Replace the TODOs with **realistic prompts users actually say** — don't copy the description, that games the eval. See [Eval case format](case-format.md).

## 4. Run the evals (Tier 2)

```bash
npx skills-evals run
```

```
Running evals across 9 artifact(s), 3 case file(s)

14 trigger checks passed — 0 error(s), 0 warning(s)
trigger rank-1 rate: 100% (6/6 positive prompts rank their artifact first)
PASSED
```

Deterministic and free — safe to run on every push.

## 5. Enable regression detection

```bash
npx skills-evals run --update-baseline
git add .skills-evals/baseline.json && git commit -m "chore: eval baseline"
```

From now on, every `run` diffs against the snapshot and fails CI when a previously-passing trigger regresses. See [Regression detection](regression-detection.md).

## 6. (Optional) Behavioral evals — Tier 3

```bash
npx skills-evals behavioral test-driven-development --dry-run   # plan only
npx skills-evals behavioral test-driven-development             # spends tokens
```

Runs the eval prompt through a real headless agent and grades the execution trace against your `expectations[]`. See [Behavioral evals](behavioral-evals.md).

## 7. Add it to CI

```yaml
- uses: ahnafyy/skills-evals@v0.1.0
```

See [GitHub Action & CI](ci.md).
