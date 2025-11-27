# Multiplayer Defeat Handling & Spectator Mode

**UTC Timestamp:** 2025-11-27T14:54:54Z  
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Original Prompt

User requested 3 multiplayer improvements:

1. **Defeated Player Modal**: When a human player is defeated, show the defeat modal with statistics (make the modal more beautiful and mobile optimized), then show 2 buttons: one for creating a new game and another for continuing the multiplayer session as a spectator where they can see the entire map but cannot do anything anymore.

2. **Host Defeat Handling**: Ensure that when the host is defeated the game still runs for all the other players. The host will see the same end game modal as all the other players.

3. **Money Earned Statistics Fix**: Fix the 'money earned' statistics on the end game screen - they always show 0.

## Implementation Summary

### Files Modified

1. **src/game/harvesterLogic.js** (~line 477)
   - Added `gameState.totalMoneyEarned += moneyEarned` when human player's harvester deposits ore
   - This was the bug causing "money earned" to always show 0

2. **src/gameState.js**
   - Added `isSpectator: false` - flag for spectator mode
   - Added `spectatorShadowOfWarDisabled: false` - allows spectators to see entire map
   - Added `localPlayerDefeated: false` - tracks if local player is defeated in multiplayer

3. **src/game/gameStateManager.js** - `checkGameEndConditions()`
   - Complete rewrite for multiplayer support (~80 lines)
   - Multiplayer defeat sets `localPlayerDefeated = true` without setting `gameOver = true`
   - Allows defeated players to choose spectator mode
   - Game continues until only one player remains
   - Spectators can watch until game truly ends

4. **src/rendering/uiRenderer.js**
   - **`calculateGameOverLayout()`**: New layout with modal centering, supports 2 buttons for multiplayer
   - **`renderGameOver()`**: Complete redesign with:
     - Gradient backgrounds (defeat: red gradient, victory: green gradient)
     - Emoji icons (💀 for defeat, 🏆 for victory)
     - Mobile-responsive sizing using safe area insets
     - Styled statistics display
     - Two buttons for multiplayer defeat: "New Game" + "Spectator Mode"
   - **`renderButton()`**: New helper for gradient button rendering
   - **`darkenColor()`**: Helper for button hover states
   - **`isClickInButton()`**: Button hit detection
   - **`handleNewGame()`**: Resets game state for new game
   - **`handleSpectatorMode()`**: Sets spectator flags, disables shadow of war, deselects units, shows notification

5. **src/input/mouseHandler.js** (~lines 166-183, 210-223)
   - Added spectator/defeated check: `const isSpectatorOrDefeated = gameState.isSpectator || gameState.localPlayerDefeated`
   - Blocks left-click game interactions for spectators
   - Right-click camera panning still works for spectators

6. **src/input/keyboardHandler.js**
   - Added spectator mode with view-only command exceptions
   - View-only commands still work: g (grid), o (occupancy), z (danger zone), t (tile coords), p (pathfinding), m (music toggle), f (FPS)
   - All game action commands blocked for spectators

### Key Features

- **Beautiful Modal Design**: Gradient backgrounds, emoji icons, rounded corners, shadow effects
- **Mobile Optimization**: Safe area insets, responsive font sizing, touch-friendly button sizes
- **Spectator Mode**: Full map visibility (shadow of war disabled), all input blocked except viewing
- **Money Tracking Fix**: `totalMoneyEarned` now correctly incremented when harvesters deposit ore
- **Multiplayer Support**: Defeated players can continue watching, host defeat doesn't end game for others
