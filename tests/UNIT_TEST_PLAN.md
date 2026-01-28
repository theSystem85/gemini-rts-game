# Unit Test Plan for Gemini RTS Game

This document outlines the prioritized unit test plan for achieving comprehensive test coverage across the codebase. Tests are organized by priority and can be implemented iteratively.

## Testing Strategy

- **Environment**: Vitest with jsdom, running headless without rendering
- **Mocking**: Audio, Canvas, WebGL are mocked in `tests/setup.js`
- **Utilities**: Use `tests/testUtils.js` for game state management

---

## Priority 1: Core Game Logic (Critical Path)

These tests cover the most critical game mechanics that affect gameplay correctness.

### 1.1 ✅ Building Placement Validation
**File**: `tests/integration/buildingPlacement.test.js` *(COMPLETED)*
- [x] Building distance constraints (MAX_BUILDING_GAP_TILES)
- [x] Tile occupation checks
- [x] Adjacent placement validation

### 1.2 ✅ Pathfinding Core
**File**: `tests/unit/pathfinding.test.js` *(COMPLETED)*
- [x] A* algorithm correctness with obstacles
- [x] Path caching validity and TTL
- [x] Occupancy map integration
- [x] Formation movement path calculation
- [x] Edge cases: blocked paths, unreachable destinations

### 1.3 ✅ Unit Combat System
**File**: `tests/unit/unitCombat.test.js` *(COMPLETED)*
- [x] Target acquisition and priority
- [x] Turret rotation and aiming thresholds
- [x] Damage calculation and application
- [x] Range checking for different unit types
- [x] Line of sight / clear shot detection

### 1.4 ✅ Mine System
**File**: `tests/unit/mineSystem.test.js` *(COMPLETED)*
- [x] Mine creation and deployment
- [x] Arming delay logic
- [x] Detonation triggers (enemy proximity)
- [x] Chain reaction mechanics
- [x] Mine detection (sweeper behavior)
- [x] Owner-based mine avoidance

---

## Priority 2: Utility & Helper Functions

Pure functions that are easy to test in isolation.

### 2.1 ✅ Base Utilities
**File**: `tests/unit/baseUtils.test.js` *(COMPLETED)*
- [x] `getBaseStructures()` - gathering structures by owner
- [x] `isWithinBaseRange()` - Chebyshev distance calculation
- [x] Structure normalization
- [x] Edge cases (null entries, missing properties, negative coords)

### 2.2 ✅ Game Random Utilities  
**File**: `tests/unit/gameRandom.test.js` *(COMPLETED)*
- [x] `gameRandom()` - basic random number generation
- [x] `gameRandomInt()` - integer range
- [x] `gameRandomFloat()` - float range
- [x] `gameRandomElement()` - array selection
- [x] `gameShuffle()` - array shuffling
- [x] Deterministic mode consistency

### 2.3 ✅ General Utilities
**File**: `tests/unit/utils.test.js` *(COMPLETED)*
- [x] `getUniqueId()` - unique ID generation
- [x] `tileToPixel()` - coordinate conversions
- [x] `getBuildingIdentifier()` - building identification
- [x] `calculateHealthSpeedModifier()` - health-based speed
- [x] Unit leveling system functions
- [x] Experience and level progression

---

## Priority 3: Game Systems

More complex systems that require state management.

### 3.1 ✅ Bullet/Projectile System
**File**: `tests/unit/bulletSystem.test.js` *(COMPLETED)*
- [x] Bullet creation with correct properties
- [x] Bullet movement and trajectory
- [x] Collision detection with units
- [x] Collision detection with buildings
- [x] Explosion radius damage

### 3.2 ✅ Resource & Economy System
**File**: `tests/unit/resourceSystem.test.js` *(COMPLETED)*
- [x] Money tracking and transactions
- [x] Power supply calculation
- [x] Power consumption tracking
- [x] Build speed modifiers (low power penalty)
- [x] Low energy mode and radar activation
- [x] Building repair cost calculation

### 3.3 ✅ Building System
**File**: `tests/unit/buildingSystem.test.js` *(COMPLETED)*
- [x] Building creation with correct properties
- [x] Building placement and tile occupation
- [x] Building removal and tile restoration
- [x] Power grid integration
- [x] Building damage tracking
- [x] Building repair mechanics

### 3.4 ✅ Production Queue
**File**: `tests/unit/productionQueue.test.js` *(COMPLETED)*
- [x] Queue unit and building production
- [x] Vehicle factory and construction yard multipliers
- [x] Pause/resume production
- [x] Cancel production with refunds
- [x] Completed buildings management
- [x] Serializable state for save/load

---

## Priority 4: Unit Behaviors

Specialized unit behavior modules.

### 4.1 ✅ Harvester Logic
**File**: `tests/unit/harvesterLogic.test.js` *(COMPLETED)*
- [x] Ore field detection and targeting
- [x] Harvesting timer and capacity
- [x] Return to refinery behavior
- [x] Unloading ore at refinery
- [x] Auto-resume harvesting
- [x] Refinery queue management
- [x] Power-affected unload timing
- [x] Enemy harvester budget credit

### 4.2 ✅ Ambulance System
**File**: `tests/unit/ambulanceSystem.test.js` *(COMPLETED)*
- [x] Wounded unit detection
- [x] Healing application
- [x] Hospital interaction
- [x] Crew requirement checks
- [x] Alert mode scanning
- [x] Utility queue integration

