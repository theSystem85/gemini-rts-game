# Fix Wrecks Not Cleared on New Game

**UTC Timestamp:** 2025-11-27T12:00:00Z  
**LLM:** Claude Opus 4.5 (Copilot)

## Prompt

when kicked player starts a new game (he clicked that button on the kicked out modal) ensure that all wrecks are removed from the new map (just happened)

## Problem

When a kicked player clicked "New Game" on the kick modal, the game reset but unit wrecks from the previous game persisted on the new map.

## Root Cause

The `resetGame()` function in `src/main.js` was missing the line to clear `gameState.unitWrecks`. While other arrays like `buildings`, `units`, and `factories` were being reset, `unitWrecks` was overlooked.

## Fix

Added `gameState.unitWrecks = []` to the `resetGame()` function to clear all wrecks when starting a new game.

## Files Modified

- `src/main.js` - Added `gameState.unitWrecks = []` in the resetGame() function
