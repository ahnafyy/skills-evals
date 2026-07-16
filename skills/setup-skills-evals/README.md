# The setup-skills-evals skill

An installable skill that teaches **any** agent (Claude Code, GitHub Copilot, Cursor, Codex, …) how to set up `skills-evals` in your repo. It inventories your artifacts, interviews you about what to test, fills in eval cases from your answers, and wires up CI plus whichever local runner you use (npm, Gradle, Make, or a plain `.sh`).

## Install

This is a native [Agent Skill](https://agentskills.io) — an open standard supported directly by Claude Code and GitHub Copilot. **No CLI or middleman needed:** drop the `SKILL.md` into your agent's skills folder and it's discovered automatically by its `description`.

**Claude Code** — loads project skills from `.claude/skills/`:

```bash
mkdir -p .claude/skills/setup-skills-evals
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .claude/skills/setup-skills-evals/SKILL.md
```

**GitHub Copilot** (VS Code, CLI, cloud agent) — natively scans `.github/skills/`:

```bash
mkdir -p .github/skills/setup-skills-evals
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .github/skills/setup-skills-evals/SKILL.md
```

**Cursor** — Cursor doesn't read a skills folder; its native mechanism is rules in `.cursor/rules/*.mdc`. Save the instructions there as an agent-requested rule:

```bash
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .cursor/rules/setup-skills-evals.mdc
```

> The `SKILL.md` frontmatter (`name`, `description`) is a valid Cursor rule header; Cursor loads it when the `description` matches your request. Add `alwaysApply: false` to be explicit.

**Any other Agent Skills-compatible agent** also reads the tool-agnostic `.agents/skills/` folder — use that if you prefer one location for every agent.

Then ask your agent: *"set up skills-evals in this repo"*.
