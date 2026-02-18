# 036 - Frame Limiter Toggle for Performance Widget

## Context
- Date: 2026-02-18
- Prompt Source: uncapped FPS measurement request
- LLM: GPT-5.2-Codex

## Requirements
1. Add a `Frame limiter` checkbox to the performance widget/dialog controls.
2. Frame limiter defaults to enabled so normal gameplay remains refresh-rate-capped.
3. When frame limiter is disabled, game-loop scheduling must switch from `requestAnimationFrame` pacing to uncapped timer pacing so FPS reflects bare loop throughput.
4. FPS overlay should clearly show whether the reported FPS is `capped` or `uncapped`.
5. The system must keep pause/render flow and existing loop behavior functional while allowing runtime limiter toggling.

## Validation Notes
- Unit tests should cover scheduling mode selection (`requestAnimationFrame` vs `setTimeout`) and timeout cleanup on stop.
- Lint auto-fix must be run on changed files.
