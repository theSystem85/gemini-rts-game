# Path Planning Architecture Fix

**UTC Timestamp:** 2026-01-31T19:50:35Z (updated 2026-01-31T20:07:12Z)  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

The issue still persists. When I command a unit to attack even a static target I can see the first path to the target being planned but almost immediately being replanned and so on again and again. So explain to me how the current path planning and execution algorithm works and then try to fix it so the units move more efficiently to their target locations without recalculating over and over again. The units often just move around like crazy without going directly to the target direction.

## Analysis - Unit Movement Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          UNIT MOVEMENT PIPELINE                                   │
│                        (Game Loop - Every Frame)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                         USER CLICKS ATTACK TARGET
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ attackCommands.js: setAttackTarget()                                             │
│   - Sets unit.target = enemy                                                     │
│   - Calculates INITIAL path                                                      │
│   - Sets unit.lastAttackPathCalcTime = now                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
═══════════════════════════════════════════════════════════════════════════════════
                          GAME LOOP (60 FPS)
═══════════════════════════════════════════════════════════════════════════════════
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ 1. updateUnitMove-  │  │ 2. updateUnitCombat │  │ 3. updateGlobalPath│
│    ment()           │  │    ()               │  │    finding()       │
│ (unitMovement.js)   │  │ (unitCombat.js)     │  │ (pathfinding.js)   │
│                     │  │                     │  │                     │
│ IF out of range:    │  │ Calls tankCombat.js │  │ IF no path:        │
│   RECALCULATES PATH │◄─┤ → handleTankMove-   │  │   RECALCULATES PATH│
│   (if interval OK)  │  │   ment()            │  │   (for non-attack  │
│                     │  │                     │  │    units only)     │
│ Sets:               │  │ WAS ALSO RECALCU-   │  │                     │
│ - lastAttackPath-   │  │ LATING PATH if:     │  │ Already fixed to   │
│   CalcTime          │  │ - distance >        │  │ skip attack mode   │
│ - lastPathCalcTime  │  │   chaseThreshold    │  │ units              │
│                     │  │ - path empty        │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
          │                         │                         │
          ▼                         ▼                         ▼
      ✅ OK               ⚠️ WAS THE BUG!         ✅ OK (fixed earlier)
```

## Root Cause

**THREE different places** were calculating paths for the same unit:

1. **`updateUnitMovement()` in unitMovement.js** - calculates paths for units with attack targets
2. **`updateUnitCombat()` via `handleTankMovement()` in combatHelpers.js** - WAS ALSO calculating paths!
3. **`updateGlobalPathfinding()` in pathfinding.js** - for non-attack movement (already fixed)

The execution order in the game loop was:
1. `updateUnitMovement()` calculates path
2. `updateUnitCombat()` → `tankCombat.js` → `handleTankMovement()` → **recalculates path AGAIN!**

This caused the path to be constantly overwritten, leading to erratic "crazy" movement.

## Solution

### Clear Separation of Responsibilities

- **Path calculation**: ONLY in `updateUnitMovement()` for attack mode units
- **Stop when in range**: `handleTankMovement()` now ONLY handles stopping the unit when it's in firing range
- **Global pathfinding**: Already fixed to skip attack mode units

### Changes Made

**combatHelpers.js:**
- Removed all path calculation logic from `handleTankMovement()`
- Function now only handles "stop when in range" logic
- Removed unused imports (`findPath`, `ATTACK_PATH_CALC_INTERVAL`)
- Added clear documentation about responsibility separation

**pathfinding.js (fixed earlier):**
- Skip units that have an attack target - they're handled by `updateUnitMovement()`
- Skip units whose path was calculated within the last 100ms

**unitMovement.js (fixed earlier):**
- Set BOTH `lastAttackPathCalcTime` AND `lastPathCalcTime` when calculating attack paths

## Files Modified

- `src/game/unitCombat/combatHelpers.js` - Removed duplicate path calculation
- `src/game/pathfinding.js` - Skip attack mode units (fixed earlier)
- `src/game/unitMovement.js` - Set both timestamps (fixed earlier)
- `tests/unit/pathfinding.test.js` - Updated test expectations
- `tests/unit/unitMovement.test.js` - Updated test expectations
