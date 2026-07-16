# Supported formats

`skills-evals` discovers and normalizes six artifact formats across GitHub Copilot, Claude Code, and Cursor.

| Kind | Files discovered | Routing |
| --- | --- | --- |
| `skill` | `**/SKILL.md` | description |
| `instructions` | `.github/copilot-instructions.md`, `**/*.instructions.md`, `AGENTS.md` | always / `applyTo` globs |
| `copilot-agent` | `**/*.agent.md`, `.github/agents/*.md` | description |
| `claude-agent` | `.claude/agents/*.md` | description |
| `cursor-rule` | `.cursor/rules/**/*.mdc` | `alwaysApply` / `globs` / description |
| `prompt` | `**/*.prompt.md` | manual |

Discovery skips `node_modules`, `.git`, build output, and other non-source directories. Additional paths can be excluded with the [`exclude` config](configuration.md).

## Routing modes

The **routing mode** determines which trigger tests apply to an artifact:

| Mode | Meaning | Trigger tests |
| --- | --- | --- |
| `description` | An agent chooses it by matching the user's ask against the description | `prompt` triggers, ranked within the kind's pool |
| `glob` | Activated when a matching file is in context (`applyTo`, `globs`) | `path` triggers, matched against the globs |
| `always` | Injected into every request | none (always active) |
| `manual` | Explicitly invoked by the user (`/prompt-name`, `@ruleName`) | none (behavioral evals still apply) |

## Format notes

### Skills (`SKILL.md`) — Claude & Copilot

The [Anthropic skills format](https://github.com/anthropics/skills), also used by GitHub Copilot. Frontmatter requires `name` (matching the parent directory, kebab-case) and `description` (≤ 1024 chars). The description should contain a *"Use when …"* clause — it's the only signal an agent has for routing.

### Copilot instructions

- `.github/copilot-instructions.md` — always-on, repo-wide.
- `*.instructions.md` — scoped by an `applyTo` frontmatter glob (e.g. `"**/*.ts,**/*.tsx"`). Without `applyTo` they apply always, which earns a warning.
- `AGENTS.md` — always-on; nested `AGENTS.md` files are discovered too and named by their directory (`packages/api/AGENTS`).

### Copilot custom agents

Both conventions are discovered:

- `*.agent.md` anywhere — the VS Code custom agent format;
- `.github/agents/<name>.md` — the Copilot coding agent format on github.com (`README.md` is ignored).

The `description` is shown in the agent picker and used for routing; missing one is a warning.

### Claude custom agents (`.claude/agents/*.md`)

Frontmatter requires `name` and `description` — Claude uses the description to decide when to *delegate* to the agent, which makes it exactly as routing-critical as a skill description.

### Cursor rules (`.cursor/rules/*.mdc`)

Routing depends on frontmatter: `alwaysApply: true` → always; `globs:` → glob; a bare `description` → agent-requested (description routing); none of the three → manual-only (warned).

### Prompt files (`*.prompt.md`)

Invoked explicitly by name, so they get no trigger tests — but Tier 1 validation and Tier 3 behavioral evals still apply.
