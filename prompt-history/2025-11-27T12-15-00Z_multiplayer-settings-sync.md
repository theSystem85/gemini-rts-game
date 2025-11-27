# Prompt History Entry

**UTC Timestamp:** 2025-11-27T12:15:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Request

In multiplayer ensure that on all clients the ore_spread_enabled and shadow of war settings cannot be changed and are inherited by the hosts game settings. Ensure that explosions are not visible when below fog of war (currently they are not).

## Changes Made

### 1. `src/network/gameCommandSync.js`

- Added import for `ORE_SPREAD_ENABLED` and `setOreSpreadEnabled` from config.js
- Extended `createGameStateSnapshot()` to include `oreSpreadEnabled` and `shadowOfWarEnabled` in the snapshot sent from host to clients
- Updated `applyGameStateSnapshot()` to:
  - Sync `oreSpreadEnabled` from host using `setOreSpreadEnabled()`
  - Sync `shadowOfWarEnabled` from host to `gameState.shadowOfWarEnabled`
  - Update the corresponding checkbox UI elements to reflect host settings

### 2. `src/ui/remoteInviteLanding.js`

- Updated `hideMapSettingsForClient()` to:
  - Disable the ore spread checkbox (`oreSpreadCheckbox`)
  - Disable the shadow of war checkbox (`shadowOfWarCheckbox`)
  - Add "(host setting)" indicator text next to each disabled checkbox
- Updated `showMapSettings()` to:
  - Re-enable both checkboxes when client disconnects
  - Remove the "(host setting)" indicator text

### 3. `src/rendering/effectsRenderer.js`

- Updated `renderExplosions()` to check fog of war visibility before rendering explosions
- Added `isExplosionVisible()` helper function that:
  - Returns true if shadow of war is disabled
  - Checks the visibility map for the explosion's tile position
  - Only renders explosions on tiles that are currently visible to the player

## Summary

This implementation ensures:
1. **Host authority over game settings**: Ore spread and shadow of war settings are synced from host to all clients
2. **Client UI indicates host control**: Checkboxes are disabled with "(host setting)" labels
3. **Proper cleanup on disconnect**: When a client disconnects, checkboxes are re-enabled
4. **Fog of war explosion hiding**: Explosions in unexplored/invisible areas are not rendered when shadow of war is enabled
