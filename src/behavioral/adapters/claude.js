'use strict';

/**
 * Claude Code adapter — the reference executor. Headless `claude -p` with a
 * full stream-json execution trace (tool calls included), so the grader
 * judges observed behavior rather than self-reporting.
 */

const { execFileSync } = require('child_process');

module.exports = {
  name: 'claude',
  bin: 'claude',
  traceKind: 'stream-json',

  /**
   * Run one behavioral eval prompt.
   * An explicit permission mode + tool allowlist lets the agent actually
   * edit files and run commands in the throwaway workspace; without it,
   * headless denials would force the exact narrate-instead-of-perform
   * failure mode that trace grading exists to catch.
   */
  run({ prompt, systemPrompt, cwd, tools, timeoutMs }) {
    return execFileSync(
      'claude',
      [
        '-p', '--verbose', '--output-format', 'stream-json',
        '--permission-mode', 'acceptEdits',
        '--allowedTools', tools,
        '--append-system-prompt', systemPrompt,
      ],
      { input: prompt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd, timeout: timeoutMs },
    );
  },

  /**
   * LLM-as-judge. The grader prompt is piped via stdin, never argv — traces
   * can be megabytes and argv would hit the OS argument-size limit (E2BIG).
   */
  judge(prompt, { timeoutMs }) {
    return execFileSync('claude', ['-p'], {
      input: prompt,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
  },
};
