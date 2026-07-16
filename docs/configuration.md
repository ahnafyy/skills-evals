# Configuration

Everything works with zero configuration. To customize, add `skills-evals.config.json` at the repo root:

```json
{
  "casesDir": "evals/cases",
  "fixturesDir": "evals/fixtures",
  "resultsDir": ".skills-evals/results",
  "baselineFile": ".skills-evals/baseline.json",
  "topK": 3,
  "collisionWarn": 0.5,
  "collisionError": 0.75,
  "minPositive": 3,
  "minNegative": 2,
  "minEvals": 1,
  "coverageKinds": ["skill", "copilot-agent", "claude-agent", "cursor-rule"],
  "exclude": ["examples/**", "test/fixtures/**"],
  "behavioral": {
    "adapter": "claude",
    "grader": null,
    "tools": "Read,Glob,Grep,Edit,Write,Bash",
    "executorTimeoutMs": 900000,
    "graderTimeoutMs": 300000
  }
}
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `casesDir` | `evals/cases` | Where eval case files live |
| `fixturesDir` | `evals/fixtures` | Where behavioral fixtures live |
| `resultsDir` | `.skills-evals/results` | Behavioral grading output (gitignore this) |
| `baselineFile` | `.skills-evals/baseline.json` | Regression snapshot (commit this) |
| `topK` | `3` | Default rank threshold for positive prompt triggers |
| `collisionWarn` | `0.5` | Description cosine similarity that warns |
| `collisionError` | `0.75` | Description cosine similarity that errors |
| `minPositive` / `minNegative` / `minEvals` | `3` / `2` / `1` | Per-case-file minimums (below → warning) |
| `coverageKinds` | skills + agents + rules | Kinds that warn when no case file exists |
| `exclude` | `[]` | Glob patterns of paths to skip during discovery |

## `behavioral` options

| Option | Default | Meaning |
| --- | --- | --- |
| `adapter` | `claude` | Executor adapter (`claude`, `copilot`, `cursor`, or a registered custom one) |
| `grader` | executor | Grader adapter — `claude` recommended for large traces |
| `tools` | `Read,Glob,Grep,Edit,Write,Bash` | Tool allowlist for the claude executor. Review it if your fixtures invoke anything unusual. |
| `executorTimeoutMs` | 15 min | Executor timeout per eval |
| `graderTimeoutMs` | 5 min | Grader timeout per eval |

CLI flags (`--adapter`, `--grader`) override the config file.
