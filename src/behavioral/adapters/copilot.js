'use strict';

/**
 * GitHub Copilot CLI adapter (best-effort).
 *
 * Limitations vs the claude adapter:
 *   - no --append-system-prompt: the artifact is prepended to the prompt;
 *   - no machine-readable tool-call trace: the trace is the final response
 *     text, so grading fidelity is lower (traceKind 'text' tells the grader
 *     to judge conservatively);
 *   - prompts are passed via argv, so oversized grader prompts are truncated
 *     defensively. Prefer `--grader claude` for grading large traces.
 */

const { execFileSync } = require('child_process');

const ARGV_SAFE_LIMIT = 180 * 1024;

function truncate(s, limit) {
  return s.length > limit ? `${s.slice(0, limit)}\n\n[...truncated for argv size limits...]` : s;
}

module.exports = {
  name: 'copilot',
  bin: 'copilot',
  traceKind: 'text',

  run({ prompt, systemPrompt, cwd, timeoutMs }) {
    const full = `${systemPrompt}\n\n---\n\nTask:\n${prompt}`;
    return execFileSync(
      'copilot',
      ['-p', full, '--allow-all-tools'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd, timeout: timeoutMs },
    );
  },

  judge(prompt, { timeoutMs }) {
    return execFileSync('copilot', ['-p', truncate(prompt, ARGV_SAFE_LIMIT)], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
  },
};
