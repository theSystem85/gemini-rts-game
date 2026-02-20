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

## 2026-02-20 Update
- Prompt Source: apply Rajdhani to remaining sidebar controls/docs and enforce minimum readable size.
- LLM: GPT-5.3-Codex
- Added Scope:
	1. Build tabs on desktop and mobile use Rajdhani.
	2. Sidebar save-label and invite-link placeholders use Rajdhani.
	3. Sidebar invite/join controls and map settings buttons use Rajdhani.
	4. Sidebar input fields use Rajdhani.
	5. User documentation page uses Rajdhani throughout.
	6. Rajdhani-rendered CSS text in these scoped surfaces must not be smaller than 14px.
