# Spec 033: Changed-Files Lint Fix Workflow

## Summary
Introduce a lint-fix command that only processes files changed in the current git working tree, and align agent instructions to use that command.

## Requirements
- Add an npm script named `lint:fix:changed` in `package.json`.
- Implement command behavior to:
  - detect changed files using git status,
  - parse git porcelain status lines without dropping leading status spaces (so unstaged entries like ` M file.js` keep the full filename),
  - include only lintable JavaScript files (`.js`, `.mjs`, `.cjs`) in project root, `src/`, or `tests/`,
  - run eslint with `--fix` only against that filtered set,
  - no-op successfully when no lintable changed files exist.
- Update `AGENTS.md` rule 2 so agents run `npm run lint:fix:changed` after code implementation instead of `npm run lint:fix`.

## Acceptance Criteria
- Running `npm run lint:fix:changed` exits successfully with a clear message when no lintable files are changed.
- Running `npm run lint:fix:changed` on a branch with changed lintable files invokes eslint only for those paths.
- Root-level changed files (including unstaged ` M ...` entries) are passed to eslint with exact filenames and no missing leading characters.
- `AGENTS.md` contains the updated lint command reference.
