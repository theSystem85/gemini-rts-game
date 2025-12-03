# SOT Support for Streets Crossing Water

**UTC Timestamp:** 2025-12-03T12:15:00Z  
**LLM:** Claude Opus 4.5 (GitHub Copilot)

## User Request

Ensure SOT (Smoothening Overlay Texture) works also on streets crossing water.

## Problem Analysis

The SOT system was only applied to **land** tiles. When a land tile had two adjacent street tiles or water tiles forming a corner, a triangular overlay would smooth the transition. However, **street** tiles crossing water did not receive any SOT treatment, resulting in hard/abrupt edges where streets met water.

## Solution

Extended the SOT system to also apply to **street** tiles:

1. **Land tiles** can have:
   - Street corner SOT (when two adjacent sides are streets)
   - Water corner SOT (when two adjacent sides are water)

2. **Street tiles** can now have:
   - Water corner SOT (when two adjacent sides are water)

This creates smooth visual transitions where streets cross over water bodies.

## Changes Made

### `src/rendering/mapRenderer.js`

1. **`computeSOTMask()`**: Updated to process both `land` and `street` tiles, passing tile type to `computeSOTForTile()`

2. **`computeSOTForTile()`**: 
   - Added `tileType` parameter (defaults to 'land')
   - Street corner detection only applies to land tiles
   - Water corner detection applies to both land and street tiles

3. **`updateSOTMaskForTile()`**: Updated to handle both land and street tiles when updating SOT mask

4. **`drawBaseLayer()`**: Updated SOT rendering condition to include street tiles

5. **`renderSOTOverlays()`**: Updated SOT rendering condition to include street tiles (for GPU rendering path)

## Testing

To verify the fix:
1. Find or create a map with streets crossing over water
2. Observe that water corners on street tiles now have smooth triangular transitions
3. Verify land tiles still have proper SOT for both street and water corners
