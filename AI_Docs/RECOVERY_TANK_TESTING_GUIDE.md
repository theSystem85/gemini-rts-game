# Recovery Tank Testing Guide

## Quick Test Commands

### Basic Spawn Test
1. Open console (F12)
2. Type: `recoveryTank 1 red`
3. Watch console for assignment logs
4. Expected: Tank should move to nearest wreck within 1 second

### Multiple Spawn Test
1. Type: `recoveryTank 3 red`
2. Expected: All 3 tanks assigned to different wrecks (if available)

### All Enemy Players Test
```javascript
recoveryTank 1 red
recoveryTank 1 green
recoveryTank 1 blue
recoveryTank 1 yellow
```

## Cheat System Integration

### What Was Changed

The cheat system now:
1. **Immediately releases recovery tanks** from factory hold
2. **Sets freshlySpawned flag** to bypass cooldowns
3. **Triggers 3 assignment attempts** (50ms, 200ms, 500ms)
4. **Works for all enemy players** (red, green, blue, yellow)
5. **Logs assignment status** to console

### Code Flow
```
Cheat Command
  ↓
spawnUnitsAroundCursor()
  ↓
createUnit() - Creates unit
  ↓
Special Recovery Tank Init:
  - lastRecoveryCommandTime = 0
  - freshlySpawned = true
  - holdInFactory = false
  - spawnedInFactory = false
  ↓
Dynamic Import manageAIRecoveryTanks
  ↓
3 Assignment Attempts
  ↓
Tank Moves to Wreck
```

## Console Output to Watch For

### Successful Assignment
```
AI enemy1: 1 recovery tanks, 1 available for assignment
AI enemy1: 3 wrecks available for recovery
✓ Recovery tank abc123 assigned to wreck xyz789 via utility queue
✓ Triggered immediate recovery tank assignment for 1 cheat-spawned tanks
```

### No Wrecks Available
```
AI enemy1: 1 recovery tanks, 1 available for assignment
AI enemy1: 0 wrecks available for recovery
```

### Assignment Failure (Debug)
```
✗ Recovery tank abc123 assignment to wreck xyz789 failed
  hasQueue: true
  queueMode: repair
  currentTargetId: null
  resultStarted: false
```

## Creating Test Wrecks

### Method 1: Destroy Enemy Units
```javascript
// Give yourself a strong tank
tank-v3 1 player1
// Damage enemy until destroyed
```

### Method 2: Destroy Player Units
```javascript
// Spawn and destroy your own units
tank_v1 5 player1
// Damage until destroyed
// Enemy recovery tanks will collect them
```

### Method 3: Use God Mode
```javascript
godmode
// Fight enemies without dying
// Collect their wrecks
```

## Expected Behaviors

### ✅ Correct Behavior
- Tank spawns and immediately has assignment
- Tank moves toward nearest wreck within 1 second
- Console shows successful assignment logs
- Multiple tanks assigned to different wrecks
- Tanks prioritize closest wrecks

### ❌ Incorrect Behavior
- Tank stands still for >2 seconds
- Console shows "0 available for assignment"
- Console shows assignment failure
- Tanks ignore nearby wrecks
- Multiple tanks assigned to same wreck

## Troubleshooting

### Tank Not Moving
**Check:**
1. Are there wrecks on the map? (check console logs)
2. Is the tank missing crew? (check unit.crew.loader)
3. Is the tank in factory hold? (should be false)
4. Check console for assignment failures

### Assignment Fails
**Check:**
1. Is unitCommands handler available?
2. Are wrecks already assigned (assignedTankId)?
3. Is the tank already busy (check utilityQueue)?
4. Check console error messages

### No Console Logs
**Check:**
1. Console filters (should show "Info" level)
2. Browser console is open
3. Game is running (not paused)
4. Recovery tank was spawned for enemy (not player)

## Advanced Testing

### Test Ratio Maintenance
```javascript
// Spawn combat units
tank_v1 5 red
// Wait 2 seconds
status
// Should show 1 recovery tank built automatically
```

### Test Proximity Priority
```javascript
// Create wreck at different distances
// Spawn recovery tank between them
recoveryTank 1 red
// Should go to nearest wreck
```

### Test Multiple Players
```javascript
// Each player should manage independently
recoveryTank 1 red
recoveryTank 1 green
// Each should find their own wrecks
```

### Test Factory-Released Tanks
```javascript
// Normal AI production should also work
// Give AI money and wait
addmoney 10000 red
// Wait for AI to build recovery tank
// Should immediately get assignment
```

## Performance Monitoring

### What to Monitor
- Assignment time (<1 second)
- Pathfinding lag (should be minimal)
- Console log spam (should be moderate)
- Memory usage (no leaks)

### Optimization Checks
- Multiple assignment attempts (not infinite)
- Cooldown respected (after first assignment)
- Dynamic import cached (after first call)
- Proximity sorting efficient

## Integration with AI System

### Production Flow
```
AI Player Update
  ↓
Check Ratio (1:5 combat units)
  ↓
Build Recovery Tank
  ↓
Spawn in Factory
  ↓
Immediate Release + Assignment
  ↓
Tank Executes Task
```

### Cheat Flow
```
User Types Command
  ↓
Parse & Validate
  ↓
Spawn at Cursor
  ↓
Initialize Recovery Tank
  ↓
Immediate Assignment
  ↓
Tank Executes Task
```

## Known Limitations

1. **Assignment attempts:** Limited to 3 (prevents spam)
2. **Cooldown:** 2 seconds between assignments (after first)
3. **Pathfinding:** May take time for distant wrecks
4. **Factory hold:** Player recovery tanks still have hold time
5. **Debug logs:** May be verbose (intentional for testing)

## Success Criteria

### Must Pass
- [ ] Cheat-spawned tank moves within 1 second
- [ ] Tank finds nearest wreck
- [ ] Console shows assignment success
- [ ] Multiple tanks work independently
- [ ] Works for all enemy players

### Should Pass
- [ ] No assignment failures in console
- [ ] Smooth pathfinding to wreck
- [ ] Wreck gets towed successfully
- [ ] Tank returns for next wreck
- [ ] Ratio maintained automatically

### Nice to Have
- [ ] <500ms assignment time
- [ ] No console errors
- [ ] Works with 10+ tanks
- [ ] Efficient proximity sorting
- [ ] Minimal debug log spam

## Reporting Issues

If recovery tanks don't work after cheat spawn:

1. **Copy console logs** (all assignment messages)
2. **Note tank ID** (from console)
3. **Note wreck count** (from console)
4. **Screenshot** unit position
5. **Report** with full context

Example report:
```
Issue: Recovery tank not moving after cheat spawn
Command: recoveryTank 1 red
Console: "AI enemy1: 0 available for assignment"
Tank ID: abc123
Wrecks visible: 2
Expected: Tank should move to wreck
Actual: Tank stands still
```

## Next Steps

After testing:
1. Remove debug logs if too verbose
2. Tune assignment intervals if needed
3. Add wreck priority scoring
4. Consider zone-based assignments
5. Optimize for large wreck counts
