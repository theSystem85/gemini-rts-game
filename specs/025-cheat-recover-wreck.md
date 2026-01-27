# Cheat Code: Recover Selected Wreck

## Summary
Add a cheat command that instantly restores a selected wreck as a live unit and assigns it to the requested party.

## Requirements
- Add a cheat code `recover` that restores the currently selected wreck to the human player's party.
- Add a cheat code `recover [party]` that restores the selected wreck to the specified party (e.g., `recover red`).
- If no wreck is selected, show an error notification.
- If the wreck is already being restored or recycled, show an error notification.
- Restored units should spawn at the wreck location and be added to the normal unit roster.
- Update the cheat console help list to document the new command.

## Notes
- Party names should follow the same alias resolution used by other cheat commands (green/red/blue/yellow, player1-4).
- Use existing notification and sound utilities for feedback.
