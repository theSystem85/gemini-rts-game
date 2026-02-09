# LLM Tooltip Positioning and Content Fix

**UTC Timestamp**: 2025-01-29T20:15:00Z  
**AI Model**: GitHub Copilot (Claude Sonnet 4.5)

## Prompt Summary
User requested to fix the LLM queue tooltip to show below the selected building (not on hover) so users can hover over the tooltip content without it moving away, and to fix the right-side cropping of list items.

## Changes Made

### 1. Positioning Logic - Show on Selection, Not Hover

**Files Modified**: 
- `src/ui/llmQueueTooltip.js`
- `src/input/selectionManager.js` 
- `src/input/mouseEventSetup.js`

**Changes**:
1. Replaced `updateLlmQueueTooltipHover()` with `updateLlmQueueTooltipForSelection()` that checks for selected buildings instead of hovered ones
2. Removed hover-based tooltip triggering from `mouseEventSetup.js`
3. Added tooltip update call in `selectionManager.js` after building selection
4. Replaced `positionTooltip()` with `positionTooltipBelowBuilding()` that:
   - Positions tooltip below the building's bottom edge (not centered)
   - Uses building tile coordinates instead of mouse position
   - Adds proper vertical spacing (8px gap)
   - Falls back to positioning above if no room below

**Before**: Tooltip appeared on hover at mouse position
**After**: Tooltip appears below selected enemy construction yard and stays visible when hovering over tooltip content

### 2. Fixed Right-Side Content Cropping

**File Modified**: `styles/sidebar.css`

**CSS Changes**:
1. Added `flex-shrink: 0` to `.llm-queue-tooltip__index` - prevents index (#1, #2) from shrinking
2. Added `flex-shrink: 0` to `.llm-queue-tooltip__icon` - prevents icon from shrinking
3. Already had `flex-shrink: 0` on `.money-tooltip__item-value` from previous fix

**Result**: All fixed-width elements (index, icon, count) maintain their size, while the middle details section with text-overflow: ellipsis flexes to fit available space. No content is cropped.

## Technical Details

### Positioning Algorithm
```javascript
function positionTooltipBelowBuilding(building) {
  const buildingCenterX = (building.x + building.width / 2) * TILE_SIZE - scrollOffset.x
  const buildingBottomY = (building.y + building.height) * TILE_SIZE - scrollOffset.y
  
  let left = buildingCenterX
  let top = buildingBottomY + 8  // 8px gap below building
  
  // Horizontal bounds check with viewport gutters
  // Vertical fallback to above if doesn't fit below
}
```

### Selection Flow
```
User clicks enemy construction yard
  → selectionManager.handleBuildingSelection()
    → Building marked as selected
    → updateLlmQueueTooltipForSelection() called
      → Finds selected enemy construction yard
        → showLlmQueueTooltip(building)
          → Positions below building
          → Tooltip stays visible for hovering
```

### Flex Layout Fix
```
.llm-queue-tooltip__row (flex container)
  ├─ .llm-queue-tooltip__index (flex-shrink: 0, min-width: 32px)
  ├─ .llm-queue-tooltip__icon (flex-shrink: 0, 32x32px)
  ├─ .llm-queue-tooltip__details (flex: 1 1 auto, min-width: 0)
  │   └─ text-overflow: ellipsis on title
  └─ .money-tooltip__item-value (flex-shrink: 0, white-space: nowrap)
```

## Validation
- Ran `npm run lint:fix` with no errors
- Removed unused `event` parameter from `showLlmQueueTooltip()`
- All imports updated to use new `updateLlmQueueTooltipForSelection()` function

## Commit Message
```
fix: position LLM tooltip below selected building and fix content cropping

- Replace hover-based tooltip with selection-based display
- Position tooltip below selected enemy construction yard instead of at cursor
- Add positionTooltipBelowBuilding() for proper anchor positioning
- Add flex-shrink: 0 to index and icon to prevent compression
- User can now hover over tooltip content without it disappearing
- All list item content now displays without right-side cropping
```
