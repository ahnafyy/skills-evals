'use strict';

/**
 * Throwaway workspace materialization for behavioral evals. Fixtures listed
 * in an eval's files[] are copied out of the fixtures dir into a fresh tmp
 * dir so the agent has real code to operate on rather than describing what
 * it would do. Fixture paths are jailed to their roots.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveFixturePath(root, rel) {
  if (path.isAbsolute(rel)) {
    throw new Error(`fixture path must be relative: ${rel}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, rel);
  const back = path.relative(resolvedRoot, resolvedPath);
  if (back === '' || back === '..' || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    throw new Error(`fixture path escapes workspace: ${rel}`);
  }
  return resolvedPath;
}

/** Create a fresh throwaway workspace for one eval, copying in its fixtures. */
function materializeWorkspace(ev, fixturesDir) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-evals-'));
  for (const rel of ev.files || []) {
    const src = resolveFixturePath(fixturesDir, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`fixture listed in files[] not found: ${path.relative(process.cwd(), src)}`);
    }
    const dest = resolveFixturePath(workspace, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
  }
  return workspace;
}

module.exports = { resolveFixturePath, materializeWorkspace };
