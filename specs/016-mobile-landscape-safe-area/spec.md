# Feature Specification: Mobile Landscape Safe-Area Fill

## Overview
Landscaped touch layouts on iPhone 13 Pro Max still leave a black bar on the right edge where the build menu and energy indicator sit. The playable canvas should occupy that space, the build controls need to shift fully into the safe-area inset, and the power bar has to align with the rest of the UI.

## Requirements
1. **Canvas Coverage**
   - `CanvasManager.resizeCanvases()` must size both canvases to include the device's right safe-area inset in landscape. No black column should remain once the sidebar is collapsed.
   - Map content must scroll beneath the notch-safe area without stretching or distorting aspect ratios.

2. **Build Menu Positioning**
   - `#mobileBuildMenuContainer` should anchor to the physical right edge of the screen with internal padding equal to `var(--safe-area-right)` so touch targets avoid the notch.
   - Build buttons and tabs should maintain their widths but sit flush with the visible edge.

3. **Status Bar Alignment**
   - The green power bar and money display in the mobile status bar must align with the build menu content and stay vertically stacked without overlap.
   - The energy bar text must remain fully readable while centered inside the bar.

4. **Action Button Placement**
   - Mobile landscape action buttons must hug the left safe-area inset: Menu and Start/Pause sit at the top, Repair/Sell/Minimap align from the bottom up, leaving a central gap so the dynamic island never obscures them.

5. **Device Scope**
   - Changes must specifically target landscape touch layouts and respect existing portrait sidebar logic.
   - Safe-area CSS variables continue to derive from `body.is-touch` so the solution works for other notch devices.
