# Prompt History Entry

**UTC Timestamp:** 2025-12-18T14:30:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Request

Two issues:
1. Rocket tank sometimes fires on the map without user setting a target - fires on its own
2. Rockets chasing Apache get stuck below it, don't explode, and slow down while chasing

## Investigation

### Issue 1: Auto-firing rocket tank

Investigated all code paths that could cause rocket tanks to auto-fire:
- `updateRocketTankCombat()` only fires if `unit.target` is already set
- `updateGuardTargeting()` auto-targets enemies only when `unit.guardTarget` is set (guard mode)
- `processAttackQueue()` processes queued attack targets
- No auto-retaliation code exists for human player units (only AI units retaliate via `lastAttacker`)

**Conclusion:** Rocket tanks will auto-fire if:
1. They are in guard mode (guardTarget set)
2. They have an attack queue with targets
3. Player previously set a target that wasn't cleared

No code changes needed - this is expected behavior when guard mode is enabled.

### Issue 2: Rockets stuck below Apache

**Root Cause Found:** Rocket tank rockets have `skipCollisionChecks: true` to allow them to fly over units and buildings. However, they relied on normal collision detection to explode on contact, which was skipped!

The homing logic had a `distance <= 5` threshold where it stopped updating velocity, expecting collision detection to handle impact. But with collision checks skipped, rockets would just hover near the target.

## Changes Made

### src/game/bulletSystem.js

1. **Added explosion logic for homing rocket tank rockets** - When distance to target is <= 10 pixels, trigger explosion:
   - For rockets with valid target: explode at bullet position
   - For rockets with only targetPosition (target destroyed): explode at target position

2. **Increased distance threshold from 5 to 10** - Rockets move at speed 6, so 10 pixels ensures reliable hit detection without oscillation

## Code Changes

```javascript
// When homing rocket gets close to target, explode
if (distance > 10) {
  bullet.vx = (dx / distance) * bullet.effectiveSpeed
  bullet.vy = (dy / distance) * bullet.effectiveSpeed
} else if (bullet.originType === 'rocketTank') {
  // Explode when close enough (replaces collision detection)
  triggerExplosion(...)
  bullets.splice(i, 1)
  continue
}
```

This ensures rockets properly explode when they reach their target, even with `skipCollisionChecks: true`.
