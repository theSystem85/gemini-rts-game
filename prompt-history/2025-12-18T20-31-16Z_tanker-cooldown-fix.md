# Prompt History

**Timestamp:** 2025-12-18T20:31:16Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Prompt

ensure the enemy ai tanker truck does not get more often then every 10s a new target. Ensure the new target is not set before the current target got served.

## Implementation Summary

Fixed enemy AI tanker truck target assignment to prevent frequent target switching:

### Changes Made

1. **Added cooldown to non-unitCommands path** ([enemyStrategies.js](../src/ai/enemyStrategies.js#L1725-L1758))
   - Applied the existing `AUTO_REFUEL_SCAN_INTERVAL` (10 seconds) cooldown mechanism to the `else if` block that handles low gas units when `unitCommands` is not available
   - Added check: `if (now < nextScan) return` to prevent target assignment during cooldown
   - Set `tanker.nextAITankerScanTime = now + AUTO_REFUEL_SCAN_INTERVAL` when a new target is assigned

2. **Verified existing safeguards**
   - Confirmed that the check `if (tanker.refuelTarget || queueActive) return` at line 1694 already prevents tankers from getting new targets while serving the current target
   - This ensures a tanker completes its current refueling mission before accepting a new one

### Technical Details

- The `AUTO_REFUEL_SCAN_INTERVAL` constant (10000ms = 10 seconds) was already defined and used in the unitCommands path
- The fix extends this cooldown behavior to the simpler fallback path that directly assigns targets
- Tankers track their next scan time in `tanker.nextAITankerScanTime` property
- The cooldown prevents both new utility queue creation and direct target assignment during the interval

### Result

Enemy AI tanker trucks now:
- Wait at least 10 seconds between target assignments in all code paths
- Complete their current refueling mission before accepting a new target
- Behave consistently whether using the utility queue system or direct target assignment
