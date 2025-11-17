# Feature Specification: Unit Fume Smoke Optimization

**Feature Branch**: `011-unit-smoke-optimization`
**Created**: 2025-11-17
**Status**: In Progress
**Input**: "I noticed that the performance is drastically reduced when units show the fume animation when damaged heavily like tanks that have less than 25% HP. I guess there are just way too many particles drawn simultaneously. Make sure to make this specific particle animation more efficient and/or just reduce the number of sprites being drawn to simulate the fume."

---

## Overview

Heavily damaged ground vehicles currently flood the scene with smoke particles, causing performance drops when many units emit fumes at once. This update throttles unit-specific smoke so the visual cue remains readable while sharply reducing the number of simultaneous particles.

---

## Requirements

1. **Slower Unit Emission Cadence**  
   - Increase the unit fume emission interval so each damaged tank/harvester emits smoke no more frequently than roughly every 320 ms.
2. **Global Soft Cap for Unit Fumes**  
   - Stop emitting additional unit smoke whenever the shared smoke pool exceeds 60% of the configured maximum particle budget; resume automatically when counts fall below the threshold.
3. **Single-Particle Puffs**  
   - Limit each emission tick for damaged units to a single particle to minimize draw calls while keeping the smoke cue visible.
4. **Scoped Change**  
   - Ensure building smoke emission intervals and visuals remain unchanged; only damaged unit fumes are throttled.
5. **Pooling Compliance**  
   - Continue using the existing smoke particle pooling to avoid extra allocations while enforcing the new limits.
