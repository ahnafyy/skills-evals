# Behavioral evals (Tier 3)

Tier 3 answers the question the other tiers can't: **does an agent following this artifact actually behave the way it promises?** It runs each eval prompt through a real headless agent and grades the execution trace against your `expectations[]`.

**This is where the real value is.** Tiers 1 and 2 prove a skill is well-formed and routable; only Tier 3 proves it still *works* after your codebase or the underlying model changes. Run it on a schedule (nightly or weekly) so that drift surfaces on its own — see [CI](ci.md) for the scheduled workflow this repo uses. It's kept out of `run` so PR CI stays instant and free, not because it's something to avoid.

Keep it cheap so you keep it running: point the executor and grader at a small, fast model. Most expectations are about *which actions the agent took* ("a failing test was run before the fix"), and cheap models judge that reliably — you rarely need a frontier model here.

```bash
skills-evals behavioral test-driven-development --dry-run   # print the plan, no model call
skills-evals behavioral test-driven-development             # execute + grade
skills-evals behavioral my-skill --adapter copilot --grader claude
```

## How a behavioral eval runs

1. **Throwaway workspace** — a fresh temp dir per eval. Fixtures listed in the eval's `files[]` are copied in from `evals/fixtures/` (paths are jailed; no escaping the workspace), so the agent has real code to operate on rather than describing what it would do.
2. **Execution** — the artifact's full content is attached as a system prompt (*"Follow this skill exactly: …"*) and the eval `prompt` runs through the executor adapter. With the `claude` adapter, the agent gets an explicit permission mode and tool allowlist so it can genuinely edit files and run commands — without that, headless denials force the exact narrate-instead-of-perform failure mode that trace grading exists to catch.
3. **Trace capture** — the full execution trace, tool calls included. Grading judges **what happened**, not what the model narrates.
4. **Grading** — an LLM judge receives the expectations and the trace. The trace is fenced as untrusted data (prompt-injection containment) and piped over stdin — traces can be megabytes, and argv would hit the OS argument-size limit. Grader output is validated as JSON before being trusted.
5. **Results** — written to `.skills-evals/results/<name>.eval-<id>.grading.json` (gitignored) in skill-creator's `grading.json` shape.

## Executor adapters

| Adapter | Binary | Trace | Grading fidelity |
| --- | --- | --- | --- |
| `claude` (default) | `claude` | stream-json with tool calls | **Full** — expectations like "a failing test was run before the fix" are judged against actual tool calls |
| `copilot` | `copilot` | final response text | Degraded — no machine-readable tool trace; the grader is told to judge conservatively |
| `cursor` | `cursor-agent` | final response text | Degraded — same limitation |

The executor and grader are independent — `--grader claude` is recommended even when executing with another adapter, since the Claude adapter pipes grader prompts over stdin and never truncates.

## Custom adapters

Any runtime with a headless mode can be an executor:

```js
const { registerAdapter } = require('skills-evals');

registerAdapter({
  name: 'my-runtime',
  traceKind: 'text',            // or 'stream-json' if you emit tool calls
  run({ prompt, systemPrompt, cwd, tools, timeoutMs }) {
    // execute headlessly in cwd, return the trace as a string
  },
  judge(graderPrompt, { timeoutMs }) {
    // return the raw grading response
  },
});
```

## Trust levels

An eval with no `files[]` fixtures (or explicitly marked `"trust_level": "provisional"`) is flagged in the output: the agent had nothing real to operate on, so treat its pass rate as a sanity check, not evidence. Graduate it by adding fixtures.
