# Portrait Mode Minimap and Scrolling Fixes

**UTC Timestamp:** 2025-01-22T15:30:00Z
**LLM:** Copilot (Claude Opus 4.5)

## Prompt Summary
User reported two issues in portrait mode:
1. The minimap toggle button does not work in portrait (condensed) mode
2. Normal map scrolling does not work in portrait mode anymore

## Changes Made

### 1. Fixed `#mobilePortraitActions` z-index and visibility (style.css)
- Added `z-index: 2101` to ensure action buttons are above other UI elements
- Changed default `display: flex` to `display: none`
- Added conditional rule `body.mobile-portrait.sidebar-condensed #mobilePortraitActions { display: flex }` to only show the container in portrait condensed mode
- This ensures the minimap button and other action buttons are properly visible and clickable

### 2. Fixed swipe handler capturing canvas touches (src/main.js)
- **Root Cause:** The swipe-to-condense gesture was using a position threshold (`portraitCloseThreshold`) that captured touches on the canvas near the sidebar edge
- The threshold was calculated as `sidebar width + 40px`, meaning a 40px strip of the canvas next to the sidebar was being captured by the swipe handler
- When these touches moved horizontally, `event.preventDefault()` was called on the touchmove event, potentially interfering with canvas pointer events

- **Fix:** Changed the condition from:
  ```javascript
  (startedInsideSidebar || touch.clientX <= portraitCloseThreshold)
  ```
  to just:
  ```javascript
  startedInsideSidebar
  ```
- This ensures the swipe-to-condense gesture only activates when the touch actually starts inside the `#sidebar` element
- Removed the unused `getSidebarWidthEstimate()` function and `portraitCloseThreshold` variable

## Files Modified
- `style.css` - Added z-index and conditional display for `#mobilePortraitActions`
- `src/main.js` - Fixed swipe handler to not capture canvas touches

## Technical Details
- The minimap toggle uses pointer events attached to `#mobileMinimapButton`
- The game canvas uses pointer events (`pointerdown`, `pointermove`, `pointerup`)
- The swipe handlers use touch events (`touchstart`, `touchmove`, `touchend`) on the document
- Although these are separate event types, calling `preventDefault()` on touchmove could interfere with touch handling in some browsers

## Commit Message
```
fix: portrait mode minimap toggle and map scrolling

- Add z-index: 2101 to #mobilePortraitActions for proper stacking
- Only display #mobilePortraitActions in portrait condensed mode
- Fix swipe handler capturing canvas touches near sidebar edge
- Remove position-based threshold, only activate swipe inside sidebar
```
