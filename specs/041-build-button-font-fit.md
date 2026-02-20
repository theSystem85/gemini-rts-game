# 041 - Build Button Font + Label Fit Guard

## Context
- Date: 2026-02-19
- Prompt Source: ensure new global font is also used on all build buttons, and use mobile-landscape short labels if text no longer fits
- LLM: GPT-5.2-Codex

## Requirements
1. Ensure production/build button labels render with the newly selected global futuristic font.
2. Keep build button labels readable when the new font metrics cause clipping.
3. Reuse existing mobile landscape short building labels when a default building label overflows its button label slot.
4. Keep mobile landscape behavior unchanged (always use short labels where already defined).

## Validation Notes
- Check production button styling for explicit font usage.
- Check label sync logic for overflow fallback to short labels.
- Run changed-file lint autofix.
