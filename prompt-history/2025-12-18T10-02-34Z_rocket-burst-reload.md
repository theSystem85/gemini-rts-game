# Prompt History

**Timestamp:** 2025-12-18T10:02:34Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Prompt

the reload phase should only begin after an entire 4 rockets burst was completed.

## Implementation Summary

Fixed the rocket tank burst fire system to ensure the reload phase (cooldown) only begins after all 4 rockets in a burst have been fired.

### Changes Made

1. **src/game/unitCombat.js** - `updateRocketTankCombat` function:
   - Added comment clarifying that `lastShotTime` should NOT be set when starting a burst
   - Only `lastShotTime` is set when the burst completes in `handleRocketBurstFire` (line 483)
   - This ensures the cooldown/reload phase begins AFTER the entire burst, not when it starts

2. **src/game/remoteControl.js** - Remote control rocket tank firing:
   - Implemented burst fire system for remote-controlled rocket tanks
   - Previously fired individual rockets with cooldown after each rocket
   - Now fires 4-rocket bursts with 200ms delay between rockets
   - Reload phase starts only after all 4 rockets are fired
   - Stores target in `burstState.remoteControlTarget` for consistent aiming throughout burst
   - Sets `unit.lastShotTime = now` only when burst completes

### Technical Details

**Burst Configuration:**
- Burst count: 4 rockets (COMBAT_CONFIG.ROCKET_BURST.COUNT)
- Delay between rockets: 200ms (COMBAT_CONFIG.ROCKET_BURST.DELAY)
- Reload cooldown: Starts after 4th rocket fires, not after 1st

**Burst State Tracking:**
```javascript
unit.burstState = {
  rocketsToFire: 4, // Decrements with each rocket
  lastRocketTime: 0, // Tracks timing between rockets
  remoteControlTarget: {...} // (remote control only) Stores aim target
}
```

**Before:** Reload started immediately when first rocket fired  
**After:** Reload starts only after 4th rocket completes

### Testing Notes

- Test normal combat: Rocket tanks should fire 4 rockets in quick succession, then reload
- Test remote control: Same burst behavior when using space bar or auto-fire
- Verify reload bar shows progress only after entire burst completes
- Check ammunition depletion: Partial bursts (e.g., 2 rockets) when low on ammo still work correctly
