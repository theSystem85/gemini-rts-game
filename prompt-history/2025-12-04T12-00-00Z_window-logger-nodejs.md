# Prompt History Entry

**UTC Timestamp:** 2025-12-04T12:00:00Z
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Prompt

> ensure that window.logger is not used in any server (node.js) context

## Summary

Audit and fix all Node.js scripts and server-side code to replace `window.logger` calls with `console.log` or `console.warn` since `window` is a browser-only global object.

## Files Changed

- `scripts/bump-version.js` - Replaced `window.logger` with `console.log`
- `scripts/generate-version.js` - Replaced `window.logger` with `console.log`
- `scripts/generateMission01.js` - Replaced `window.logger` with `console.log`
- `scripts/fixMission01.cjs` - Replaced `window.logger` with `console.log`
- `makeSprites.js` - Replaced `window.logger` with `console.log`
- `map_analyse.js` - Replaced `window.logger` and `window.logger.warn` with `console.log` and `console.warn`
