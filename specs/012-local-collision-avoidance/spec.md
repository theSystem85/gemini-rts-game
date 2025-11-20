# Feature Specification: Local Collision Lookahead for Units

**Feature Branch**: `012-local-collision-avoidance`
**Created**: 2025-01-14
**Status**: In Progress
**Input**: "ensure all units when moving prevent moving into obstacles before the actually collide with them when in close proximity to an obstacle (use local occupancy map for that) so that they change direction just in time (ensure not to change the actual high level path planning for that for efficiency reasons). Make sure to find an efficient solution to prevent units bouncing into wall or each other. Just some sort of look ahead short path prediction and avoidance!"

---

## Overview

Units should anticipate nearby blockers using the existing occupancy map and gently adjust their steering before actual contact. The goal is to keep the high-level path intact while reducing bouncebacks against walls and other units through short-range lookahead and micro-adjustments.

---

## Requirements

1. **Occupancy-Aware Lookahead**
   - Probe tiles immediately ahead of a moving unit (sub-tile increments) using the occupancy map and map grid; treat any occupied or impassable tile as a hazard.
2. **Gentle Steering Adjustments**
   - Apply lightweight avoidance forces that nudge movement away from detected hazards without rerunning high-level pathfinding.
3. **Unit and Obstacle Coverage**
   - Consider both static blockers (terrain, buildings, bounds) and nearby ground units when evaluating lookahead tiles.
4. **Performance-Conscious**
   - Keep the lookahead checks local (a few tiles at most) to preserve frame performance and avoid altering global path planning.
