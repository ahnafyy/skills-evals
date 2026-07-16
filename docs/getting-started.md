# Getting started

> **Want an agent to do all of this for you?** Install the [setup-skills-evals skill](https://github.com/ahnafyy/skills-evals/tree/main/skills/setup-skills-evals) — a native [Agent Skill](https://agentskills.io), no CLI required. Drop its `SKILL.md` into `.claude/skills/`, `.github/skills/`, or a `.cursor/rules/*.mdc`, then ask your agent (Claude Code, GitHub Copilot, Cursor, …) to *"set up skills-evals in this repo."* It runs the whole flow below — discovery, an interview about what to test and how you ship (CI, npm, Gradle, `.sh`), and wiring it up. Prefer to drive it yourself? Keep reading.

The whole loop is five moves: **install → discover → run → snapshot → automate.** Each step builds on the one before it.

## 1. Install

Nothing to install — run any command with `npx skills-evals …`. To pin it in your project:

```bash
npm install --save-dev skills-evals
```

Requires Node.js ≥ 18.17. Zero runtime dependencies.

## 2. See what it discovers

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

Every artifact is classified by **kind** and **routing mode** — how an agent decides to use it. If something you expected is missing, that's your first finding. See [Supported formats](formats.md).

## 3. Scaffold eval cases

```bash
npx skills-evals init
```

Creates a stub in `evals/cases/<name>.json` for every skill, agent, and rule that doesn't have one yet. Replace the TODOs with **realistic prompts users actually say** — don't paraphrase the description, that games the eval. See [Eval case format](case-format.md).

## 4. Run the evals

```bash
npx skills-evals run
```

```
Running evals across 9 artifact(s), 3 case file(s)

14 trigger checks passed — 0 error(s), 0 warning(s)
trigger rank-1 rate: 100% (6/6 positive prompts rank their artifact first)
PASSED
```

`run` covers the two free tiers: **Tier 1** structural lint (frontmatter, naming, description limits, "use when" phrases, glob validity) and **Tier 2** trigger routing (do the prompts users say rank the right artifact top-k, and no negatives sneak in?). It's deterministic and free, so it's safe on every push. To run only the structural checks, use `npx skills-evals validate`. See [How it works](how-it-works.md).

## 5. Lock in a baseline

```bash
npx skills-evals run --update-baseline
git add .skills-evals/baseline.json && git commit -m "chore: eval baseline"
```

From now on every `run` diffs against this snapshot and fails when a previously-passing trigger regresses — the routing drift you'd otherwise only notice in production. See [Regression detection](regression-detection.md).

## 6. Automate in CI

```yaml
- uses: ahnafyy/skills-evals@v0.2.0
```

That runs tiers 1 and 2 on every PR, so a regression fails the check instead of reaching a user. See [GitHub Action & CI](ci.md).

## Going further: behavioral evals

Tiers 1 and 2 prove a skill is well-formed and routable. **Tier 3** proves it still *works* — it runs the eval prompt through a real headless agent and grades what the agent actually did against your `expectations[]`.

```bash
npx skills-evals behavioral test-driven-development --dry-run   # plan only, no tokens
npx skills-evals behavioral test-driven-development             # spends tokens
```

It's opt-in and belongs on a schedule rather than every PR. See [Behavioral evals](behavioral-evals.md).

