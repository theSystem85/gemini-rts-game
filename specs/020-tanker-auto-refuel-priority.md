# Tanker auto-refuel priority and thresholds

## Summary
- Tanker trucks only auto-assign refueling when a unit's fuel is below 50% of its maximum.
- Auto-service builds a stable to-do list every 10 seconds when idle, ordered by lowest fuel percentage (distance as a tiebreaker) and served without re-prioritizing mid-queue.
- User-issued queues (including AGF drag selections) replace any auto-selected targets and block new auto scans until all user targets are finished.
- When selected, tanker trucks render the queued target list with the standard yellow utility markers/lines used by recovery tanks.
- Emergency refueling for empty units still bypasses normal thresholds.

## Notes
- Applies to both player-controlled automatic tanker behaviors (alert mode/nearby auto-serve) and enemy AI tanker routing.
- Manual refuel orders are unaffected and may target any valid unit.
