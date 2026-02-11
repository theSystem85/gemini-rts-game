# Fix Production Button Visibility

**UTC Timestamp:** 2026-02-11T20:07:25Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## Prompt

the sidebar should initially show the build button for the power plant but no build button is shown. Ensure it is shown. Also when I load a game with already unlocked tech tree I can only see the build buttons for all turrets and the ammo factory but no other buildings. Try to find the root cause for the missing buttons and fix the issue.

## Root Cause

During button setup, the code wasn't checking if units/buildings were already in `gameState.availableUnitTypes` or `gameState.availableBuildingTypes` and applying the `unlocked` class + loading images. This caused:

1. Initial buildings (powerPlant, etc.) from `gameState.availableBuildingTypes` to remain hidden
2. Loaded games with unlocked tech to only show buttons that happened to be unlocked after setup

## Fix

Updated `setupUnitButtons()` and `setupBuildingButtons()` to:
- Check if type is already in available sets during setup
- Load the image from `data-src` to `src`
- Add `unlocked` CSS class to make button visible
- Improved `loadButtonImage()` to prevent duplicate loading

## Files Modified

- `src/ui/productionControllerButtonSetup.js` - Added initial unlock check
- `src/ui/productionControllerTechTree.js` - Improved loadButtonImage() safety
