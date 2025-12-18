# Spec 020: Apache selection alignment

## Overview
Apache helicopters should respond to player selection exactly where the helicopter is rendered on screen. Selection hit tests must align with the sprite and HUD overlays rather than the midpoint between the helicopter and its shadow.

## Requirements
- Single-click selection, guard/force-attack targeting, and drag-selection logic must use the altitude-adjusted Apache center used for rendering.
- Utility queue interactions that gather units inside a selection rectangle must consider the lifted Apache position instead of the ground shadow center.
- Selection visuals (corner brackets, HUD bars) remain anchored to the same altitude-adjusted point as the hit tests.

## Validation
- Clicking on the Apache image or its HUD selects the unit; clicking on the shadow alone does not.
- Drag-selecting over the helicopter image adds it to the selection without requiring the box to reach toward the shadow.
