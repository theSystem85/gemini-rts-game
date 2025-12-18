# Prompt History - Rocket Tank Damage Balance

**Timestamp:** 2025-12-18T12:00:00Z
**LLM:** Gemini 3 Flash (Preview)

## User Request
ensure one rocket from the rocket tank makes 23% damage on a normal tank

## Changes
- Modified `src/game/bulletSystem.js` to adjust rocket tank damage against tank-type units.
- Set a fixed damage multiplier for rocket tank projectiles hitting tanks to ensure exactly 23 damage (23% of 100 HP) for front hits.
- Updated `TODO.md` with the new requirement and other recent rocket tank improvements.

## Technical Details
- `BULLET_DAMAGES.rocketTank` is 120.
- `UNIT_PROPERTIES.tank_v1.health` is 100.
- Multiplier used: `23 / 120` (~0.1917).
- This multiplier bypasses the standard 0.8-1.2 randomization for this specific unit interaction to ensure the requested 23% damage value.
