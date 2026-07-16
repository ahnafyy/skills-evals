# The setup-skills-evals skill

An installable skill that teaches **any** Agent Skills-compatible agent (Claude Code, GitHub Copilot, Cursor, …) how to set up `skills-evals` in your repo. It inventories your artifacts, interviews you about what to test, fills in eval cases from your answers, and wires up CI plus whichever local runner you use (npm, Gradle, Make, or a plain `.sh`).

## Install

This is a native [Agent Skill](https://agentskills.io) — an open standard supported directly by Claude Code and GitHub Copilot. **No CLI or middleman needed:** drop the `SKILL.md` into a skills folder and it's discovered automatically by its `description`.

Since this skill *sets up other repos*, you almost always want it installed **once, globally**, so it's available in every project you open — not committed into any single repo.

### Recommended: install once for every repo (personal skill)

**Claude Code:**

```bash
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  --create-dirs -o ~/.claude/skills/setup-skills-evals/SKILL.md
```

**GitHub Copilot** (VS Code, CLI, cloud agent):

```bash
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  --create-dirs -o ~/.copilot/skills/setup-skills-evals/SKILL.md
```

> Prefer one folder for every agent? Both tools also read `~/.agents/skills/` — install there instead.

Open any repo and ask your agent: *"set up skills-evals in this repo"*.

### Or: install into a single repo (commit it for your team)

Use this if you want the setup helper checked into a specific project so everyone on the team gets it.

| Agent | Path (repo root) |
| --- | --- |
| Claude Code | `.claude/skills/setup-skills-evals/SKILL.md` |
| GitHub Copilot | `.github/skills/setup-skills-evals/SKILL.md` |
| Any Agent Skills agent | `.agents/skills/setup-skills-evals/SKILL.md` |
| Cursor (rules, not skills) | `.cursor/rules/setup-skills-evals.mdc` |

```bash
# example: Claude Code, committed into the current repo
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  --create-dirs -o .claude/skills/setup-skills-evals/SKILL.md
```

> Cursor has no skills folder — save it as a `.cursor/rules/*.mdc` rule. The `SKILL.md` frontmatter (`name`, `description`) is a valid rule header; add `alwaysApply: false` to be explicit.

> **Heads up:** if you commit this helper into a repo, `skills-evals` will discover it as one of *your* artifacts. If you don't want to write evals for the setup helper itself, add it to `exclude` in `skills-evals.config.json` — e.g. `{ "exclude": [".claude/skills/setup-skills-evals/**"] }`.

Then ask your agent: *"set up skills-evals in this repo"*.
