# Spec 041: Radar Offline Grain Animation

## Goal
Restore visible animation to the minimap's "RADAR OFFLINE" background so it feels like a live, noisy monitor feed rather than a frozen texture.

## Requirements
1. When radar is inactive, the minimap must keep the existing "RADAR OFFLINE" visual treatment and warning text.
2. The offline grain/noise effect must animate continuously frame-to-frame.
3. The implementation should avoid expensive full random-noise regeneration every frame.
4. The animation should remain subtle and not reduce warning text readability.

## Acceptance Criteria
- Radar offline state shows motion in the background grain while text remains centered and legible.
- Performance remains stable because animation reuses cached texture data with lightweight transforms/compositing.
- Radar active behavior remains unchanged.
