# Defeat modal — subtitle & statistics spacing

Description: The defeat modal has a headline (VICTORY/DEFEAT), a short subtitle line, and a list of game statistics below it. On narrow screens or with long subtitles the subtitle was wrapping and could overlap the statistics block below.

Acceptance criteria

- Subtitle text wraps when needed and all lines are rendered with proper spacing
- The statistics lines start below the subtitle block and never overlap the subtitle
- Works both for single-button game over and multiplayer defeat modal (two-button) layouts
- Works in mobile portrait and landscape (accounting for safe area insets and right-side UI panel)

Testing

- Trigger defeat modal with short subtitle and verify stats remain spaced
- Trigger with a long subtitle (simulate long message) and verify stats start below last subtitle line
- Resize canvas smallest -> largest and verify no overlap

Notes

- Implementation: `src/rendering/uiRenderer.js` now computes subtitle lines during rendering and adjusts `layout.stats.startY` dynamically to ensure spacing.