# CLI reference

```
skills-evals <command> [flags]
```

## Global flags

| Flag | Meaning |
| --- | --- |
| `--root <dir>` | Repo root to scan (default: cwd) |
| `--json` | Machine-readable output (`list`, `validate`, `run`) |

## `skills-evals list`

Show every discovered artifact with its kind, routing mode, and path.

```bash
skills-evals list
skills-evals list --json
```

## `skills-evals validate`

Tier 1 — structural checks. Free, deterministic, CI-safe. Exits 1 on any error-level finding.

```bash
skills-evals validate
```

```
Validating 9 artifact(s)

  ✓  commit-messages (skill)
  ✗  my-agent (claude-agent)
       ERROR: Frontmatter missing required field: 'description' — Claude uses it
       to decide when to delegate to this agent

9 artifacts checked — 1 error(s), 0 warning(s) — FAILED
```

## `skills-evals run`

Tiers 1 + 2, plus the baseline regression diff when a baseline exists. Free, deterministic, CI-safe.

```bash
skills-evals run
skills-evals run --update-baseline   # snapshot current results, then commit the file
skills-evals run --json
```

Output includes the **trigger rank-1 rate** — the share of positive prompts that rank their artifact first. Falling numbers mean descriptions are drifting toward each other.

## `skills-evals init`

Scaffold an eval case stub for every skill, agent, and rule without one. Stubs match the artifact's routing mode (`prompt` triggers for description routing, `path` triggers for glob routing).

```bash
skills-evals init
```

## `skills-evals behavioral <name>`

Tier 3 — run and grade the behavioral evals for one artifact. **Spends tokens.**

```bash
skills-evals behavioral my-skill
skills-evals behavioral my-skill --dry-run             # print the plan only
skills-evals behavioral my-skill --adapter copilot     # executor: claude|copilot|cursor
skills-evals behavioral my-skill --grader claude       # grader (default: same as executor)
```

Gradings are written to `.skills-evals/results/` (gitignored). Exits 1 when any eval has failing expectations.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No error-level findings |
| 1 | At least one error-level finding (or invalid usage) |

Warnings never affect the exit code.
