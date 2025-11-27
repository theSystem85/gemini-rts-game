# Prompt History Entry

**UTC Timestamp:** 2025-11-27T10:00:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Request

Ensure when enemy units are selected that the cursor is always the default cursor.

## Analysis

The cursor manager in `src/input/cursorManager.js` was checking if `selectedUnits.length > 0` but not checking if those selected units belonged to the player. When a player selects enemy units (to view their stats), the cursor would incorrectly show move/attack cursors as if those units could be commanded.

## Changes Made

**`src/input/cursorManager.js`**:
- Added an early check at the beginning of the `selectedUnits.length > 0` block
- Check if any selected units belong to the player (`hasOwnUnits`)
- If no own units are selected (only enemy units), immediately return with default cursor
- This prevents move/attack cursors from showing when viewing enemy units
