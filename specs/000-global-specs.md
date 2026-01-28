# Global Game Specifications

This document contains global specifications that apply across the entire game.

## Measurement Units and Scale

### Tile-to-Meters Conversion

The game uses a dual scale system for different purposes:

| Purpose | Conversion Factor | Constant | Notes |
|---------|------------------|----------|-------|
| **Speed/Movement calculations** | 1 tile = 1000 meters | `TILE_LENGTH_METERS` | Used for vehicle speed calculations (km/h to pixels/frame) |
| **Cursor range display** | 1 tile = 10 meters | `CURSOR_METERS_PER_TILE` | Used for UI display of attack range and distance to target |

### Constants Reference

- `TILE_SIZE` = 32 (pixels per tile)
- `TILE_LENGTH_METERS` = 1000 (for speed calculations - legacy)
- `CURSOR_METERS_PER_TILE` = 10 (for UI range display)

## Cursor System

### Attack Cursor Behavior

When a player's combat unit is selected and hovering over a potential target:

1. **In-Range Target**: Shows attack cursor (`attack-mode`)
2. **Out-of-Range Target**: Shows out-of-range cursor (`attack-out-of-range-mode`)

### Range Information Display

When hovering over any enemy with combat units selected:
- **Distance to target** (top): Shows current distance in meters (e.g., "150m")
- **Unit max range** (bottom): Shows the selected unit's maximum firing range in meters (e.g., "120m")

The display uses:
- Black text color
- White semi-transparent background
- Positioned near the cursor

### Combat Unit Types

The following unit types are considered attack-capable for cursor/range detection:
- `tank`, `tank_v1`, `tank-v2`, `tank-v3`
- `rocketTank`
- `howitzer`
- `apache`
- `artilleryTurret` (building)

## Related Files

- [src/config.js](../src/config.js) - Constants definition
- [src/input/cursorManager.js](../src/input/cursorManager.js) - Cursor state management
- [src/input/mouseHandler.js](../src/input/mouseHandler.js) - Range detection logic
- [cursors.css](../cursors.css) - Cursor styles
