# Enemy AI Recovery Tank Implementation

## Overview
This document describes the implementation of automatic recovery tank management for enemy AI players.

## Features Implemented

### 1. Configurable Recovery Tank Ratio
- **Config Variable**: `RECOVERY_TANK_RATIO` (default: 5)
- **Location**: `src/config.js`
- **Description**: Defines how many combat units are needed per recovery tank (1:X ratio)
- **Runtime Adjustable**: Available in the config registry for in-game modification

### 2. Automatic Recovery Tank Production

#### Build Conditions
AI will build recovery tanks when:
- At least `RECOVERY_TANK_RATIO` (5) combat units exist
- Current recovery tank count is below required ratio
- Budget available (3000 credits)
- Hospital and vehicle factory are operational

#### Production Priority
Recovery tanks are prioritized after:
- Harvesters (up to 4 per refinery)
- Tanker trucks (at least 1)
- Ambulances (at least 1 if hospital exists)
- But before additional combat units

### 3. Immediate Task Assignment

#### On Spawn Behavior
When a recovery tank is spawned:
- `lastRecoveryCommandTime` set to 0 (allows immediate assignment)
- Automatic trigger of `manageAIRecoveryTanks()` after 100ms delay
- Full crew initialization (driver, commander, loader)
- Proper stats: 150 HP, 0.525 speed, armor 3

#### Spawning Properties
Enemy recovery tanks spawn with:
- **Health**: 150 HP (same as harvesters)
- **Max Health**: 150 HP
- **Speed**: 0.525 (faster than tanks)
- **Armor**: 3 (durable like harvesters)
- **Cost**: 3000 credits
- **Crew**: Driver, Commander, Loader (required for operations)
- **Gas**: Full tank (1900)

### 4. Universal Wreck Recovery

#### Target Selection
Recovery tanks will recover:
- **Any wreck on the map** (not just friendly)
- Oldest wrecks first (by creation time)
- Unassigned and untowed wrecks only
- Priority: Wrecks > Repairing damaged units

#### Assignment Logic
- Distance-based assignment (nearest available tank)
- One tank per wreck/unit
- 2-second cooldown between assignments
- Proper queue management via utility queue system

### 5. Ratio Maintenance

#### Continuous Monitoring
AI continuously checks:
- Count of active combat units (tank_v1, tank-v2, tank-v3, rocketTank)
- Count of active recovery tanks
- Required ratio: `Math.ceil(combatUnits / RECOVERY_TANK_RATIO)`

#### Dynamic Production
- Produces recovery tanks as combat force grows
- Example: 5 combat units → 1 recovery tank
- Example: 10 combat units → 2 recovery tanks
- Example: 15 combat units → 3 recovery tanks

## Implementation Files

### Modified Files
1. **src/config.js**
   - Added `RECOVERY_TANK_RATIO` config variable
   - Added `setRecoveryTankRatio()` setter function
   - Registered in `EXPORTED_CONFIG_VARIABLES`

2. **src/configRegistry.js**
   - Added recovery tank ratio to runtime config
   - Category: "AI & Pathfinding"
   - Range: 1-20, step: 1

3. **src/ai/enemyAIPlayer.js**
   - Imported `RECOVERY_TANK_RATIO` from config
   - Added recovery tank production logic in unit production phase
   - Immediate task assignment on spawn (with 100ms delay)
   - Ratio checking before combat unit production

4. **src/ai/enemyStrategies.js**
   - Modified `manageAIRecoveryTanks()` to target all wrecks
   - Removed owner filtering for wreck recovery
   - Universal wreck recovery across the map

5. **src/ai/enemySpawner.js**
   - Added recovery tank to unit costs (3000)
   - Set proper health (150) and speed (0.525)
   - Added armor (3) for durability
   - Included in loader units for crew initialization

6. **src/game/ambulanceSystem.js**
   - Fixed missing `TILE_SIZE` import

## Testing Guide

### Manual Testing Steps

1. **Start Game**
   ```bash
   npm run dev
   ```

2. **Wait for AI Build-up**
   - AI needs hospital + vehicle factory + 5 combat units
   - Typical time: 2-3 minutes

3. **Verify Recovery Tank Production**
   - Check enemy forces for recovery tank units
   - Use cheat command: `status` to see unit counts

4. **Create Test Wrecks**
   - Damage enemy units to create wrecks
   - Damage player units to create wrecks
   - Both should be recovered

5. **Observe Recovery Behavior**
   - Recovery tanks should automatically approach wrecks
   - Wrecks should be towed back to recycling areas
   - Check that newest spawned tanks immediately get assigned

### Cheat Commands for Testing

```javascript
// Spawn recovery tank for testing
recoveryTank 1 red

// Check unit counts
status

// Add wrecks for testing
// (damage units until destroyed)

// Adjust ratio in runtime
// Open config menu (press C)
// Find "Recovery Tank Ratio" under "AI & Pathfinding"
```

### Expected Behavior

✅ **Correct Behavior:**
- AI builds recovery tank after 5th combat unit
- Newly spawned recovery tanks get assigned within seconds
- Recovery tanks tow any wreck (player or enemy)
- Ratio maintained as army grows
- Recovery tanks have proper stats and crew

❌ **Incorrect Behavior:**
- Recovery tanks idle when wrecks available
- Recovery tanks missing crew members
- Only recovering friendly wrecks
- Ratio not maintained properly

## Performance Considerations

### Optimization Features
- 2-second cooldown prevents command spam
- Distance-based sorting minimizes pathfinding
- Early availability checks reduce unnecessary processing
- Immediate spawn assignment avoids delays

### Resource Impact
- Minimal CPU impact (runs per AI player update)
- Efficient wreck filtering and sorting
- Proper cleanup of completed tasks

## Future Enhancements

### Potential Improvements
1. Priority-based wreck recovery (valuable units first)
2. Zone-based assignments (area control)
3. Escort behavior for recovery operations
4. Enemy wreck denial strategies
5. Recovery tank retreat when under fire

## Configuration Examples

### Aggressive Recovery (1:3 ratio)
```javascript
// More recovery tanks, faster wreck clearing
RECOVERY_TANK_RATIO = 3
// Result: 1 recovery tank per 3 combat units
```

### Balanced Recovery (1:5 ratio - default)
```javascript
// Standard balanced approach
RECOVERY_TANK_RATIO = 5
// Result: 1 recovery tank per 5 combat units
```

### Minimal Recovery (1:10 ratio)
```javascript
// Fewer recovery tanks, more combat focus
RECOVERY_TANK_RATIO = 10
// Result: 1 recovery tank per 10 combat units
```

## Known Limitations

1. **Factory Hold Time**: Recovery tanks hold in factory for 5 seconds after spawn (standard behavior)
2. **Pathfinding Delays**: May take a few seconds to reach distant wrecks
3. **Budget Priority**: Will only build if budget > 3000 credits
4. **Infrastructure Dependency**: Requires hospital + vehicle factory operational

## Conclusion

The enemy AI now maintains a proper logistics chain with automatic recovery tank production and universal wreck recovery. The system is fully configurable, performs efficiently, and integrates seamlessly with existing AI behaviors.
