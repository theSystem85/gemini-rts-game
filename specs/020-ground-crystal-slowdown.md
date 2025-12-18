# Spec 020: Crystal terrain slowdown

## Requirement
Ground units should drive 30% slower whenever they are traveling across crystal tiles. Harvesters are exempt from this slowdown.

## Details
- A "crystal tile" is any map tile that currently has ore crystals (`tile.ore === true`). Seed crystal tiles remain impassable and are not part of this slowdown rule.
- The slowdown applies only to ground units; airborne units keep their normal flight speeds.
- Apply a 0.7× movement speed multiplier while the ground unit is on an ore tile. This multiplier stacks with other terrain modifiers (for example, street speed boosts still apply when relevant).
- Harvesters continue to drive at their normal speed on ore tiles so that harvesting efficiency is unchanged.
