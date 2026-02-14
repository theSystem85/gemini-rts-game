UTC: 2026-02-11T12:00:00Z
LLM: copilot (Claude Opus 4.6)

## Prompt
Fix lazy loading bug where Power Plant image shows first, then gets replaced by placeholder — should be the other way around.

## Root Cause
Race condition between `forceLoadTabImages()` in `productionControllerTabs.js` and `setupAllProductionButtons()` in `productionControllerButtonSetup.js`.

In `gameOrchestrator.js`:
1. `initProductionTabs()` runs first → `activateTab('buildings')` → `forceLoadTabImages()` saves placeholder URLs from `img.src`, clears them, then uses `setTimeout(10ms)` to restore them
2. `setupAllProductionButtons()` runs next → `syncTechTreeWithBuildings()` + `loadImagesForAvailableTypes()` → sets Power Plant `src` to real image
3. 10ms later, the setTimeout fires and overwrites the real image back to the placeholder URL

## Fix
Modified `forceLoadTabImages()` to skip images that haven't been activated yet (where `img.src !== img.dataset.src`), preventing it from clobbering lazy-loaded images during the restore timeout.
