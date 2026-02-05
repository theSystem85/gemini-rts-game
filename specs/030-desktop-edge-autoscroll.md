# Desktop Edge Auto-Scroll

## Summary
Enable desktop-only edge-triggered camera scrolling that activates after the cursor lingers near the map edges. Provide runtime configurability for scroll speed and a settings toggle to disable the behavior entirely.

## Requirements
- **Activation zone:** Auto-scroll only triggers when the cursor is within the outer 5% of the map viewport width/height on any edge.
- **Hover delay:** The cursor must remain in the edge zone for at least **250 ms** before auto-scroll begins.
- **Speed scaling:** Scroll speed scales up as the cursor moves closer to the edge; no scaling effect occurs outside the 5% zone.
- **Config editor:** Expose base auto-scroll speed in the runtime config editor so it can be tuned live.
- **Settings toggle:** Provide a checkbox in Settings that enables/disables desktop edge auto-scroll.
- **Desktop-only:** Do not enable this behavior in touch/mobile layouts.
