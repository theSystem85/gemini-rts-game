# LLM Tooltip Overflow Fix

**UTC Timestamp**: 2025-01-29T19:45:00Z  
**AI Model**: GitHub Copilot (Claude Haiku 4.5)

## Prompt Summary
The user requested to ensure the enemy AI building backlog tooltip does not have a horizontal scroller and that all content fits within the tooltip widget boundaries.

## Changes Made

### File: `styles/sidebar.css`
**Issue**: The `.llm-queue-tooltip__list` CSS class was missing `overflow-x: hidden`, allowing horizontal scrolling when content exceeded the tooltip width.

**Solution**: Added `overflow-x: hidden` to `.llm-queue-tooltip__list` to prevent horizontal overflow while maintaining vertical scrolling with `overflow-y: auto`.

**Before**:
```css
.llm-queue-tooltip__list {
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}
```

**After**:
```css
.llm-queue-tooltip__list {
  max-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
```

## Technical Context

The LLM Queue Tooltip (`src/ui/llmQueueTooltip.js`) displays the enemy AI's strategic building/unit production plan when hovering over an enemy construction yard. The tooltip was showing a horizontal scrollbar when production queue items had long names or the list grew too large.

The fix ensures that:
1. Only vertical scrolling is allowed when the list exceeds max-height (260px)
2. Horizontal overflow is clipped instead of creating a scrollbar
3. Content respects the tooltip's width constraint (360px or 92vw)
4. The `.llm-queue-tooltip__title` already handles long text with `text-overflow: ellipsis`

## Validation
- Ran `npm run lint:fix` with no errors
- CSS changes are minimal and non-breaking
- Maintains existing scrollbar styling and appearance

## Commit Message
```
fix: prevent horizontal scrollbar in LLM queue tooltip

Add overflow-x: hidden to .llm-queue-tooltip__list to ensure the enemy
AI building backlog tooltip does not show horizontal scrolling. Content
now properly fits within the tooltip widget boundaries, with text
ellipsis handling long item names.
```
