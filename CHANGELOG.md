# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-15

### Added
- Discovery now descends `.agents/` so the tool-agnostic `.agents/skills/**/SKILL.md`
  location is found, alongside the existing `.github/`, `.claude/`, and `.cursor/` folders.
- Scheduled `behavioral-evals` workflow that runs a real GitHub Copilot agent against
  the skills weekly (and on demand) and grades the execution trace.
- Regression baseline and eval cases for the bundled `setup-skills-evals` skill, run in CI.
- Workflow to publish the package to GitHub Packages (`@ahnafyy/skills-evals`).

### Changed
- `setup-skills-evals` install docs now use native Agent Skills locations instead of a
  third-party CLI: personal/global install (`~/.claude/skills/`, `~/.copilot/skills/`,
  `~/.agents/skills/`) is the default, with project-local install kept as the
  "commit for your team" option.
- Behavioral evals reframed as the high-value tier — meant to run on a schedule against
  a cheap model, not on every PR.
- Cursor guidance corrected: Cursor has no skills folder, so the helper installs as a
  `.cursor/rules/*.mdc` rule.

### Fixed
- Test script globs test files (`node --test test/*.test.js`) so discovery works on Node 22.

## [0.1.0] - 2026-07

### Added
- Initial release: three-tier evaluation for agent artifacts.
  - **Structural validation** of skills, instructions, custom agents, Cursor rules, and prompt files.
  - **Trigger routing** via stemmed TF-IDF + cosine similarity with collision detection and
    owner-declared negatives.
  - **Behavioral evals** through pluggable adapters (Claude, Copilot, Cursor), trace-graded.
- CLI (`skills-evals`), programmatic API, regression baselines, and a reusable GitHub Action.

[0.2.0]: https://github.com/ahnafyy/skills-evals/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ahnafyy/skills-evals/releases/tag/v0.1.0
