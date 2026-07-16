'use strict';

/**
 * Executor adapter registry.
 *
 * An adapter is a plain object:
 *   {
 *     name:      string,
 *     bin:       string,   // binary expected on PATH
 *     traceKind: 'stream-json' | 'text',
 *     run({ prompt, systemPrompt, cwd, tools, timeoutMs }): string,  // trace
 *     judge(prompt, { timeoutMs }): string,                          // raw grading
 *   }
 *
 * Register custom adapters programmatically with registerAdapter().
 */

const adapters = {
  claude: require('./claude'),
  copilot: require('./copilot'),
  cursor: require('./cursor'),
};

function getAdapter(name) {
  const a = adapters[name];
  if (!a) {
    throw new Error(`Unknown adapter "${name}". Available: ${Object.keys(adapters).join(', ')}`);
  }
  return a;
}

function registerAdapter(adapter) {
  if (!adapter || typeof adapter.name !== 'string' || typeof adapter.run !== 'function' || typeof adapter.judge !== 'function') {
    throw new Error('An adapter needs { name, traceKind, run(), judge() }');
  }
  adapters[adapter.name] = adapter;
}

module.exports = { adapters, getAdapter, registerAdapter };
