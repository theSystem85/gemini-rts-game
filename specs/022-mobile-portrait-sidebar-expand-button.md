# Spec 022: Mobile Portrait Sidebar Expand Button

## Overview

In mobile portrait condensed mode, the bottom sidebar should not expand when users swipe up, as this conflicts with the drag-to-build feature. Instead, a dedicated expand button is provided to toggle the sidebar between condensed and expanded states.

## Goals

- Prevent accidental sidebar expansion when users are dragging to build units
- Provide clear, intentional control over sidebar expansion in portrait mode
- Maintain consistency with landscape mode sidebar controls

## Design

### Swipe Gesture Removal

The `expand-from-bar` swipe gesture has been removed from the build bar area:
- Users can no longer swipe up from the build bar to expand the sidebar
- This prevents conflicts with the drag-to-build feature
- Vertical swipes in the build area are now exclusively for building placement

### Expand Button

A new button is added to the portrait mode action row:

**Location:** In `#mobilePortraitActions` container above the condensed bottom bar  
**Visual Style:** Matches other action buttons (minimap, menu buttons)  
**Icon:** Three horizontal lines (☰)  
**Dimensions:** `var(--mobile-action-size)` width and height  
**Position:** Leftmost button using `order: -2` in flexbox  
**Classes:** `action-button icon-button` for consistent styling

### Behavior

**Click Action:**
- Toggles `sidebar-condensed` class on document body
- Expands sidebar to show full production interface when condensed
- Condenses sidebar back to bottom bar when expanded

**Visibility:**
- Only visible in `body.mobile-portrait.sidebar-condensed` mode
- Hidden in landscape mode and when sidebar is expanded in portrait mode
- Positioned in horizontal action row above the condensed bottom bar
- Appears alongside minimap toggle and menu buttons

## Technical Implementation

### Files Modified

1. **src/main.js**
   - Removed `expand-from-bar` gesture detection in `handleTouchStart`
   - Removed `expand-from-bar` handling in `handleTouchMove`
   - Removed `expand-from-bar` completion logic in `endSwipe`
   - Added `sidebarExpandButton` to `mobileLayoutState`
   - Added button initialization in `ensureMobileLayoutElements`
   - Added click event listener to toggle `sidebar-condensed` state

2. **index.html**mobilePortraitActions` container (above condensed bar)
   - Uses `action-button icon-button` classes
   - Includes ARIA labels and hamburger icon

3. **style.css**
   - Set display rules for portrait condensed mode only
   - Applied `order: -2` to position button leftmost in action row
   - Inherits styling from existing action button classesnce
   - Set display rules for portrait condensed mode only
   - Applied icon rotation for vertical orientation

### State Management

```javascript
mobileLayoutState = {
  // ... existing properties
  sidebarExpandButton: null,
  sidebarExpandButtonListenerAttached: false
}
```

## User Experience

### Before (Issue)
- Users attempting to drag-build units would accidentally trigger sidebar expansion
- Swipe-up gesture conflicted with vertical drag movements for building placement
- No clear way to intentionally expand sidebar without triggering drag-to-build

### After (Solution)
- Drag-to-build works reliably without accidental sidebar expansion
- Clear, visible button provides intentional control over sidebar state
- Consistent with landscape mode's button-based sidebar controls

## Edge Cases

- Button is properly hidden when sidebar is in expanded or collapsed states
- Event listeners are properly attached/detached when DOM elements change
- Button state remains consistent across orientation changes
- Click events are prevented from propagating to canvas or build menu

## Testing Checklist

- [ ] Button appears only in portrait condensed mode
- [ ] Button toggles sidebar between condensed and expanded states
- [ ] Drag-to-build works without expanding sidebar
- [ ] Horizontal swipe from left edge still expands condensed sidebar
- [ ] Button has proper hover/active states
- [ ] ARIA labels are correct and announced by screen readers
- [ ] No console errors when toggling sidebar state
- [ ] Works across different mobile device sizes

## Related Specifications

- Spec 021: Tutorial System (mobile portrait layout considerations)
- Mobile layout system in general (landscape/portrait modes)
- Build menu drag-to-place functionality
