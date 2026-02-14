2026-02-12T14:32:00Z — fix-control-groups-icon

LLM: copilot

Summary:
User reported the `1·2·3` control-groups action-button icon is misaligned on mobile. Adjusted CSS so the label is horizontally and vertically centered and no longer clipped.

Files changed:
- styles/sidebar.css — added `.button-icon.group-icon` rules to allow auto width and center the label
- styles/base.css — replaced `#controlGroupsBtn .group-icon` rule with inline-flex centering and vertical nudge

Reasoning:
- The icon text was constrained by `.button-icon { width: 20px }` causing clipping and vertical misalignment.
- Allowing `width: auto` and using `inline-flex` centers multi-character labels like `1·2·3` and matches other icon alignment.

How to verify:
1. Open the game in mobile portrait (or responsive device toolbar) and inspect the bottom action bar.
2. Confirm the `1·2·3` button label is centered vertically and horizontally and matches neighboring icons.
3. Ensure long-press and tap behaviors are unchanged.

UX note:
- Kept font-size conservative and applied a tiny `translateY(-1px)` nudge for optical centering on retina displays.

Commit message suggestion:
```
fix(ui): center control-groups "1·2·3" icon in mobile action bar

- allow group icon to use auto width and inline-flex centering
- adjust font-size/line-height so label is vertically aligned with other icons
- update bug list and prompt-history
```
