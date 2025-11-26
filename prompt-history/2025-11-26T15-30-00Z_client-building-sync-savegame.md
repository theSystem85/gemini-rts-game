# 2025-11-26T15:30:00Z - Claude Opus 4.5 (Preview)

## Prompt Summary
Fix client building sync when host loads a save game - buildings visible on host but not on client when invited to a loaded game.

## Problem Analysis
When the host loads a save game and then invites a client to join:
1. Host's `loadGame()` correctly populates `gameState.buildings` with all saved buildings
2. Host starts sending game state snapshots via `broadcastGameStateSnapshot()`
3. Client receives snapshots in `applyGameStateSnapshot()` but buildings weren't rendering

Root causes identified:
1. **Missing map dimensions in snapshot**: Client's `mapGrid` was empty (default `[]`) because the snapshot didn't include map dimensions
2. **placeBuilding() failed silently**: Without a properly initialized `mapGrid`, `placeBuilding()` couldn't set building references on map tiles
3. **Factories not synced to main.js array**: `mainFactories` from `main.js` wasn't being updated alongside `gameState.factories`
4. **`now` variable not in scope**: The `now` variable for animation timestamps was defined inside the units block but used in the buildings block (fixed in follow-up)

## Changes Made

### `src/network/gameCommandSync.js`

1. **Added map dimensions to snapshot**:
```javascript
return {
  // ... other properties
  mapTilesX: gameState.mapTilesX,
  mapTilesY: gameState.mapTilesY,
  timestamp: Date.now()
}
```

2. **Added helper function to initialize client mapGrid**:
```javascript
function ensureClientMapGridInitialized(width, height) {
  // Initialize mapGrid if empty or wrong dimensions
  if (!gameState.mapGrid || gameState.mapGrid.length !== height || ...) {
    gameState.mapGrid = []
    for (let y = 0; y < height; y++) {
      gameState.mapGrid[y] = []
      for (let x = 0; x < width; x++) {
        gameState.mapGrid[y][x] = { type: 'land', ore: false, seedCrystal: false, noBuild: 0 }
      }
    }
  }
  // Also initialize occupancyMap
  // ...
}
```

3. **Called initialization before building sync**:
```javascript
if (snapshot.mapTilesX && snapshot.mapTilesY) {
  ensureClientMapGridInitialized(snapshot.mapTilesX, snapshot.mapTilesY)
}
```

4. **Improved building placement with bounds checking**:
```javascript
const mapGridReady = gameState.mapGrid && gameState.mapGrid.length > 0 && 
                     Array.isArray(gameState.mapGrid[0]) && gameState.mapGrid[0].length > 0
if (newBuildings.length > 0 && mapGridReady) {
  newBuildings.forEach(building => {
    // Verify building position is within map bounds before placing
    if (building.y >= 0 && building.y + (building.height || 1) <= gameState.mapGrid.length && ...)
      placeBuilding(building, gameState.mapGrid, gameState.occupancyMap)
  })
}
```

5. **Added mainFactories sync**:
```javascript
import { units as mainUnits, bullets as mainBullets, factories as mainFactories } from '../main.js'
// ...
// Also sync mainFactories array from main.js for compatibility
mainFactories.length = 0
mainFactories.push(...gameState.factories)
```

6. **Moved `now` variable to function scope** (follow-up fix):
```javascript
// Get current time for animation timestamp conversions (used by units and buildings)
const now = performance.now()
```

### `TODO.md`
- Added T033 task documenting this fix

## Technical Notes
- The `placeBuilding()` function from `buildings.js` accesses `mapGrid[y][x]` directly, requiring the grid to be properly initialized
- On client initialization, the default `gameState.mapGrid = []` is empty
- Buildings need to be placed in mapGrid so that collision detection and rendering work correctly
- The fix ensures mapGrid is initialized with proper dimensions from the host's snapshot before any buildings are placed
- The `now` variable must be declared at function scope since both units and buildings blocks need it for animation timestamp conversion
