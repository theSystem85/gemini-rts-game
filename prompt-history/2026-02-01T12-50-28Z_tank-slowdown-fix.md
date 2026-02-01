# UTC: 2026-02-01T12:50:28Z
# LLM: Copilot (Claude Opus 4.5)

## Prompt

there is a bug when tanks (and maybe also other units) approach each other and they get in range that they then start to get really slow. Figure out the cause and Ensure this does not happen by fixing the issue!

## Analysis

The bug was caused by **two separate velocity reduction mechanisms** that compounded each other when units approached each other:

1. **Proactive avoidance forces** (in `calculateCollisionAvoidance`) - applied when units are within 36px (FORCE_FIELD_RADIUS)
2. **Reactive velocity damping** (in `checkUnitCollision`) - applied when units are within 24px (MIN_UNIT_DISTANCE)

The damping at lines 339-343 of `src/game/movementCollision.js` multiplied velocity by a factor as low as 0.3 (70% reduction) **per frame**. Combined with the avoidance forces, this caused exponential slowdown when units got close.

### Root Cause Code (removed):
```javascript
const velocityTowardOther = -(dx * unitVelX + dy * unitVelY) * invDist
if (velocityTowardOther > 0) {
  const dampingFactor = Math.max(0.3, 1 - overlap / MOVEMENT_CONFIG.MIN_UNIT_DISTANCE)
  unit.movement.velocity.x *= dampingFactor
  unit.movement.velocity.y *= dampingFactor
}
```

## Fix Applied

Removed the aggressive multiplicative velocity damping in `checkUnitCollision()`. The separation forces that follow (lines 345-349) are sufficient to push units apart without reducing their overall movement speed.

This fix allows units to maintain their movement speed while still avoiding collisions through the separation force mechanism.

## Files Changed

- `src/game/movementCollision.js` - Removed velocity damping block (lines 338-343)
