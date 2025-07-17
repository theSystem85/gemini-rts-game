# AI Wiggle Behavior Fix Summary

## Problem Description
Enemy AI units were exhibiting "wiggle" behavior when attacking the player's base, causing them to constantly change directions and targets, making them appear indecisive and reducing their effectiveness.

## Root Causes Identified

1. **Too Frequent Decision Making**: AI_DECISION_INTERVAL was set to 200ms, causing units to reassess targets every 0.2 seconds
2. **Excessive Path Recalculation**: Units were recalculating paths every 3 seconds regardless of need
3. **Lack of Base Defense**: No mechanism for AI units to defend their own base when under attack
4. **Target Switching Instability**: Units would switch targets too easily when multiple options were available

## Changes Made

### 1. Reduced Decision Frequency
**File**: `src/config.js`
- Changed `AI_DECISION_INTERVAL` from 200ms to 5000ms (5 seconds)
- This prevents constant target reassessment and reduces wiggling

### 2. Implemented Base Defense System
**File**: `src/ai/enemyUnitBehavior.js`

#### New Functions Added:
- `checkBaseDefenseNeeded()`: Determines if the AI base is under attack
- `findBaseDefenseTarget()`: Finds the best target for base defense

#### Base Defense Logic:
- AI units within 20 tiles of their base will defend it when player units approach within 12 tiles
- Defense is prioritized over normal attack behavior (except when units are being directly attacked)
- Units are marked with `defendingBase` flag to track their defense status
- Automatic scaling: sends up to 2x defenders per attacker, capped at 6 units

### 3. Improved Target Retention
**Enhanced target stability**:
- Increased target retention range from 25 to 30 tiles
- Added conditions to keep current target when unit has a valid path
- Units are less likely to switch targets mid-combat

### 4. Smarter Path Recalculation
**Reduced unnecessary pathfinding**:
- Only recalculate paths when target has moved significantly (>2 tiles)
- Track target positions to detect movement
- Avoid recalculation when unit has a valid path (≥3 steps remaining)

### 5. Enhanced Movement Tracking
**Target position tracking**:
- Store `lastTargetPosition` to detect when targets move significantly
- Prevents path recalculation for stationary targets
- Reduces computational load and movement jitter

## Expected Results

1. **Smoother Movement**: Units will move more decisively toward targets without constant direction changes
2. **Better Base Defense**: AI will actively defend its base when under attack
3. **Improved Performance**: Reduced pathfinding computations
4. **More Strategic Behavior**: Units will complete their current objectives before switching to new ones
5. **Reduced Wiggling**: The 5-second decision interval prevents rapid target switching

## Testing Recommendations

1. Attack enemy base with various unit compositions to test base defense
2. Verify that enemy units approach player base in more direct lines
3. Check that units still respond quickly when attacked (immediate retaliation logic preserved)
4. Ensure performance improvements don't negatively impact game responsiveness

## Backward Compatibility

All changes are backward compatible with existing save games and don't affect the player's unit behavior or other game systems.
