# Eval case format

One JSON file per artifact: `evals/cases/<name>.json`. The filename must match the artifact name.

```json
{
  "artifact": "test-driven-development",
  "kind": "skill",
  "trigger": {
    "positive": [
      { "prompt": "Write a failing test for this bug before fixing it", "top_k": 1 },
      { "prompt": "Fix the rounding bug in invoice totals, test-first" },
      { "prompt": "Add test coverage before refactoring this module" }
    ],
    "negative": [
      { "prompt": "Draft a commit message for these changes", "owner": "commit-messages" },
      { "prompt": "Write a conventional commit summarizing this git history", "owner": "commit-messages" }
    ]
  },
  "evals": [
    {
      "id": 1,
      "prompt": "Fix the reported rounding bug in the invoice totals, test-first.",
      "expected_output": "A failing test demonstrating the bug, a minimal fix, full suite passing",
      "files": ["invoice-app/"],
      "expectations": [
        "A failing test is written and shown failing before the fix",
        "The implementation is the minimum needed to pass",
        "The full suite is run after the fix to catch regressions"
      ],
      "trust_level": "provisional"
    }
  ]
}
```

## Fields

### `artifact` (required)

The artifact's name. Must match the filename. `skill_name` is accepted as an alias for compatibility with existing skill-creator case files.

### `kind` (optional)

Only needed when the same name exists in multiple kinds (e.g. a skill and a Claude agent both named `code-review`).

### `trigger.positive`

Realistic user asks that **should** route to this artifact.

- `prompt` — for description-routed artifacts. Must rank within `top_k` (default 3) against every other artifact of the same kind. Tighten to `"top_k": 1` for a signature ask.
- `path` — for glob-routed artifacts (`applyTo`, Cursor `globs`). The path must match the routing globs.

> **Writing good positive prompts:** paraphrase how users actually talk; don't copy the description — that's gaming the eval. If a realistic prompt can't rank because the description lacks its vocabulary, that is a *real finding* — improve the description, not the prompt.

### `trigger.negative`

Asks that belong to a **different** artifact. This artifact must not rank #1 for them.

- `owner` — the name of the artifact the prompt *does* belong to (same kind). Declaring it turns the negative into a real pairwise routing test: the owner must outrank this artifact. Without an owner, a negative can pass vacuously when the prompt matches nothing at all.
- `path` — for glob-routed artifacts: the path must **not** match.

### `evals[]`

[Anthropic skill-creator's `evals.json` schema](https://github.com/anthropics/skills/tree/main/skills/skill-creator), verbatim — so skill-creator tooling (`run_eval.py`, the eval viewer, benchmark comparisons) works against these files unmodified.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | integer | Unique within the file |
| `prompt` | string | The task given to the agent |
| `expected_output` | string | Human description of a correct result |
| `files` | string[] | Optional fixture paths, materialized from `evals/fixtures/` into the throwaway workspace |
| `expectations` | string[] | Verifiable statements a grader checks against the transcript — behaviors, not phrasings |
| `trust_level` | string | `"provisional"` marks an eval with no fixtures yet; treat its pass rate as a sanity check, not evidence |

## Minimums

Each case file should have at least **3 positive** triggers, **2 negative** triggers, and **1 behavioral** eval (configurable). Below-minimum files get a warning, not an error.

## Scaffolding

`skills-evals init` writes a stub case file for every skill, agent, and rule that doesn't have one — including the right trigger shape (`prompt` vs `path`) for the artifact's routing mode.
