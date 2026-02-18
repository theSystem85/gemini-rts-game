# Prompt History
- UTC: 2026-02-17T19-54-25Z
- LLM: GitHub Copilot (GPT-5.3-Codex)

## Prompt
- Enable GPU support for multiplayer Playwright browsers (WebGL-dependent game, observed 0% GPU usage) and make HOST/RED/YELLOW build progression run in parallel.

## Actions
- Added GPU acceleration launch defaults for multiplayer role browsers (GPU rasterization, zero-copy, WebGL, ANGLE Metal, ignore GPU blocklist, remove default `--disable-gpu`).
- Updated multiplayer runner to default to system Chrome channel (`PLAYWRIGHT_BROWSER_CHANNEL=chrome`) with GPU acceleration on by default (`PLAYWRIGHT_FORCE_GPU=1`), while preserving existing fallback behavior.
- Changed E2E progression from sequential `buildStackToTank` execution to `Promise.all` parallel execution for HOST/RED/YELLOW.
- Updated TODO/spec tracking for GPU acceleration and parallel build progression requirement.
