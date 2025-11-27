2025-11-27T10:00:00Z - copilot

Fix subtitle overlap in defeat modal: user requested that the subtitle under the defeat headline should not overlap the statistics listed below the modal. I will update the UI rendering code to measure subtitle wrap lines and ensure stats block starts below these lines. Also add spec/notes and TODO entry.

User request: ensure the sub text after the headline on the defeat modal does not overlap with the statistics below (happens currently)

Changes to make:
- Adjust subtitle wrapping in `src/rendering/uiRenderer.js` to compute subtitle height
- Push statistics start position below subtitle dynamically
- Add spec note and TODO entry describing the fix
- Add prompt history entry (this file) for traceability
