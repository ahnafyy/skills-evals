'use strict';

/**
 * Cursor CLI adapter (best-effort), using `cursor-agent`.
 *
 * Limitations vs the claude adapter:
 *   - no --append-system-prompt: the artifact is prepended to the prompt;
 *   - the trace is the final response text (traceKind 'text'), so the
 *     grader judges conservatively;
 *   - grader prompts are truncated to stay under argv size limits. Prefer
 *     `--grader claude` for grading large traces.
 */

const { execFileSync } = require('child_process');

const ARGV_SAFE_LIMIT = 180 * 1024;

function truncate(s, limit) {
  return s.length > limit ? `${s.slice(0, limit)}\n\n[...truncated for argv size limits...]` : s;
}

module.exports = {
  name: 'cursor',
  bin: 'cursor-agent',
  traceKind: 'text',

  run({ prompt, systemPrompt, cwd, timeoutMs }) {
    const full = `${systemPrompt}\n\n---\n\nTask:\n${prompt}`;
    return execFileSync(
      'cursor-agent',
      ['-p', '--output-format', 'text', full],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd, timeout: timeoutMs },
    );
  },

  judge(prompt, { timeoutMs }) {
    return execFileSync('cursor-agent', ['-p', '--output-format', 'text', truncate(prompt, ARGV_SAFE_LIMIT)], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
  },
};
