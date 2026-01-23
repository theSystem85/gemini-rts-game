# CSS Stylesheet Splitting

## Summary
The monolithic `style.css` file has been split into modular stylesheets to improve maintainability and reduce merge conflicts. The new structure preserves the original cascade order while grouping related styles into separate files.

## Goals
- Reduce the size and cognitive load of a single CSS file.
- Keep the original style cascade by loading files in the same order.
- Document where new styles should be added.

## New Stylesheet Layout
Load order matters and mirrors the original file order:

1. `styles/base.css`
   - Global resets, root variables, layout scaffolding, sidebar base structure, multiplayer UI, and other foundational rules.
2. `styles/sidebar.css`
   - Sidebar content styling: minimap bars, production UI, action buttons, resource bars, and save list visuals.
3. `styles/overlays.css`
   - HUD overlays and in-game menus: FPS overlay, performance dialog, map settings, and configuration modal styles.
4. `styles/modals.css`
   - Tutorial UI, keybinding conflict modal, kicked/benchmark dialogs, remote invite overlay, host paused banner, and mobile sidebar modal styles.

## Maintenance Notes
- Add global layout and shared utilities to `styles/base.css`.
- Add production/controls/sidebar component styles to `styles/sidebar.css`.
- Add overlays or settings/menu-related rules to `styles/overlays.css`.
- Add modal/dialog/tutorial styling to `styles/modals.css`.
- If a new stylesheet is added, update `index.html` and `public/sw.js` to include it.
