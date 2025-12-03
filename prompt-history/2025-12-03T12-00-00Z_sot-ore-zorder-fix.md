# SOT Below Ore Z-Order Fix

**UTC Timestamp:** 2025-12-03T12:00:00Z  
**LLM:** Claude Opus 4.5 (GitHub Copilot)

## User Request

Ensure SOT (Smoothening Overlay Texture) is always rendered below ore overlays.

## Problem Analysis

The `MapRenderer` has two rendering paths:

1. **Standard 2D canvas path** (`drawBaseLayer`): Renders tiles in correct order:
   - Base tile
   - SOT overlay
   - Ore/seed overlay
   
2. **GPU rendering path** (`renderSOTOverlays`): When GPU handles base tiles, this function was only rendering SOT overlays without the ore/seed overlays that need to go on top. The GPU renders base tiles with ore textures first, then the 2D canvas draws SOT overlays on top, causing SOT to appear above ore.

## Solution

Modified `renderSOTOverlays()` to use a two-pass approach:

1. **First pass**: Render all SOT overlays (triangular corner smoothening textures)
2. **Second pass**: Render ore/seed overlays on top of SOT to maintain correct z-order

This ensures that when GPU rendering is used, the ore overlays are still drawn after (on top of) the SOT overlays by the 2D canvas.

## Changes Made

### `src/rendering/mapRenderer.js`

Updated `renderSOTOverlays()` function:
- Added documentation clarifying that ore/seed overlays are rendered after SOT
- Split rendering into two passes:
  - First pass: SOT overlays only
  - Second pass: Ore/seed overlays for tiles that have them

## Testing

To verify the fix:
1. Enable GPU rendering (if available)
2. Look at tiles that have both SOT corners (land tiles next to street/water corners) and ore
3. Ore should always be visible on top, not hidden by SOT triangles
