# Tanker auto-refuel priority and thresholds

## Summary
- Tanker trucks only auto-assign refueling when a unit's fuel is below 50% of its maximum.
- When multiple candidates exist, choose the unit with the lowest fuel percentage; if tied, prefer the closer target.
- Emergency refueling for empty units still bypasses normal thresholds.

## Notes
- Applies to both player-controlled automatic tanker behaviors (alert mode/nearby auto-serve) and enemy AI tanker routing.
- Manual refuel orders are unaffected and may target any valid unit.
