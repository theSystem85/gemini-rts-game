# Spec 016: Map editor mode

## Overview
A host-only map editor lets the host pause gameplay to paint terrain, place buildings, and spawn units directly onto the map. The tool works before any remote human joins; once a human participant connects, the editor is locked and the toggle is disabled.

## Core interactions
- Toggle **Edit Mode** from the map settings sidebar. Entering edit mode always pauses the game; pressing Play exits edit mode and resumes simulation.
- A floating preview under the cursor shows the current brush: tile image for terrain brushes or a labeled marker for building/unit brushes.
- Use the mouse wheel while editing to cycle the active tile brush. The sidebar controls mirror the current selection and random mode.
- Left-click and drag to paint the selected brush. Hold **Shift** while dragging to draw a fill box; the selection fills on release.
- Right-click paints random grass as an eraser, clearing overlays like ore/seed flags and no-build markers.
- Brushes respect random mode for terrain, choosing randomized variations for grass, street, rock, and water. Randomization is not applied to building or unit brushes.

## Placement rules
- Buildings and units picked from the build bar become brushes in edit mode and place instantly without production or wait timers. New entities inherit the host player’s party.
- Tile changes update SOT masks and occupancy continuously so movement and placement previews stay accurate during editing.
- Map edits are part of normal save/load flows; edited terrain and spawned entities persist when saving or loading games.

## Access control
- Editing is available only to the host and only before any other human player joins. When a human joins, the editor disables and exits if active.

## Additional tools
- New cheat code: `partyme [party]` switches the current player’s party and reassigns existing player-owned units/buildings to the chosen party.
