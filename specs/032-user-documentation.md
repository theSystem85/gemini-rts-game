# Spec 032: In-Game User Documentation

## Goal
Provide a professional, in-game user documentation experience that can be opened without leaving gameplay context.

## Requirements
1. Add a standalone HTML documentation page under `public/docs/`.
2. Include comprehensive sections:
   - Quick guide with screenshots and sidebar interaction tips
   - Controls & HUD — selection, control groups, HUD bar indicators (HP, fuel, ammo, XP, crew)
   - Building placement rules
   - Tech tree — visual dependency graph for buildings and units with sidebar asset images
   - Unit compendium — all 13 units with full numerical stats (cost, HP, speed, damage, fire rate, range, burst, ammo capacity, armor, special abilities)
   - Building compendium — all 18 buildings split into economy/production, support, and defensive categories with full stats
   - Combat mechanics — hit zone multipliers, projectile details, damage thresholds
   - Crew system — D/C/G/L indicators, crew by unit type, restoration via Hospital & Ambulance
   - XP & promotions — level thresholds, standard vs howitzer bonuses, visual indicators
   - Fuel, ammo & logistics — fuel tank sizes/consumption per unit, ammo system, logistics chain advice
   - Mine system — mine layer deployment, mine properties, mine sweeper UX
   - Remote control — desktop keyboard controls, Apache extras, mobile joystick profiles
   - Multiplayer — WebRTC flow, party colors/positions, host rules, cross-platform play
   - Keyboard reference — full hotkey table with contexts
3. Add a sidebar button to open the documentation in a modal.
4. Add a tutorial-window toggle button that opens the same documentation modal.
5. Ensure documentation is viewable through an iframe modal with keyboard and click-out close behavior.

## Design Requirements
- Mobile-responsive: single-column card layout on screens < 768px, scrollable tables
- Borderless professional design: no table borders, use subtle row separators and hover highlights
- Images sized appropriately: sidebar assets at 32px, screenshots max-height 200px with object-fit
- Collapsible details sections for dense data (e.g., fuel tank table)
- CSS custom properties for consistent theming
- Dark theme matching game UI aesthetic
- Keyboard-style `<kbd>` tags for hotkey references

## Implementation Notes
- Keep docs static for low runtime overhead.
- Reuse game asset images from `public/images/sidebar` and screenshots stored in `public/images/docs`.
- Expose a global `window.openUserDocs` callback so multiple UI surfaces can trigger the same modal.
- All stat values sourced from `src/config.js`, `src/game/combatConfig.js`, and `src/data/buildingData.js`.
