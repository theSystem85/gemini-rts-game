# Cheat Console UI Alignment

## Goal
- Update the cheat console modal to share the same visual styling as the settings menu modal.

## Requirements
- Use the settings modal visual system (overlay, dialog surface, header, and button styling) for the cheat console.
- Keep cheat command input and help list content intact.
- Ensure the cheat console still blocks gameplay input while open and restores state on close.
- Keep vertical scrolling available while hiding native scrollbars, and prevent horizontal scrolling in the cheat console.

## Implementation Notes
- Reuse `config-modal` classes from `styles/overlays.css` for the overlay and dialog elements.
- Use `config-modal__field`, `config-modal__actions`, and `config-modal__button` styles for input and actions.
- Add minimal cheat-specific styles only for spacing, hidden scrollbars, and help list presentation.

## Command Updates
- Added `build [type] [party]` cheat command support to spawn buildings near the cursor for fast test/setup workflows.
- Building spawn applies immediate placement to the map grid, occupancy map, and building list, then refreshes power supply state.
