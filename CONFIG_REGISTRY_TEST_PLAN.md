# Runtime Config System - Test Plan

## Overview
This test plan verifies that the runtime config system works correctly in both development and production builds without using `eval()`.

## Test Environment Setup

### Dev Build
```bash
npm run dev
# Opens on http://localhost:5173 (or next available port)
```

### Production Build
```bash
npm run build
npm run preview
# Opens on http://localhost:4173
```

## Test Cases

### TC-001: Open Runtime Config Dialog
**Steps:**
1. Load the game
2. Press the **K** key

**Expected Result:**
- Runtime config dialog opens
- Dialog displays "⚙️ Runtime Configuration" title
- Category tabs are visible
- First category is selected by default
- Config items are displayed

**Status:** ⬜ Not Tested

---

### TC-002: Browse Categories
**Steps:**
1. Open runtime config dialog (Press K)
2. Click on each category tab

**Expected Result:**
- Category tab highlights when clicked
- Config items update to show configs in that category
- All categories are accessible

**Status:** ⬜ Not Tested

---

### TC-003: View Read-Only Configs
**Steps:**
1. Open runtime config dialog
2. Navigate to any category
3. Find a read-only config (marked with "(read-only)")

**Expected Result:**
- Read-only configs are displayed
- Input controls are disabled
- "(read-only)" text is shown in description

**Status:** ⬜ Not Tested

---

### TC-004: Modify Mutable Boolean Config
**Steps:**
1. Open runtime config dialog
2. Navigate to "Gameplay" category
3. Toggle "Enable Enemy Control" checkbox
4. Close dialog
5. Try selecting an enemy unit

**Expected Result:**
- Checkbox toggles correctly
- "Updated Enable Enemy Control" notification appears
- Change takes effect immediately
- Enemy units can be controlled if enabled

**Status:** ⬜ Not Tested

---

### TC-005: Modify Mutable Number Config
**Steps:**
1. Open runtime config dialog
2. Navigate to "Controls" category
3. Change "Keyboard Scroll Speed" value
4. Close dialog
5. Use arrow keys to scroll the map

**Expected Result:**
- Number input accepts new value
- "Updated Keyboard Scroll Speed" notification appears
- Current value display updates
- Scroll speed changes immediately

**Status:** ⬜ Not Tested

---

### TC-006: Close Dialog Methods
**Steps:**
1. Open runtime config dialog (Press K)
2. Test each close method:
   - Click the ✕ button
   - Click "Done" button
   - Press Escape key
   - Click outside the dialog (on overlay)

**Expected Result:**
- Dialog closes for each method
- Game input is re-enabled
- No errors in console

**Status:** ⬜ Not Tested

---

### TC-007: Refresh Config Values
**Steps:**
1. Open runtime config dialog
2. Click "Refresh" button

**Expected Result:**
- "Configuration refreshed" notification appears
- All config values are re-read and displayed
- No errors occur

**Status:** ⬜ Not Tested

---

### TC-008: Escape Key with Other Dialogs
**Steps:**
1. Open cheat console (Press C)
2. Press Escape - cheat console should close
3. Open runtime config dialog (Press K)
4. Press Escape - config dialog should close
5. Open help system (Press I)
6. Press Escape - help should close

**Expected Result:**
- Each dialog closes independently
- No interference between different modal systems
- Game input resumes correctly after each close

**Status:** ⬜ Not Tested

---

