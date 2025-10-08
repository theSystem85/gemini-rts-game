# Cheat System Implementation

## Overview
A comprehensive cheat system has been implemented for the RTS game that allows for easier testing and debugging. The system provides invincibility (god mode) and money manipulation features through a console-style interface.

## Features

### 🛡️ God Mode
- **Command**: `godmode on` / `godmode off`
- **Function**: Makes all player units invincible to damage
- **Implementation**: Uses Set-based tracking for efficient unit management
- **Integration**: Hooks into all damage systems (bullets, explosions, Tesla coils)

### 💰 Money Commands
- **Give Money**: `give [amount]` or `give [party] [amount]` - Adds money to the specified party (defaults to the player)
- **Set Money**: `money [amount]` - Sets money to specific amount
- **Examples**:
  - `give 10000` - Adds $10,000 to the player
  - `give red 5000` - Adds $5,000 to the red party (Player 2)
  - `money 50000` - Sets money to $50,000

### ❤️ HP Command
- **Command**: `hp [amount]` or `hp [amount]%`
- **Function**: Sets the health of all currently selected units. Append `%` to use a percentage of each unit's max HP

### ⛽ Fuel Command
- **Command**: `fuel [amount|percent%]`
- **Function**: Sets the fuel level of the currently selected unit. Use a plain number for an absolute value or append `%` to set a percentage of the unit's maximum fuel. The applied value is clamped between `0` and the unit's capacity.

### 🎨 Party Command
- **Command**: `party [color|player]`
- **Function**: Changes the party/owner of all currently selected units and buildings. Accepts color names (e.g., `red`, `green`, `blue`, `yellow`) or player identifiers (`player1`-`player4`).

### 🎮 Enemy Control
- **Command**: `enemycontrol on` / `enemycontrol off`
- **Function**: Allows selecting and issuing commands to enemy units

### 👥 Crew Toggle Commands
- **Commands**: `driver`, `commander`, `loader`, `gunner`
- **Function**: Toggles the specified crew member for all selected units

### 🚀 Spawn Units
- **Command**: `[type] [amount] [party]`
- **Function**: Spawns the specified unit type around the mouse cursor. `amount` and `party` are optional. When `party` is omitted, units belong to the player's party.
  - `tank_v1 9` spawns nine tanks for the player
  - `tank_v3` spawns one tank for the player
  - `tank_v2 3 red` spawns three tanks for the red party
  - Available units: `harvester`, `tank_v1`, `tank-v2`, `tank-v3`, `rocketTank`, `recoveryTank`, `ambulance`, `tankerTruck`

### 📊 Status Command
- **Command**: `status`
- **Function**: Shows current game state including:
  - Current money
  - God mode status
  - Number of player/enemy units
  - Number of player buildings

## How to Use

### Opening the Cheat Console
1. Press the **"C"** key during gameplay
2. The cheat dialog will appear centered on screen
3. Game input is paused while dialog is open

### Entering Commands
1. Type your command in the input field
2. Press **Enter** or click **Execute**
3. Commands are case-insensitive
4. Press **Escape** or click **Close** to exit

### Example Session
```
> godmode on
🛡️ God mode ENABLED - All player units are now invincible!

> give 25000
💰 Added $25,000 (Total: $35,000)

> give red 5000
💰 Added $5,000 to Red (Player 2) (Total: $17,000)

> hp 75%
❤ Set HP to 75% for 1 unit(s)

> fuel 100
⛽ Fuel set to 100 for 1 unit

> fuel 50%
⛽ Fuel set to 50% for 1 unit

> party red
🎨 Changed party to player2 for 1 item(s)

> status
💰 Money: $35,000
🛡️ God Mode: ENABLED
👥 Player Units: 8
🤖 Enemy Units: 12
🏭 Player Buildings: 5

> godmode off
🛡️ God mode DISABLED - Units are now vulnerable
```

## Technical Implementation

### Architecture
- **CheatSystem Class**: Main cheat system logic
- **Dialog UI**: Modern styled modal interface
- **Global Access**: Available via `window.cheatSystem`
- **Integration**: Hooks into damage systems and unit lifecycle

### Damage Prevention
The cheat system integrates with three main damage sources:
1. **Bullet System** (`src/game/bulletSystem.js`)
2. **Explosion System** (`src/logic.js`)
3. **Tesla Coil System** (`src/game/buildingSystem.js`)

### Unit Lifecycle Management
- **Creation**: New units automatically added to god mode if active
- **Destruction**: Units cleaned up from tracking when destroyed
- **Memory Management**: Prevents memory leaks through proper cleanup

### Key Integration Points
- **Keyboard Handler**: Handles "C" key activation
- **Unit Creation**: Both player and enemy unit spawning
- **Damage Systems**: All damage sources check for god mode
- **Cleanup Systems**: Multiple cleanup points remove dead units

## Files Modified

### Core Cheat System
- `src/input/cheatSystem.js` - Main cheat system implementation

### Integration Points
- `src/input/keyboardHandler.js` - "C" key activation
- `src/inputHandler.js` - Global cheat system access
- `src/gameState.js` - Dialog state management

### Damage System Integration
- `src/game/bulletSystem.js` - Bullet damage prevention
- `src/logic.js` - Explosion damage prevention  
- `src/game/buildingSystem.js` - Tesla coil damage prevention

### Unit Lifecycle Integration
- `src/units.js` - Player unit creation
- `src/enemy.js` - Enemy unit creation
- `src/game/unitMovement.js` - Unit destruction cleanup
- `src/game/gameStateManager.js` - Game state cleanup

## Development Notes

### Performance
- Uses efficient Set-based tracking for god mode units
- Minimal performance impact on game loop
- Proper cleanup prevents memory leaks

### Error Handling
- Input validation for all commands
- Graceful error messages for invalid input
- Console error logging for debugging

### User Experience
- Visual feedback through notifications
- Audio feedback for actions
- Help text in dialog for reference
- Keyboard shortcuts (Enter/Escape)

## Console Access

For advanced testing, the cheat system is also accessible via browser console:

```javascript
// Access the cheat system
window.cheatSystem

// Enable god mode programmatically
window.cheatSystem.enableGodMode()

// Add money programmatically
window.cheatSystem.addMoney(10000)

// Check status
window.cheatSystem.showStatus()
```

## Recent Bug Fixes

- **v1.1** - Fixed god mode damage prevention issue where units with armor would still take 1 damage due to `Math.max(1, ...)` calculation in bulletSystem.js. Now damage is only applied when `actualDamage > 0`.
- **v1.2** - Extended god mode protection to cover all player assets:
  - Player buildings now immune to bullet damage
  - Player factories now immune to bullet and explosion damage  
  - Updated `preventDamage()` method to handle buildings and factories
  - Made Tesla coil damage application consistent with other systems

## Known Issues

- None currently

## Future Enhancements

- Potential future additions:
- Speed manipulation
- Resource commands
- AI behavior toggles
- Map manipulation tools
- Fog of war toggle

---

**Note**: This cheat system is designed for development and testing purposes. All features work seamlessly with the existing game systems without breaking gameplay balance when disabled.
