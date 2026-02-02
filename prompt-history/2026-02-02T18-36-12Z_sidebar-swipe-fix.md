# Fix Portrait Sidebar Swipe Functionality

**UTC Timestamp:** 2026-02-02T18:36:12Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## Prompt

> the current staged changes on the sidebar in portrait mode caused the sidebar in expanded mode to not being able to be swiped to the left to go into condensed mode any more. Looks like the swipe feature on the sidebar does not work anymore. Find the issue and fix it! Look at the staged changes from git.

## Analysis

The issue was in the `applyMobileSidebarLayout` function in `src/ui/mobileLayout.js`. When a user swiped to expand the sidebar from condensed mode, the following problematic sequence occurred:

1. `setSidebarCondensed(false)` was called to un-condense the sidebar
2. It changed body classes to expanded state
3. It called `applyMobileSidebarLayout('portrait')`
4. **Inside `applyMobileSidebarLayout`, `syncPortraitSidebarState()` was called unconditionally, which read the OLD state from localStorage and re-applied it, overwriting the user's swipe action**
5. Then it persisted the state (but it had already been overwritten)

This caused the sidebar state to never actually change when the user swiped, making the swipe functionality appear broken.

## Solution

Added a `hasPortraitStateBeenSynced` flag to `mobileLayoutState` to track whether the stored portrait state has been synchronized for the current session. The `syncPortraitSidebarState()` function is now only called once when first entering portrait mode, not on every call to `applyMobileSidebarLayout('portrait')`.

This allows subsequent user interactions (swipes to expand/condense) to work properly without being overwritten by the stored state.

## Changes

- Added `hasPortraitStateBeenSynced: false` to `mobileLayoutState`
- Modified `applyMobileSidebarLayout` to only call `syncPortraitSidebarState()` when `!mobileLayoutState.hasPortraitStateBeenSynced`
- Set the flag to `true` after the first sync
- Fixed lint issue by prefixing unused `options` parameter with underscore
