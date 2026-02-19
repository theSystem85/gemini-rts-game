# 038 - Performance Widgets Layout + Toggle Refactor

## Context
- Date: 2026-02-19
- Prompt Source: follow-up fixes for dual frame/performance widgets
- LLM: GPT-5.2-Codex

## Requirements
1. Place both FPS/performance widgets below the top-right notification bell.
2. Ensure the in-game FPS overlay does not overlap the HTML debug performance dialog.
3. Move the frame limiter checkbox from performance dialog into Settings modal.
4. Sidebar `performanceWidgetBtn` must toggle the in-game FPS/canvas-adjacent overlay (not the HTML debug dialog).
5. Remove LLM API cost/tokens block from HTML debug widget while preserving LLM usage display in the primary FPS overlay.

## Validation Notes
- Verify sidebar button behavior via keyboard handler tests.
- Run `npm run lint:fix:changed` and relevant unit tests.
