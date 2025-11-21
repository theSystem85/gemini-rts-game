# Feature Specification: Restoration Move Override Reset

**Feature Branch**: `013-restoration-move-override`
**Created**: 2025-11-22
**Status**: Completed
**Input**: "The restorationMoveOverride flag intended to let restored, crewless units move to their rally point never turns off if the unit receives a different move order before reaching that rally tile. Clear both restorationMoveOverride and restorationMoveTarget whenever new movement orders are issued."

---

## Overview

Restored, crewless units are temporarily allowed to move toward the assigned rally tile even without gas. That override must end as soon as a player issues a fresh movement order so the unit cannot exploit the override to roam freely.

---

## Requirements

1. **Reset on New Commands**
   - Any manual movement order should immediately set `restorationMoveOverride` to `false` and `restorationMoveTarget` to `null` before calculating new paths.

2. **Override Scope**
   - The restoration override only applies to the initial rally-point path issued at the workshop and should never persist once the unit accepts a different destination.

3. **State Consistency**
   - Movement handlers must leave the unit with a clean path/target state for subsequent orders so standard gas and crew checks resume.