### TC-009: Production Build - Symbol Minification
**Steps:**
1. Run `npm run build`
2. Check dist/assets/*.js file
3. Verify that config variable names are minified
4. Run `npm run preview`
5. Open runtime config dialog (Press K)
6. Try reading and writing config values

**Expected Result:**
- Variables in built JS are minified (e.g., `XP_MULTIPLIER` becomes single letter)
- Runtime config dialog still works correctly
- All configs are readable
- Mutable configs can be modified
- No ReferenceError in console

**Status:** ⬜ Not Tested

---

### TC-010: Value Type Validation
**Steps:**
1. Open runtime config dialog
2. For number configs, try:
   - Setting value below minimum
   - Setting value above maximum
   - Using step increments

**Expected Result:**
- HTML5 validation prevents invalid values
- Min/max constraints are enforced
- Step increments work correctly

**Status:** ⬜ Not Tested

---

### TC-011: Concurrent Dialog Prevention
**Steps:**
1. Open runtime config dialog (Press K)
2. Try to open cheat console (Press C)

**Expected Result:**
- Cheat console should not open
- Runtime config dialog remains open
- Game input stays disabled

**Status:** ⬜ Not Tested

---

### TC-012: Config Categories Display
**Steps:**
1. Open runtime config dialog
2. Verify all categories exist:
   - Game Balance
   - Gameplay
   - Resources
   - Combat
   - Movement
   - AI & Pathfinding
   - Controls

**Expected Result:**
- All categories are present
- Each category has relevant configs
- Categories are sorted/organized logically

**Status:** ⬜ Not Tested

---

### TC-013: Visual Feedback on Changes
**Steps:**
1. Open runtime config dialog
2. Change a mutable config value
3. Observe the value display next to the config name

**Expected Result:**
- Value display updates immediately
- Notification appears confirming change
- Confirmation sound plays

**Status:** ⬜ Not Tested

---

### TC-014: Dialog Styling and Layout
**Steps:**
1. Open runtime config dialog
2. Check visual appearance

**Expected Result:**
- Dialog is centered on screen
- Background overlay is visible
- Text is readable
- Controls are properly sized
- Scrollbar appears if needed for many configs
- Dialog is responsive

**Status:** ⬜ Not Tested

---

### TC-015: No eval() in Production Bundle
**Steps:**
1. Run `npm run build`
2. Search dist/assets/*.js for 'eval('

**Expected Result:**
- No instances of `eval(` in the bundle (except possibly in library code)
- Our config system doesn't use eval

**Status:** ⬜ Not Tested

---

## Regression Tests

### RT-001: Existing Keyboard Shortcuts
**Steps:**
1. Test all existing keyboard shortcuts still work:
   - I: Help system
   - C: Cheat console
   - P: FPS display
   - M: Performance dialog
   - 1-9: Control groups
   - Ctrl+1-9: Assign control groups
   - S: Sell/stop
   - R: Repair
   - etc.

**Expected Result:**
- All existing shortcuts still work
- K key is the only new addition

**Status:** ⬜ Not Tested

---

### RT-002: Game State Not Corrupted
**Steps:**
1. Open and close runtime config dialog multiple times
2. Modify some config values
3. Continue playing the game

**Expected Result:**
- Game continues to function normally
- No crashes or errors
- Game state is not corrupted

**Status:** ⬜ Not Tested

---

## Performance Tests

### PT-001: Dialog Open/Close Performance
**Steps:**
1. Open runtime config dialog
2. Measure time to render
3. Close dialog
4. Repeat 10 times

**Expected Result:**
- Dialog opens in < 100ms
- No noticeable lag
- No memory leaks

**Status:** ⬜ Not Tested

---

### PT-002: Config Registry Lookup Performance
**Steps:**
1. Use console to benchmark:
```javascript
console.time('getConfig')
for (let i = 0; i < 1000; i++) {
  getConfigValue('xpMultiplier')
}
console.timeEnd('getConfig')
```

**Expected Result:**
- 1000 lookups complete in < 10ms
- No performance impact on game

**Status:** ⬜ Not Tested

---

## Security Tests

### ST-001: No Code Injection via Config Values
**Steps:**
1. Open browser console
2. Try to inject malicious code via config setters:
```javascript
setConfigValue('oreSpreadEnabled', '<script>alert("XSS")</script>')
```

**Expected Result:**
- Boolean configs only accept boolean values
- Number configs only accept numbers
- No code execution from config values
- HTML5 input validation prevents type mismatches
- Type conversion (parseFloat, Boolean) sanitizes input

**Note:** The implementation uses typed HTML inputs (type="number", type="checkbox") and proper type conversion, providing defense against injection attacks.

**Status:** ⬜ Not Tested

---

## Browser Compatibility

Test on multiple browsers:
- ⬜ Chrome/Chromium
- ⬜ Firefox
- ⬜ Safari
- ⬜ Edge

---

## Notes

- All tests should pass in both dev and production builds
- The key verification is that production build works despite minification
- Document any issues found in GitHub issue tracker
