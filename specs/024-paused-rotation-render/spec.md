# Bug Fix Specification: Paused Rotation Render Refresh

## Overview
When the game is paused, rotating the screen (or otherwise resizing the viewport) can leave a stretched, frozen frame on the map canvas. The map should render at least once after a resize so the paused frame reflects the new orientation.

## Requirements
1. **Resize-Triggered Render**
   - Any canvas resize triggered by orientation change or viewport resizing must request a render frame even when the game is paused.
   - The refresh should draw both the main map and minimap once so the paused view is properly framed.

2. **Non-Intrusive Update**
   - The render request should not resume game simulation or unpause audio.
   - The refresh should be lightweight and only occur on resize events.

3. **Event Hooking**
   - Canvas sizing logic must emit a signal/event after resize so the game loop can request a render without tight coupling.
   - The game loop should handle the request through its existing render scheduling path.
