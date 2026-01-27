2025-01-27T12-00-00Z
GitHub Copilot

User requested fixes to the tutorial system:
- Move tutorial to bottom right default position
- Ensure ? button visibility
- Fix step 13 (tank-control) completion bug
- Adjust padding/width for button layout

Implemented changes:
- Changed CSS position from left to right, increased width to 360px, reduced padding to 12px 14px, reduced gap to 6px, reduced button padding to 6px 12px
- Fixed step 12 completion by adding remoteControlDone flag in stepState and updating completion logic