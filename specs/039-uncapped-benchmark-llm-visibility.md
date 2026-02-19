# 039 - Uncapped Benchmark FPS Fix + Conditional LLM Overlay Rows

## Context
- Date: 2026-02-19
- Prompt Source: follow-up bugfix for uncapped benchmark report and LLM stats visibility
- LLM: GPT-5.2-Codex

## Requirements
1. In the FPS/canvas performance overlay, show LLM token/cost rows only when LLM is enabled.
2. Keep HTML debug performance dialog free of LLM cost/token summary.
3. Fix benchmark tracker sampling so uncapped mode (frame limiter OFF) does not generate all-zero FPS points in the final benchmark report chart.
4. Handle duplicate/non-increasing timestamps safely by normalizing benchmark timing to monotonic values.

## Validation Notes
- Update benchmark tracker unit tests to cover near-zero frame-time normalization and duplicate timestamp handling.
- Run lint autofix and targeted unit suites.
