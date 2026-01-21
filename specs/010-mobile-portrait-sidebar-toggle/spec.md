# Feature Specification: Mobile Portrait Sidebar Toggle

**Feature Branch**: `010-mobile-portrait-sidebar-toggle`
**Created**: 2025-11-16
**Status**: Complete
**Input**: "Make the sidebar on the left toggleable in portrait mode on mobile"

---

## Overview

Touch users holding the device in portrait orientation need the ability to reclaim the entire screen for gameplay without losing access to sidebar controls. The existing mobile-landscape toggle and modal experience now extends to portrait: the floating toggle button becomes available on touch devices even when the layout keeps the sidebar in its desktop position. Collapsing hides the sidebar off screen and allows the canvas to span the full width while keeping accessibility labels accurate.

---

## Requirements

1. **Toggle Availability**
   - Reuse the existing `#sidebarToggle` button inside `#mobileSidebarControls` and surface it whenever `body` has the `mobile-portrait` class.
   - Ensure `aria-hidden` on `#mobileSidebarControls` reflects whether portrait/landscape mobile UI is active so the toggle can be focused with screen readers.

2. **Collapse Behaviour**
   - When collapsed in portrait, slide the sidebar fully off-screen to the left and expand `#gameCanvas` to cover the full viewport width. Animate both with the same easing used for mobile landscape.
   - Maintain safe-area awareness so the floating toggle sits below any notches using the CSS custom properties that already track env(safe-area-inset-*).

3. **State Persistence**
   - Keep storing the collapsed state in `mobileLayoutState.isSidebarCollapsed` so user preference carries across orientation changes.
   - Default to collapsed in landscape and expanded in portrait until the user explicitly toggles.

4. **No DOM Reparenting in Portrait**
   - Portrait mode should leave the production/action panels in their desktop containers. Only the toggle visibility and collapse CSS change; the modal-driven mobile menu remains exclusive to landscape.

5. **Accessibility**
   - Update the toggle's `aria-label`/`aria-expanded` attributes to describe the sidebar state no matter the orientation.
   - Preserve Escape-key dismissal for the landscape modal while ensuring portrait mode never attempts to open it.

---

## Update 2025-11-17

- **Canvas Fill Requirements**: When collapsing or expanding the sidebar in portrait orientation the game canvas must resize immediately (no blank strip) so the map is always visible along the left edge. Resizing the internal canvas dimensions should happen alongside the CSS transition to prevent jump cuts or large black bars.
- **Gesture Closing**: While the sidebar is open in portrait, a leftward swipe starting on the sidebar itself or within roughly the first sidebar-width worth of screen space must close it so players can dismiss the menu without tapping the toggle.
- **Minimal Toggle Presentation**: When the portrait sidebar is collapsed, the floating toggle button in the top-left corner should remain but lose its opaque background so the gameplay view is not obscured. Use a transparent background with just the outline/icon visible until the sidebar reopens.

## Update 2025-11-18

- **Invisible Toggle When Expanded**: In portrait mode the floating toggle must be hidden entirely whenever the sidebar is expanded. The open state is dismissed exclusively through leftward swipe gestures, so the toggle should not be focusable, clickable, or visually present until the sidebar collapses again.
- **Map Coverage Guarantee**: Collapsing the portrait sidebar must immediately reclaim the entire viewport for the canvas at both the CSS and actual canvas resolution levels. This includes updating inline dimensions from the canvas manager so no residual left offset or reduced width leaves a black bar.

## Update 2026-01-20

- **Portrait Visual Polish**: In portrait mode, the sidebar should use a narrower clamp-based width, refined padding, and a subtle gradient/border treatment to feel more premium on small screens.
- **Action Button Layout**: The portrait sidebar action buttons should stack into a tidy grid with consistent sizing and spacing for touch ergonomics.
- **Minimap Fit**: Keep the minimap compact with a softer radius and tighter spacing so it reads cleanly within the portrait column.

## Update 2026-01-20 (Condensed Mode)

- **Condensed Portrait State**: Swiping left on the expanded portrait sidebar should collapse it into a condensed HUD state (not fully hidden).
- **Bottom Build Bar**: The condensed state must show a horizontal, scrollable build bar along the bottom with the units/buildings toggle button aligned on the right.
- **Side HUD Elements**: The condensed state must place the minimap on the lower-left above the build bar and the action buttons stacked on the lower-right above the build bar.
- **Swipe-to-Hide**: A downward swipe on the condensed build bar should fully hide the sidebar, leaving only the restore menu button.
- **Icon-Only Actions**: Action buttons in condensed mode should stack from bottom to top and use icon-only styling with no background or border.
- **Landscape-Matched Minimap**: The condensed minimap should match the landscape appearance and behavior.
- **Vertical Toggle Label**: The build category toggle should use vertical text to minimize horizontal space usage.
