# Config Registry Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Interface                              │
│                                                                      │
│  Press K ──► RuntimeConfigDialog (src/ui/runtimeConfigDialog.js)   │
│              ┌────────────────────────────────────────────┐         │
│              │  ⚙️ Runtime Configuration                  │         │
│              │                                            │         │
│              │  [Game Balance] [Gameplay] [Resources]     │         │
│              │  ─────────────────────────────────────     │         │
│              │                                            │         │
│              │  ► XP Multiplier                   3       │         │
│              │    Adjusts how quickly units gain XP       │         │
│              │    [3] (read-only)                         │         │
│              │                                            │         │
│              │  ► Ore Spread Enabled            true      │         │
│              │    Toggle ore spreading for performance    │         │
│              │    [✓] (mutable)                           │         │
│              │                                            │         │
│              │  [Refresh]  [Done]                         │         │
│              └────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ getConfigValue()
                              │ setConfigValue()
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Config Registry Layer                            │
│                  (src/configRegistry.js)                             │
│                                                                      │
│  export const configRegistry = {                                    │
│    xpMultiplier: {                                                  │
│      name: 'XP Multiplier',                                         │
│      get: () => XP_MULTIPLIER,  ◄─── Direct closure reference      │
│      set: null,                     (NOT string name!)              │
│      type: 'number',                                                │
│      category: 'Game Balance'                                       │
│    },                                                               │
│    oreSpreadEnabled: {                                              │
│      name: 'Ore Spread Enabled',                                    │
│      get: () => ORE_SPREAD_ENABLED, ◄─── Direct reference          │
│      set: setOreSpreadEnabled,      ◄─── Direct function           │
│      type: 'boolean',                                               │
│      category: 'Resources'                                          │
│    }                                                                │
│  }                                                                  │
│                                                                      │
│  Helper Functions:                                                  │
│  • getConfigValue(id)      - Get current value                     │
│  • setConfigValue(id, val) - Set new value                         │
│  • isConfigMutable(id)     - Check if writable                     │
│  • getConfigCategories()   - List all categories                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Direct references
                              │ (captured in closures)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Config Source Layer                            │
│                     (src/config.js)                                  │
│                                                                      │
│  // Read-only constant                                              │
│  export const XP_MULTIPLIER = 3                                     │
│                                                                      │
│  // Mutable value with setter                                       │
│  export let ORE_SPREAD_ENABLED = true                               │
│                                                                      │
│  export function setOreSpreadEnabled(value) {                       │
│    ORE_SPREAD_ENABLED = value                                       │
│    // Could add side effects here                                   │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                         Why This Approach Works
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│                    ❌ eval() Approach (BROKEN)                      │
│                                                                      │
│  Development Build:                                                 │
│    export let XP_MULTIPLIER = 3                                     │
│    const value = eval('XP_MULTIPLIER')  ✓ Works                    │
│                                                                      │
│  Production Build (Minified):                                       │
│    let a = 3  // Renamed by minifier                               │
│    const value = eval('XP_MULTIPLIER')  ✗ ReferenceError!          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              ✓ Closure Reference Approach (WORKS)                   │
│                                                                      │
│  Development Build:                                                 │
│    export let XP_MULTIPLIER = 3                                     │
│    const get = () => XP_MULTIPLIER                                  │
│    const value = get()  ✓ Returns 3                                │
│                                                                      │
│  Production Build (Minified):                                       │
│    let a = 3  // Renamed                                            │
│    const b = () => a  // Reference also renamed consistently        │
│    const value = b()  ✓ Returns 3 (still works!)                   │
│                                                                      │
│  Key Insight: The closure captures the actual variable, not the    │
│  name. Both the variable and the reference inside the closure are   │
│  renamed together, so they always match.                            │
└─────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                          Integration Flow
═══════════════════════════════════════════════════════════════════════

User presses K
       │
       ▼
KeyboardHandler detects 'k' key
       │
       ▼
runtimeConfigDialog.openDialog()
       │
       ├──► Set gameState.runtimeConfigDialogOpen = true
       │
       ├──► Create modal overlay
       │
       ├──► Render categories from getConfigCategories()
       │
       ├──► Render configs from getConfigsByCategory()
       │
       └──► For each config:
            │
            ├──► Read current value: config.get()
            │
            ├──► Create appropriate input (number/checkbox/text)
            │
            └──► Add change listener:
                 │
                 ├──► Get new value from input
                 │
                 ├──► Call setConfigValue(id, newValue)
                 │
                 ├──► Show notification
                 │
                 └──► Update display

User closes dialog (ESC/click)
       │
       ▼
Set gameState.runtimeConfigDialogOpen = false
       │
       ▼
Remove modal, restore game input


═══════════════════════════════════════════════════════════════════════
                      File Organization
═══════════════════════════════════════════════════════════════════════

src/
├── config.js                    ◄── Source of truth for config values
├── configRegistry.js           ◄── Registry with getter/setter refs
├── gameState.js                ◄── Game state (added flag)
├── input/
│   └── keyboardHandler.js      ◄── K key binding
└── ui/
    └── runtimeConfigDialog.js ◄── Modal UI component

Documentation:
├── CONFIG_REGISTRY_README.md       ◄── User guide
├── CONFIG_REGISTRY_TEST_PLAN.md    ◄── Test cases
└── IMPLEMENTATION_SUMMARY.md       ◄── Technical overview
```
