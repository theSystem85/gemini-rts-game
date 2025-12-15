# Spec: Key Bindings Editor Modal

## Overview
- The sidebar "Runtime Config Settings" button opens a tabbed settings modal with a **Key Bindings** tab and a **Runtime Config** tab.
- The Key Bindings tab lists keyboard, mouse, and touch bindings grouped by context (in-game, map edit enabled, map edit disabled).
- Non-default bindings are highlighted with a subtle yellow tint.
- Modal open/close is handled through shared helpers so the sidebar button reliably launches the modal even when the map settings panel is toggled.

## Interaction
- Clicking a binding enters capture mode and records the next keyboard combination, mouse click (including modifier keys and double-click), or touch gesture (tap, double tap, or double-finger tap).
- Custom bindings persist in `localStorage` under the `rts-custom-keybindings` key and are immediately used by the keyboard/mouse handlers.
- Export/Import buttons save or load bindings as JSON that includes app version and commit hash for traceability.

## Runtime behavior
- Keyboard shortcuts in `keyboardHandler` resolve against the keybinding manager so remaps take effect without reloads.
- Mouse selection/command handling consults the same manager to honor remapped primary/secondary clicks while keeping spectator safeguards.
- Map edit mode toggling is exposed as a binding and updates the shared `gameState.mapEditMode` flag for context-aware grouping.
