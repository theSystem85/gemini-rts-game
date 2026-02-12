# Spec 034: Sidebar Battle Intensity Indicator

## Summary
Add a compact tactical indicator above the money bar that estimates nearby enemy pressure and surfaces a color-coded threat level.

## Requirements
- Show a `Threat <LEVEL> · <SCORE>` pill above the money bar in desktop sidebar layouts.
- Recompute intensity whenever the money bar refreshes.
- Threat levels:
  - `CALM` for low pressure.
  - `CONTACT` for moderate pressure.
  - `SKIRMISH` for high pressure.
  - `CRITICAL` for immediate danger.
- Score should consider:
  - Enemy unit count and unit type threat weights.
  - Enemy proximity to friendly structures/factories.
  - Nearby hostile defensive structures.
- Provide tooltip/title metadata with counts of hostile units and defenses.

## UX Notes
- Keep styling in-universe (military HUD style with uppercase compact capsule).
- Use different border/text colors per level for fast recognition.
- Indicator must not block clicks on the money bar.

## Non-Goals
- No new gameplay mechanics; this is awareness/UI only.
- No minimap changes in this phase.
