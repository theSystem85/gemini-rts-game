20260120T212204Z
LLM: codex

Prompt:
only for portrait mode on mobile ensure there is a condensed version of the sidebar on the left that will show up when user swipes on the sidebar (expanded) to the left. Then it goes into "condensed" mode. If the user swipes down at the build buttons in condensed mode then it goes into hidden mode where all sidebar elements are hidden and there is only the restore menu button on the bottom left (current implementation). So now you should implement this new intermediate step called condensed mode of the sidebar. Here are its features:
1) it contains the same size build buttons for units and buildings like on landscape mode but the bar goes at the bottom from left to right with the unit/building tab toggle button on the right. The bar can be scrolled horizontally
2) the same action buttons like on landscape mode are available but located on the right and side of the bottom screen right above (but not overlapping) the build bar.
3) use the same minimap like on landscape mode but on the left bottom of the screen right above the build button bar
4) ensure desktop and mobile landscape UI/UX is not affected at all by this change!
