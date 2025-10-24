# Runtime Configuration System

## Overview

The runtime configuration system provides a safe way to view and modify game configuration values at runtime without using `eval()`. This ensures the system works correctly in both development and production (minified) builds.

## Key Features

- **Minification-Safe**: Uses direct function references instead of `eval()` with string names
- **Type-Safe**: Each config entry specifies its type (number, boolean, string)
- **Read-Only Support**: Config values can be marked as read-only
- **Categorized**: Settings are organized into logical categories
- **User-Friendly**: Provides a clean UI with descriptions for each setting

## Architecture

### Config Registry (`src/configRegistry.js`)

The config registry is a central map that stores metadata for each configurable value:

```javascript
{
  configId: {
    name: 'Display Name',
    description: 'What this config does',
    type: 'number' | 'boolean' | 'string',
    get: () => value,        // Getter function
    set: (val) => {},        // Setter function (optional)
    min: 0,                  // For numbers
    max: 100,                // For numbers
    step: 1,                 // For numbers
    category: 'Category Name'
  }
}
```

**Key Functions:**
- `getConfigValue(configId)` - Get current value
- `setConfigValue(configId, value)` - Set new value (if mutable)
- `isConfigMutable(configId)` - Check if config can be modified
- `getConfigCategories()` - Get all category names
- `getConfigsByCategory(category)` - Get configs in a category

### Runtime Config Dialog (`src/ui/runtimeConfigDialog.js`)

A modal dialog that provides a UI for viewing and modifying config values:

- **Categories**: Tab-based navigation between config categories
- **Controls**: Appropriate input controls for each type (checkbox, number input, text input)
- **Real-time Updates**: Changes are applied immediately
- **Visual Feedback**: Shows current values and read-only status

## Usage

### Opening the Dialog

Press the **K** key during gameplay to open the runtime config dialog.

### Adding New Configurable Values

To add a new config value to the registry:

1. **Export the value from `config.js`** (if not already exported):
   ```javascript
   export const MY_CONFIG_VALUE = 42
   ```

2. **For mutable values, add a setter function**:
   ```javascript
   export let MY_MUTABLE_VALUE = 100
   
   export function setMyMutableValue(value) {
     MY_MUTABLE_VALUE = value
   }
   ```

3. **Import in `configRegistry.js`**:
   ```javascript
   import { MY_CONFIG_VALUE, MY_MUTABLE_VALUE, setMyMutableValue } from './config.js'
   ```

4. **Add to the registry**:
   ```javascript
   export const configRegistry = {
     // ... existing entries ...
     
     myConfigValue: {
       name: 'My Config Value',
       description: 'Description of what this does',
       type: 'number',
       get: () => MY_CONFIG_VALUE,
       set: null, // Read-only
       min: 0,
       max: 1000,
       step: 10,
       category: 'My Category'
     },
     
     myMutableValue: {
       name: 'My Mutable Value',
       description: 'This can be changed at runtime',
       type: 'number',
       get: () => MY_MUTABLE_VALUE,
       set: setMyMutableValue, // Mutable
       min: 0,
       max: 500,
       step: 5,
       category: 'My Category'
     }
   }
   ```

## Why Not `eval()`?

The problem with using `eval()` for config lookups:

```javascript
// ❌ This breaks after minification
const value = eval('XP_MULTIPLIER')  // Becomes eval('a') after minification
eval('XP_MULTIPLIER = 5')            // ReferenceError: XP_MULTIPLIER is not defined
```

After Vite/Rollup minification:
- `export let XP_MULTIPLIER = 3` becomes `let a = 3`
- `eval('XP_MULTIPLIER')` tries to access a variable that no longer exists

Our solution using function references:
```javascript
// ✅ This works in both dev and production
const configEntry = {
  get: () => XP_MULTIPLIER,  // Direct reference captured in closure
  set: setXpMultiplier       // Function reference
}
const value = configEntry.get()     // Always works
configEntry.set(5)                  // Always works
```

## Categories

The config registry organizes settings into these categories:

- **Game Balance**: XP multipliers, kill chances, etc.
- **Gameplay**: Enemy control, selection settings
- **Resources**: Ore spread, harvester settings, gas system
- **Combat**: Targeting, bullet speed, range
- **Movement**: Rotation speeds, street multipliers, scroll speed
- **AI & Pathfinding**: Path calculation intervals, thresholds
- **Controls**: Keyboard/mouse settings

## Testing

### Dev Build Testing
1. Run `npm run dev`
2. Open the game in a browser
3. Press **K** to open the runtime config dialog
4. Try modifying mutable values
5. Verify changes take effect immediately

### Production Build Testing
1. Run `npm run build`
2. Run `npm run preview`
3. Open the game in a browser
4. Press **K** to open the runtime config dialog
5. Verify all configs are displayed correctly
6. Try modifying mutable values
7. Verify the system works despite minification

## Keyboard Shortcuts

- **K**: Open/close runtime config dialog
- **Escape**: Close runtime config dialog
- **C**: Open cheat console (separate system)
- **I**: Open controls help

## Integration with Game State

The dialog sets `gameState.runtimeConfigDialogOpen = true` when open, which:
- Prevents game input processing
- Allows the dialog to capture keyboard events
- Works in harmony with other modal systems (cheat dialog, help system)

## Future Enhancements

Potential improvements for the config system:

1. **Persistence**: Save modified values to localStorage
2. **Profiles**: Multiple config profiles (e.g., "Easy", "Normal", "Hard")
3. **Reset**: Reset individual or all configs to defaults
4. **Export/Import**: Share config profiles between users (with validation and sanitization)
5. **Search**: Filter configs by name or description
6. **Advanced**: Formula-based dependencies between configs
7. **Validation**: Enhanced input validation and type checking for imported profiles to prevent injection attacks