### 4.3 ✅ Recovery Tank System
**File**: `tests/unit/recoveryTankSystem.test.js` *(COMPLETED)*
- [x] Wreck detection
- [x] Towing mechanics
- [x] Workshop delivery
- [x] Recycling wrecks for money
- [x] Auto-repair of nearby damaged units
- [x] Alert mode scanning
- [x] Crew loader requirement

### 4.4 ✅ Mine Layer/Sweeper
**File**: `tests/unit/mineLayerSweeper.test.js` *(COMPLETED)*
- [x] Mine deployment from layer (startMineDeployment, updateMineLayerBehavior)
- [x] Capacity tracking (remainingMines decrement, zero-mine handling)
- [x] Sweeper detection behavior (activateSweepingMode, deactivateSweepingMode)
- [x] Sweeper clearing mechanics (calculateZigZagSweepPath, calculateFreeformSweepPath)
- [x] Speed modulation (deploy speed vs normal speed)
- [x] Dust particle generation (generateSweepDust)
- [x] Path orientation handling (horizontal/vertical start directions)

### 4.5 ✅ Tanker/Gas Station
**File**: `tests/unit/tankerLogic.test.js` *(COMPLETED)*
- [x] Fuel tracking (gas/maxGas percentage)
- [x] Refueling at gas station (updateGasStationLogic)
- [x] Tanker supply gas refill (supplyGas tracking)
- [x] Cost calculation and deduction (player money, AI budget)
- [x] Refueling state management (refueling flag, gasRefillTimer)
- [x] Service radius handling
- [x] Moving unit exclusion

---

## Priority 5: AI Systems

Enemy AI and behavior systems.

### 5.1 🔲 Enemy AI Player
**File**: `tests/unit/enemyAI.test.js`
- [ ] AI decision making
- [ ] Attack target selection
- [ ] Defense behavior
- [ ] Resource management AI

### 5.2 🔲 Steering Behaviors
**File**: `tests/unit/steeringBehaviors.test.js`
- [ ] Separation from other units
- [ ] Collision avoidance
- [ ] Smooth rotation

---

## Priority 6: Network/Multiplayer (If Applicable)

### 6.1 🔲 Command Synchronization
**File**: `tests/unit/commandSync.test.js`
- [ ] Command serialization
- [ ] Command deserialization
- [ ] State hash calculation

### 6.2 ✅ Deterministic Random
**File**: `tests/unit/deterministicRandom.test.js` *(COMPLETED)*
- [x] Seed initialization
- [x] Sequence reproducibility
- [x] Cross-client consistency
- [x] State save/restore
- [x] Per-tick synchronization

---

## Implementation Notes

### Test File Structure
```
tests/
├── setup.js              # Test environment setup
├── testUtils.js          # Shared test utilities
├── UNIT_TEST_PLAN.md     # This file
├── integration/          # Integration tests
│   └── buildingPlacement.test.js
└── unit/                 # Unit tests
    ├── pathfinding.test.js
    ├── unitCombat.test.js
    ├── bulletSystem.test.js
    ├── mineSystem.test.js
    ├── baseUtils.test.js
    ├── gameRandom.test.js
    ├── deterministicRandom.test.js
    ├── utils.test.js
    ├── resourceSystem.test.js
    ├── buildingSystem.test.js
    ├── productionQueue.test.js
    ├── harvesterLogic.test.js
    ├── ambulanceSystem.test.js
    └── recoveryTankSystem.test.js
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/pathfinding.test.js

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Conventions
1. Use `describe()` blocks for logical grouping
2. Use `beforeEach()` to reset game state
3. Use `afterEach()` for cleanup
4. Test both success and failure cases
5. Include edge cases (empty arrays, boundary values)
6. Keep tests isolated - no dependencies between tests

---

## Progress Tracking

| Priority | Category | Tests | Status |
|----------|----------|-------|--------|
| 1.1 | Building Placement | 25+ | ✅ Done |
| 1.2 | Pathfinding | 47 | ✅ Done |
| 1.3 | Unit Combat | 54 | ✅ Done |
| 1.4 | Mine System | 48 | ✅ Done |
| 2.1 | Base Utils | 24 | ✅ Done |
| 2.2 | Game Random | 40 | ✅ Done |
| 2.3 | Utils | 69 | ✅ Done |
| 3.1 | Bullet System | 55 | ✅ Done |
| 3.2 | Resource System | 44 | ✅ Done |
| 3.3 | Building System | 56 | ✅ Done |
| 3.4 | Production Queue | 49 | ✅ Done |
| 4.1 | Harvester Logic | 31 | ✅ Done |
| 4.2 | Ambulance System | 32 | ✅ Done |
| 4.3 | Recovery Tank | 31 | ✅ Done |
| 4.4-5 | Other Unit Behaviors | ~25 | 🔲 Pending |
| 5.x | AI Systems | ~10 | 🔲 Pending |
| 6.1 | Command Sync | ~8 | 🔲 Pending |
| 6.2 | Deterministic Random | 49 | ✅ Done |

---

## Next Steps

1. **Immediate**: Implement `tests/unit/enemyAI.test.js` (Priority 5.1) - AI decision making
2. **Then**: Implement `tests/unit/steeringBehaviors.test.js` (Priority 5.2) - unit movement behaviors
3. **Continue**: Work through priority 6.1 (Command Synchronization)

**Total Tests: 736** (across 17 test files)

Last Updated: 2025-01-28
