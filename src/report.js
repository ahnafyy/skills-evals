'use strict';

/** Console reporting helpers shared by CLI commands. */

function printFindings(findings, log = console.log) {
  for (const f of findings) {
    const icon = f.level === 'error' ? '  ✗ ' : f.level === 'warn' ? '  ⚠ ' : '  · ';
    log(`${icon} ${f.message}`);
  }
}

function countLevels(findings) {
  let errors = 0;
  let warnings = 0;
  for (const f of findings) {
    if (f.level === 'error') errors++;
    else if (f.level === 'warn') warnings++;
  }
  return { errors, warnings };
}

function summaryLine({ checked, errors, warnings }) {
  const status = errors > 0 ? 'FAILED' : warnings > 0 ? 'PASSED WITH WARNINGS' : 'PASSED';
  return `${checked} checked — ${errors} error(s), ${warnings} warning(s) — ${status}`;
}

module.exports = { printFindings, countLevels, summaryLine };
