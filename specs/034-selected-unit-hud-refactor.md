# 034 - Selected Unit HUD Refactor

## Summary
Refactor the selected-unit HUD to improve readability and reduce occlusion of the selected unit sprite.

## Requirements
1. Selection outline must be a **1px yellow** rectangle.
2. HUD stat indicators for **ammo, hp, fuel, load, xp** must:
   - be **3px thick**,
   - have **no border**,
   - use a **dark grey background**,
   - align so the selection outline runs through the **centerline** of each 3px indicator.
3. Crew indicator must be rendered **below** the bottom indicator bar.
4. XP bar becomes the **bottom** indicator bar.
5. XP stars must be rendered **directly over the HP bar**, overlapping by approximately **33%**.
6. Selected-unit HUD footprint should be **larger than a tile** so HUD indicators do not occlude the selected unit body.

## Affected area
- `src/rendering/unitRenderer.js`

## Acceptance checks
- Select a unit with all relevant indicators available and verify all five indicators appear at 3px thickness.
- Confirm the outline is exactly 1px and centered through each indicator strip.
- Confirm crew pips render below the bottom indicator strip.
- Confirm XP stars overlap HP strip by about one-third.
- Confirm the larger HUD perimeter leaves visible space around the unit sprite.
## Follow-up adjustments
7. Each edge bar span (horizontal/vertical) must be capped at **75% of one tile** so the selection outline remains visible around bar endpoints.
8. Crew indicators must be **centered horizontally** beneath the bottom status bar.

## Settings integration
9. Add a Settings modal dropdown allowing users to switch selected-unit HUD rendering mode with options:
   - classic pre-refactor HUD
   - current modern HUD
   - modern HUD without yellow border and with crew symbols distributed at the 4 HUD corners
10. Persist the selected HUD style in local storage and apply it on load.

