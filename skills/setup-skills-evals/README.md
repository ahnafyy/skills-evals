# The setup-skills-evals skill

An installable skill that teaches **any** agent (Claude Code, GitHub Copilot, Cursor, Codex, …) how to set up `skills-evals` in your repo. It inventories your artifacts, interviews you about what to test, fills in eval cases from your answers, and wires up CI plus whichever local runner you use (npm, Gradle, Make, or a plain `.sh`).

## Install

**With the [skills.sh](https://skills.sh) CLI** (picks the right location for your agent):

```bash
npx skills add ahnafyy/skills-evals
```

**Manually — Claude Code:**

```bash
mkdir -p .claude/skills/setup-skills-evals
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .claude/skills/setup-skills-evals/SKILL.md
```

**Manually — GitHub Copilot:**

```bash
mkdir -p .github/skills/setup-skills-evals
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .github/skills/setup-skills-evals/SKILL.md
```

**Manually — Cursor:**

```bash
mkdir -p .cursor/skills/setup-skills-evals
curl -fsSL https://raw.githubusercontent.com/ahnafyy/skills-evals/main/skills/setup-skills-evals/SKILL.md \
  -o .cursor/skills/setup-skills-evals/SKILL.md
```

Then ask your agent: *"set up skills-evals in this repo"*.
