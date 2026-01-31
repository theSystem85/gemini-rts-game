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

## Non-Goals
- No behavior changes to production rules or queue logic.
- No UI layout or styling changes.
