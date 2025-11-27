# Multiplayer Client Attack Fix

**UTC Timestamp:** 2025-11-26T15:14:11Z
**LLM:** Claude (Copilot)

## User Request

When client tank is commanded to attack host's tank, it aims at it but does not fire. The logs show the attack command is being sent successfully from client and received by host, with the target being set correctly on the unit, but the unit doesn't actually fire.

Also requested: Remove the console log for `game-state-snapshot` broadcasting commands.

## Analysis

The issue was in the `canAttack` check in all combat functions in `src/game/unitCombat.js`. The check was:

```javascript
const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
```

In multiplayer:
- Host is `player1` and `gameState.humanPlayer` on host = `player1`
- Client's units have `owner = 'player2'`
- So for client units: `'player2' === 'player1'` → FALSE
- The fallback check `unit.allowedToAttack === true` is an AI permission flag, which human-controlled units don't have

This meant client-controlled units could never fire because they failed the `canAttack` check.

## Solution

1. Added a helper function `isHumanControlledParty(owner)` that checks:
   - If `owner === gameState.humanPlayer` (local player)
   - OR if `gameState.partyStates` has a party with `partyId === owner` and `aiActive === false` (multiplayer human player)

2. Replaced all 6 `canAttack` checks in combat functions to use the new helper:
   - `updateTankCombat`
   - `updateTankV2Combat`
   - `updateTankV3Combat`
   - `updateRocketTankCombat`
   - `updateApacheCombat` (in `fireApacheRockets`)
   - `updateHowitzerCombat`

3. Also fixed 2 alert mode checks that were using `gameState.humanPlayer` directly

4. Suppressed the `game-state-snapshot` log in `gameCommandSync.js` by adding a condition before the log statement

## Files Changed

- `src/game/unitCombat.js` - Added `isHumanControlledParty()` helper and updated 8 checks
- `src/network/gameCommandSync.js` - Suppressed game-state-snapshot broadcast log

## Testing

After the fix, client-controlled units should be able to:
1. Fire at host's units when commanded to attack
2. Use alert mode to automatically acquire targets
3. All unit types (tanks, rocket tanks, apaches, howitzers) should work correctly
