# Spec 042: Radar Offline Animation Settings Toggle

## Goal
Allow players to enable/disable the minimap radar-offline animation from the Settings modal and ensure the white grain behaves like animated/flickering TV snow when enabled.

## Requirements
1. Add a Settings modal checkbox for radar-offline grain animation.
2. The checkbox state must immediately affect rendering behavior.
3. Persist the checkbox state so it survives reloads.
4. When enabled, radar-offline grain must visibly move/flicker (not only static overlay).
5. When disabled, the offline warning panel remains visible but without animated grain motion.

## Acceptance Criteria
- Settings modal contains a labeled radar-offline animation toggle.
- Toggling ON/OFF updates the minimap offline effect without restarting.
- Preference is restored from localStorage on startup.
- Enabled mode shows clear analog-style moving/flickering white snow.
