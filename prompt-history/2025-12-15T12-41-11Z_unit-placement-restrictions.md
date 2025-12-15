# Prompt History: Map Edit Mode Unit Placement Restrictions

**Timestamp:** 2025-12-15T12:41:11Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Request

When in map edit mode ensure:
1) Units cannot be drawn over buildings or other units but instead they remove the underlying buildings or units from the map and get placed there
2) Units cannot be drawn over map tiles that are by default occupied like water or rock tiles.

## Implementation Summary

Modified the `applyUnit()` function in [src/mapEditor.js](src/mapEditor.js) to add proper validation and cleanup before placing units in edit mode:

### Changes Made

1. **Water/Rock Tile Check**: Added validation to prevent unit placement on water or rock tiles, as these are impassable terrain types that units cannot occupy.

2. **Building Removal**: Added call to `removeBuildingAtTile()` to remove any existing buildings at the target location before placing the new unit.

3. **Existing Unit Removal**: Added logic to iterate through existing units and remove any that are at the exact same tile coordinates as the placement location.

### Technical Details

The updated `applyUnit()` function now:
- Checks tile type against water/rock and returns early if placement is invalid
- Calls `removeBuildingAtTile(tileX, tileY)` to clear any buildings
- Iterates backward through the units array to safely remove units at the target tile
- Uses `Math.floor(unit.x / TILE_SIZE)` to convert unit pixel positions to tile coordinates for comparison
- Only creates and places the new unit after all validations and cleanup

### Files Modified

- [src/mapEditor.js](src/mapEditor.js) - Updated `applyUnit()` function (lines 264-306)
- [TODO.md](TODO.md) - Added completed task entry

## Result

Map editor now properly enforces unit placement rules:
- Units replace buildings and other units at their placement location
- Units cannot be placed on water or rock tiles
- Edit mode maintains game logic consistency for terrain validation
