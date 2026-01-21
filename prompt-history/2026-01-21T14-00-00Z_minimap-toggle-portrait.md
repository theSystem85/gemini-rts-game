# UTC: 2026-01-21T14:00:00Z
# LLM: GitHub Copilot (Claude Sonnet 4.5)

## Prompt

Ensure the minimap works exactly as in landscape mode including its toggle button on the very left of the action bar (currently missing). Ensure the minimap is only shown when its toggle button is held.

## Changes Made

### CSS Changes (style.css)

1. **Show minimap button in portrait condensed mode**
   - Added `body.mobile-portrait.sidebar-condensed #mobileMinimapButton` selector to display the button

2. **Position minimap button first in action bar**
   - Added `order: -1` to `#mobileMinimapButton` in portrait condensed mode to ensure it appears on the very left

3. **Enable minimap overlay in portrait condensed mode**
   - Added `body.mobile-portrait.sidebar-condensed #mobileMinimapOverlay.visible` selector to show overlay when button is held

4. **Hide static minimap dock**
   - Set `#mobilePortraitMinimapDock` to `display: none` since we're using the overlay approach now

### JavaScript Changes

**src/ui/minimap.js:**
1. **Enable layout for portrait condensed mode** - Modified init function to check for both landscape and portrait condensed:
   ```javascript
   const isPortraitCondensed = document.body.classList.contains('mobile-portrait') && 
                               document.body.classList.contains('sidebar-condensed')
   mobileMinimapState.layoutEnabled = isLandscape || isPortraitCondensed
   ```

2. **Update layout changed event handler** - Modified to also check for portrait condensed mode when determining if overlay should be enabled

**src/main.js:**
1. **Remove minimap dock logic** - Removed `moveMinimapToPortraitDock()` call from `applyPortraitCondensedLayout()`
2. **Remove minimap restore logic** - Removed `restoreMinimap()` call from `clearPortraitCondensedLayout()`

## Result

The minimap now works identically in both landscape and portrait condensed modes:
- Toggle button appears on the very left of the action bar
- Minimap is only shown when the button is held (pointer down)
- Minimap disappears when button is released (pointer up)
- Uses the same overlay approach for consistent behavior
