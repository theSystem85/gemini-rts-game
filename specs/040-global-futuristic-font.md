# 040 - Global Futuristic Font Refresh

## Context
- Date: 2026-02-19
- Prompt Source: implement a more interesting, slightly futuristic global game font without increasing text footprint
- LLM: GPT-5.2-Codex

## Requirements
1. Apply a globally consistent, more futuristic typeface across the game UI.
2. Keep readability and spatial footprint close to the current font sizing so layouts do not expand.
3. Use a font safe for open source usage.
4. Propagate font usage to canvas-rendered text where the old font stack was hardcoded.

## Validation Notes
- Ensure global CSS defaults use the new family and preserve sensible fallbacks.
- Verify key canvas/UI renderers no longer use hardcoded Arial defaults.
- Run changed-file lint autofix.
