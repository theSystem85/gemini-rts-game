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
