# Regression detection

The core problem `skills-evals` exists to solve: **you don't find out your skills stopped working until an agent behaves badly in front of a user.** Baselines turn that silent failure into a CI failure with the exact prompt that regressed.

## Workflow

```bash
# 1. Snapshot the current, known-good state
skills-evals run --update-baseline

# 2. Commit it
git add .skills-evals/baseline.json
git commit -m "chore: eval baseline"

# 3. Every later run diffs against the snapshot automatically
skills-evals run
```

## What the baseline stores

`.skills-evals/baseline.json` contains:

- **every trigger outcome** — each positive/negative prompt or path, its rank, and whether it passed;
- **a content hash of every artifact** (description + body);
- **collision pairs** present at snapshot time;
- **the rank-1 rate** — the share of positive prompts that rank their artifact first.

## The diff rules

The content hashes are what make the diff smart — they let it distinguish *you changed the artifact* from *something else changed around it*:

| Change since baseline | Severity | Why |
| --- | --- | --- |
| Passing trigger now fails, artifact **unchanged** | **error** | Catalog drift — another artifact now wins this routing. You didn't touch anything; someone else's description hijacked your prompt. |
| Passing trigger now fails, artifact **changed** | warning | Expected churn — you edited it. Review the failure, then re-baseline. |
| New description collision | **error** | Two artifacts drifted into each other's vocabulary. |
| Rank-1 rate dropped | warning | Descriptions are converging; routing is getting less crisp. |
| Artifact or trigger removed | warning | Re-baseline if intentional. |
| Failing trigger now passes | improvement | Reported, never fails the run. |

## Example

A teammate adds `database-migrations` with the description *"Use when fixing bugs or writing tests during schema changes"*. Nothing in your `test-driven-development` skill changed — but on the next `skills-evals run`:

```
  ✗  test-driven-development: positive trigger regressed but the artifact did
     NOT change ("Write a failing test for this bug before fixing it")
     — catalog drift: another artifact now wins this routing
FAILED
```

CI fails on the PR that introduced the collision — not three months later in production.

## Re-baselining

After intentional changes, review the diff output and refresh the snapshot:

```bash
skills-evals run --update-baseline
```

Treat the baseline like a lockfile: commit it, update it deliberately, and review its diff in PRs.
