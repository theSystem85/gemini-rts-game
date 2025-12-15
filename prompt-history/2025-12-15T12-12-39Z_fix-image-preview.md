# 2025-12-15T12:12:39Z
## LLM: GitHub Copilot (Claude Sonnet 4.5)

## Prompt
User reported that the image preview below the mouse cursor for units and buildings in edit mode is not working - nothing is shown below the cursor.

## Analysis
The issue was in the image loading implementation. When an Image object is created and its `src` is set, the image loads asynchronously. On the first render frame after selecting a building or unit, the image wouldn't be loaded yet (`img.complete` would be false), so it would show the fallback colored rectangle. However, without an `onload` handler to trigger a re-render once the image finished loading, the preview would remain stuck showing the fallback rectangle even after the image was ready.

The code was checking:
```javascript
if (img.complete && img.naturalWidth > 0) {
  ctx.drawImage(img, screenX, screenY, width * TILE_SIZE, height * TILE_SIZE)
} else {
  // Fallback - shows colored rectangle
}
```

But since the render wasn't being triggered again after the image loaded, it never progressed from the fallback to showing the actual image.

## Changes Made

### src/mapEditor.js

1. **Building preview image loading**:
   - Added `img.onload = () => { requestRenderFrame() }` handler
   - When image finishes loading, triggers a re-render
   - This causes the preview to update from fallback rectangle to actual building image

2. **Unit preview image loading**:
   - Added `img.onload = () => { requestRenderFrame() }` handler
   - When image finishes loading, triggers a re-render
   - This causes the preview to update from fallback rectangle to actual unit image

The `requestRenderFrame()` function already existed in mapEditor.js and calls the registered `renderScheduler` callback to trigger a render update.

### TODO.md
- Added entry documenting the fix

## Summary
Image previews for buildings and units now appear correctly under the cursor in edit mode. When a building or unit is first selected, it may briefly show a colored rectangle fallback, but once the image loads (usually within a few milliseconds), it automatically updates to show the actual building/unit image with 0.7 alpha transparency.
