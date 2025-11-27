# Multiplayer Defeat Modal UI Improvements

**UTC Timestamp:** 2025-11-27T15:37:16Z  
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Original Prompt

User requested 5 multiplayer improvements:

1. **Client Defeat Modal**: The defeat screen should also be shown for invited clients (currently only shows after disconnect)
2. **BattleLost Sound Loop**: When host gets defeated, the "battleLost" sound should not loop or play more than once
3. **Defeat Label Wrapping**: Ensure the label "DEFEAT - All your buildings have been destroyed!" wraps inside the modal and doesn't overflow
4. **Player Alias Display**: Above the health bar of construction yards, show the alias of that player to all other players
5. **Power/Money Sync**: Power and money values on construction yard HUD should be in sync with player values in multiplayer, with a host toggle to show/hide

## Implementation Summary

### Files Modified

1. **src/network/gameCommandSync.js**
   - Added `defeatedPlayers` array to `createGameStateSnapshot()` for syncing defeated players to clients
   - Added `showEnemyResources` setting to snapshot
   - Added client-side defeat detection in `applyGameStateSnapshot()` - checks if local player is in defeatedPlayers and triggers defeat modal + sound

2. **src/game/gameStateManager.js**
   - Added `_defeatSoundPlayed` guard flag to prevent battleLost sound from looping
   - Shortened `gameOverMessage` to just "DEFEAT" (subtitle now handled separately in renderer)
   - Added tracking for defeat sound flag in multiplayer and single player paths

3. **src/rendering/uiRenderer.js**
   - Split defeat message into title ("DEFEAT"/"VICTORY") and wrapped subtitle
   - Added text wrapping logic for subtitle to fit within modal width
   - Subtitle rendered in smaller font below main title

4. **src/rendering/buildingRenderer.js**
   - Added `renderPlayerAlias()` function to show player alias above construction yards
   - Only shows in multiplayer mode for human-controlled parties (not "AI")
   - Uses party color for the alias text
   - Updated `renderFactoryBudget()` and `renderFactoryPowerStatus()` to respect `showEnemyResources` setting

5. **src/gameState.js**
   - Added `_defeatSoundPlayed: false` guard flag
   - Added `showEnemyResources: false` setting

6. **src/main.js**
   - Added event handler for `showEnemyResourcesCheckbox`
   - Reset defeat-related flags on game reset (`_defeatSoundPlayed`, `localPlayerDefeated`, `isSpectator`)

7. **src/ui/remoteInviteLanding.js**
   - Hide `showEnemyResourcesLabel` for clients (host-only setting)
   - Re-show checkbox when client disconnects

8. **index.html**
   - Added "Show Enemy Resources" checkbox in Map Settings section

### Key Features

- **Client Defeat Detection**: `defeatedPlayers` Set synced from host to clients via snapshot; clients check if their `humanPlayer` is in the set and trigger local defeat modal + sound
- **Sound Guard**: `_defeatSoundPlayed` flag prevents multiple plays of battleLost sound
- **Text Wrapping**: Subtitle uses word-by-word wrapping algorithm with `ctx.measureText()` to fit within modal
- **Alias Display**: Shows alias from `partyState.owner` above construction yards in multiplayer
- **Resource Toggle**: Host can enable/disable enemy resource display via checkbox
