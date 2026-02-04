# Spec 026: Production Controller Code Splitting

## Summary
Refactor the production controller UI logic into focused modules so that no single file exceeds 1,000 lines and responsibilities are easier to navigate.

## Goals
- Keep `src/ui/productionController.js` under 1,000 LOC by delegating responsibilities to helper modules.
- Maintain existing production behavior and unit/building interactions.
- Keep each new helper module below 1,000 LOC.

## Modules
- **productionControllerButtonStates**: vehicle/building button enablement logic.
- **productionControllerButtonSetup**: production button wiring and event handlers.
- **productionControllerTechTree**: tech tree unlock and sync helpers.
- **productionControllerQueue**: queue count/remove helpers.
- **productionControllerTabs**: production tab and mobile toggle behavior.
- **productionControllerInteractions**: drag/edge scroll interactions for mobile.
- **productionTooltip**: long-press build-button tooltip rendering and selection focus behavior.

## Production Tooltips
- Long-press (>= 1s) on unit/building production buttons opens a detailed tooltip aligned with the money bar style.
- Unit tooltip shows build spend, restored counts, repair costs, per-unit status, and damage-value stats.
- Building tooltip shows description, cost, power, per-building health, and defense damage value.

## Non-Goals
- No behavior changes to production rules or queue logic.
- No UI layout or styling changes beyond the new long-press tooltip overlay.
