# E2E Tank Fuel Test - Tanker Refueling

**Timestamp**: 2026-02-02T21:12:31Z  
**LLM**: GitHub Copilot (Claude Haiku 4.5)

## Request Summary

Update the E2E test (`tests/e2e/basicGameFlow.test.js`) to properly test tanker truck refueling:

1. Ensure the tank is selected BEFORE applying the "fuel 0" cheat so the cheat targets the tank
2. Apply the "fuel 0" cheat to drain the tank's fuel
3. Verify tanker truck exists and was built
4. Command the tanker truck to move to the tank to refill it when right-clicked

## Changes Made

### Modified Step 12: Tanker Refueling Test

- **Before**: The test was applying the "fuel 0" cheat without ensuring the tank was selected first, making it unclear which unit would be affected
- **After**: 
  - First selects the tank unit by clicking on it
  - Takes a screenshot to confirm tank is selected
  - Opens cheat console and applies "fuel 0" to the selected tank
  - Selects the tanker truck
  - Right-clicks on the tank to command the tanker to move to it for refueling
  - Waits for refueling to complete
  - Re-selects the tank to verify fuel has been restored

### Modified Step 13: Tank Move Command

- Simplified tank selection for move command
- Updated screenshot numbering to reflect new path

### Updated Screenshot Paths

- Changed from `test-results/22-unit-emptied-cheat.png` to `test-results/23-tank-fuel-emptied-cheat.png`
- Updated all subsequent screenshot numbers to maintain sequential ordering
- Final state screenshot moved from `29-final-state.png` to `30-final-state.png`

## Test Flow

The updated test now properly demonstrates:
1. Tank production and selection
2. Fuel depletion via cheat on selected unit
3. Tanker truck production
4. Tanker truck movement to refuel the tank
5. Fuel restoration verification

## Screenshots Generated

- `22-tank-selected-for-cheat.png` - Tank selected before cheat
- `23-tank-fuel-emptied-cheat.png` - Tank after fuel cheat applied
- `24-tank-displayed-with-empty-fuel.png` - Tank HUD showing empty fuel
- `25-tanker-truck-selected.png` - Tanker truck selected
- `26-tanker-refuel-command-issued.png` - Refuel command issued
- `27-tank-after-refuel.png` - Tank after refueling
- `28-tank-selected-for-move.png` - Tank selected for movement
- `29-tank-move-command.png` - Tank move command issued
- `30-final-state.png` - Final game state
