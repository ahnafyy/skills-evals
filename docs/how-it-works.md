# How it works

## The pipeline

```
 discover ──► normalize ──► Tier 1 ──► Tier 2 ──► baseline diff ──► exit code
                                             │
                                             └──► Tier 3 (scheduled, real agent)
```

1. **Discover** — walk the repo for every supported artifact file (skipping `node_modules`, build output, etc.).
2. **Normalize** — parse each format into one shared shape, so every check works uniformly across formats:

```js
{
  kind: 'skill' | 'instructions' | 'copilot-agent' | 'claude-agent' | 'cursor-rule' | 'prompt',
  name: 'test-driven-development',
  key:  'skill:test-driven-development',      // identity within the catalog
  description: '…',                            // the routing text agents choose by
  body: '…',                                   // markdown after frontmatter
  routing: { mode: 'description' | 'glob' | 'always' | 'manual', globs: [...] },
}
```

3. **Run the tiers** against the catalog and the eval case files in `evals/cases/`.

## The three tiers

| Tier | What it checks | Where | Cost |
| --- | --- | --- | --- |
| 1. Structural | Frontmatter, naming, description limits, trigger phrases, glob validity | CI | Free |
| 2. Trigger & routing | Positive prompts rank their artifact top-k; negatives don't; no description collisions | CI | Free |
| 3. Behavioral | An agent following the artifact satisfies its `expectations[]` | Scheduled CI | A cheap model run |

### Tier 1 — structural

Deterministic per-kind lint rules. Examples:

- a `SKILL.md` must have `name` and `description` frontmatter, the name must match its directory, and the description must fit in 1024 chars (agents inject it into the system prompt);
- a skill description without a *"Use when …"* clause gets a warning — agents can't route to a skill that never says when it applies;
- a Claude agent without a `description` is an error — Claude uses it to decide when to delegate;
- an `.instructions.md` without `applyTo` warns that it applies to *every* request;
- duplicate names within a kind are a catalog error.

### Tier 2 — trigger & routing

A deterministic **lexical approximation of routing**: stemmed TF-IDF over descriptions, scored by cosine similarity. It cannot judge semantics — that's Tier 3's job — but it catches the two failure modes that dominate real trigger bugs:

- **false negative** — a description missing the vocabulary users actually say (your positive prompt can't rank);
- **false positive** — an over-broad description that outranks the right artifact (your negative prompt ranks #1).

Key design points:

**Routing pools.** Artifacts only compete against others of their own kind — skills against skills, Claude agents against Claude agents. A skill and a Cursor rule with similar descriptions is not a collision, because no router ever chooses between them.

**Owner-declared negatives.** A negative prompt with an `owner` becomes a *pairwise routing test*: the declared owner must outrank this artifact for that prompt. Without an owner, a negative can pass vacuously when the prompt matches nothing at all.

**Path triggers for glob-routed artifacts.** `.instructions.md` (`applyTo`) and Cursor rules (`globs`) don't route by description — they route by file path. Their eval cases use `{ "path": "src/app/index.ts" }` entries tested against the routing globs.

**Collision detection.** Every pair of descriptions in a pool is compared; ≥ 75% similarity is an error, ≥ 50% a warning. This is the guard against overlapping artifacts drifting in over time.

**Rank-1 rate.** The share of positive prompts that rank their artifact *first* (not merely top-k). A falling number means descriptions are drifting toward each other — the baseline tracks it.

### Tier 3 — behavioral

Runs each eval prompt through a real headless agent (Claude Code by default) in a throwaway workspace, captures the **execution trace** — tool calls included, not just prose — and has an LLM grader judge the trace against your `expectations[]`. Grading what the agent *did*, not what it *claims*, is the entire point: "a failing test was run before the fix" is checked against actual tool calls. See [Behavioral evals](behavioral-evals.md).

## Why lexical instead of embeddings?

Tier 2 must be **deterministic** (same input → same result, byte for byte), **free** (runs on every push), and **dependency-less**. Embeddings are none of those. A Tier-2 failure almost always means *fix the description* — the vocabulary users say isn't in it, or another description stole it — and TF-IDF pinpoints that precisely. Semantic judgment is deferred to Tier 3, where you're already paying for a model.

## Exit codes

Every CI-facing command exits `1` on any error-level finding and `0` otherwise, so wiring it into CI is a one-liner.
