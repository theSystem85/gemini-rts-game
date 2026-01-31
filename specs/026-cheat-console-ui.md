# Cheat Console UI Alignment

## Goal
- Update the cheat console modal to share the same visual styling as the settings menu modal.

## Requirements
- Use the settings modal visual system (overlay, dialog surface, header, and button styling) for the cheat console.
- Keep cheat command input and help list content intact.
- Ensure the cheat console still blocks gameplay input while open and restores state on close.

## Implementation Notes
- Reuse `config-modal` classes from `styles/overlays.css` for the overlay and dialog elements.
- Use `config-modal__field`, `config-modal__actions`, and `config-modal__button` styles for input and actions.
- Add minimal cheat-specific styles only for spacing and help list presentation.
