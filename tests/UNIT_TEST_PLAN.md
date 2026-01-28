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

### 1.2 🔲 Pathfinding Core
**File**: `tests/unit/pathfinding.test.js`
- [ ] A* algorithm correctness with obstacles
- [ ] Path caching validity and TTL
- [ ] Occupancy map integration
- [ ] Formation movement path calculation
- [ ] Edge cases: blocked paths, unreachable destinations

### 1.3 🔲 Unit Combat System
**File**: `tests/unit/unitCombat.test.js`
- [ ] Target acquisition and priority
- [ ] Turret rotation and aiming thresholds
- [ ] Damage calculation and application
- [ ] Range checking for different unit types
- [ ] Line of sight / clear shot detection

### 1.4 🔲 Mine System
**File**: `tests/unit/mineSystem.test.js`
- [ ] Mine creation and deployment
- [ ] Arming delay logic
- [ ] Detonation triggers (enemy proximity)
- [ ] Chain reaction mechanics
- [ ] Mine detection (sweeper behavior)
- [ ] Owner-based mine avoidance

---

## Priority 2: Utility & Helper Functions

Pure functions that are easy to test in isolation.

### 2.1 ✅ Base Utilities
**File**: `tests/unit/baseUtils.test.js` *(COMPLETED)*
- [x] `getBaseStructures()` - gathering structures by owner
- [x] `isWithinBaseRange()` - Chebyshev distance calculation
- [x] Structure normalization
- [x] Edge cases (null entries, missing properties, negative coords)

### 2.2 🔲 Game Random Utilities  
**File**: `tests/unit/gameRandom.test.js`
- [ ] `gameRandom()` - basic random number generation
- [ ] `gameRandomInt()` - integer range
- [ ] `gameRandomFloat()` - float range
- [ ] `gameRandomElement()` - array selection
- [ ] `gameShuffle()` - array shuffling
- [ ] Deterministic mode consistency

### 2.3 🔲 General Utilities
**File**: `tests/unit/utils.test.js`
- [ ] `getUniqueId()` - unique ID generation
- [ ] Distance calculations
- [ ] Angle normalization and difference
- [ ] Coordinate conversions (tile ↔ pixel)

---

## Priority 3: Game Systems

More complex systems that require state management.

### 3.1 🔲 Bullet/Projectile System
**File**: `tests/unit/bulletSystem.test.js`
- [ ] Bullet creation with correct properties
- [ ] Bullet movement and trajectory
- [ ] Collision detection with units
- [ ] Collision detection with buildings
- [ ] Explosion radius damage

### 3.2 🔲 Resource & Economy System
**File**: `tests/unit/resourceSystem.test.js`
- [ ] Money tracking and transactions
- [ ] Power supply calculation
- [ ] Power consumption tracking
- [ ] Harvester ore collection
- [ ] Resource deposit/withdrawal

### 3.3 🔲 Building System
**File**: `tests/unit/buildingSystem.test.js`
- [ ] Building construction initiation
- [ ] Construction progress over time
- [ ] Power grid integration
- [ ] Building damage and destruction
- [ ] Building repair mechanics

### 3.4 🔲 Production Queue
**File**: `tests/unit/productionQueue.test.js`
- [ ] Queue unit production
- [ ] Production timing and cooldowns
- [ ] Spawn location determination (Vehicle Factory vs Helipad)
- [ ] Queue cancellation and refunds

---

## Priority 4: Unit Behaviors

Specialized unit behavior modules.

### 4.1 🔲 Harvester Logic
**File**: `tests/unit/harvesterLogic.test.js`
- [ ] Ore field detection and targeting
- [ ] Harvesting timer and capacity
- [ ] Return to refinery behavior
- [ ] Unloading ore at refinery
- [ ] Auto-resume harvesting

### 4.2 🔲 Ambulance System
**File**: `tests/unit/ambulanceSystem.test.js`
- [ ] Wounded unit detection
- [ ] Healing application
- [ ] Hospital interaction

### 4.3 🔲 Recovery Tank System
**File**: `tests/unit/recoveryTankSystem.test.js`
- [ ] Wreck detection
- [ ] Towing mechanics
- [ ] Workshop delivery

### 4.4 🔲 Mine Layer/Sweeper
**File**: `tests/unit/mineLayerSweeper.test.js`
- [ ] Mine deployment from layer
- [ ] Capacity tracking
- [ ] Sweeper detection behavior
- [ ] Sweeper clearing mechanics

### 4.5 🔲 Tanker/Gas Station
**File**: `tests/unit/tankerLogic.test.js`
- [ ] Fuel tracking
- [ ] Refueling at gas station
- [ ] Fuel consumption by units

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

### 6.2 🔲 Deterministic Random
**File**: `tests/unit/deterministicRandom.test.js`
- [ ] Seed initialization
- [ ] Sequence reproducibility
- [ ] Cross-client consistency

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
    ├── mineSystem.test.js
    ├── baseUtils.test.js
    ├── gameRandom.test.js
    └── ...
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
| 1.2 | Pathfinding | ~10 | 🔲 Pending |
| 1.3 | Unit Combat | ~15 | 🔲 Pending |
| 1.4 | Mine System | ~10 | 🔲 Pending |
| 2.1 | Base Utils | 24 | ✅ Done |
| 2.2 | Game Random | ~8 | 🔲 Pending |
| 2.3 | Utils | ~8 | 🔲 Pending |
| 3.x | Game Systems | ~30 | 🔲 Pending |
| 4.x | Unit Behaviors | ~25 | 🔲 Pending |
| 5.x | AI Systems | ~10 | 🔲 Pending |
| 6.x | Network | ~8 | 🔲 Pending |

---

## Next Steps

1. **Immediate**: Implement `tests/unit/baseUtils.test.js` (Priority 2.1) - pure utility functions are easiest to test
2. **Then**: Implement `tests/unit/mineSystem.test.js` (Priority 1.4) - critical game mechanic
3. **Continue**: Work through priorities 1.2, 1.3, etc.

Last Updated: 2025-01-28
