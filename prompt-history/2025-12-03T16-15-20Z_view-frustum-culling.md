# View Frustum Culling Implementation

**UTC Timestamp:** 2025-12-03T16:15:20Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

User requested implementation of step 5 from a 6-step performance optimization plan:

> "Add view frustum culling in rendering.js for units/buildings - Skip rendering particles, units, and buildings outside the visible viewport"

This was part of an ongoing optimization session to address FPS drops from 60 to 30 during heavy gameplay.

## Changes Made

### 1. `src/config.js`
- Added `VIEW_FRUSTUM_MARGIN` constant (TILE_SIZE * 2 = 64px)
- Provides buffer around viewport to prevent visual pop-in when entities enter view

### 2. `src/rendering/unitRenderer.js`
- Added `VIEW_FRUSTUM_MARGIN` to imports
- Modified `renderBases()` to pass viewport dimensions to visibility check
- Modified `renderOverlays()` to pass viewport dimensions to visibility check
- Updated `renderUnitBase()` signature to accept viewport parameters
- Updated `renderUnitOverlay()` signature to accept viewport parameters
- Enhanced `shouldRenderUnit()` to include view frustum check:
  - Calculates screen-space position from unit.x/y and scrollOffset
  - Checks if unit bounds + margin intersect visible viewport
  - Returns false early if unit is completely off-screen
  - Frustum check runs BEFORE fog-of-war check (cheaper early exit)

### 3. `src/rendering/buildingRenderer.js`
- Added `VIEW_FRUSTUM_MARGIN` to imports
- Modified `renderBases()` to pass viewport dimensions to visibility check
- Modified `renderOverlays()` to pass viewport dimensions to visibility check
- Enhanced `shouldRenderBuilding()` to include view frustum check:
  - Calculates screen-space position from building tile coords and scrollOffset
  - Accounts for building width/height in tile units
  - Checks if building bounds + margin intersect visible viewport
  - Returns false early if building is completely off-screen
  - Frustum check runs BEFORE fog-of-war check (cheaper early exit)

### 4. `TODO.md`
- Added completed task entry documenting the view frustum culling implementation

## Performance Impact

- Eliminates all draw calls for off-screen entities
- Particularly effective when:
  - Camera is zoomed in (most entities off-screen)
  - Large maps with many entities
  - Scrolling through the map
- The 64px margin (2 tiles) prevents pop-in artifacts when entities approach viewport edge
- Frustum check is O(1) per entity - cheaper than fog-of-war visibility map lookups

## Technical Notes

- Units use pixel coordinates (`unit.x`, `unit.y`)
- Buildings use tile coordinates (`building.x`, `building.y`) - must multiply by TILE_SIZE
- Buildings have variable sizes (`building.width`, `building.height`) - factored into bounds check
- Viewport dimensions obtained from `ctx.canvas.width/height`
- All existing fog-of-war visibility checks remain intact as secondary filtering
