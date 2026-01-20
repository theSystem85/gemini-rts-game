UTC timestamp: 2026-01-19T12:00:00Z
LLM: copilot

User query: dragging works well now but ensure the tutorial window on destop starts bottom left corner by default. Also store the position of the modal in local storage. Besides that step 12 still does not unlock. Ensure when any unit is remote controlled and moves just a bit that the next step gets unlocked.

Changes made:
- Updated tutorialSystem.js to add position storage in localStorage with key 'rts_tutorial_position', defaulting to bottom left relative to game canvas.
- Modified setupDragHandlers to save position on drag end.
- Applied saved position on UI creation.
- Updated CSS to position tutorial card relative to game canvas (left: calc(var(--sidebar-width) + 20px); bottom: 20px).
- Changed step 12 completion logic to unlock when any player unit has remoteControlActive set, allowing unlock on remote control movement.
- Updated TODO/Bugs.md and TODO/Features.md with completed items.
- Added comprehensive tutorial CSS styles to style.css for proper rendering.