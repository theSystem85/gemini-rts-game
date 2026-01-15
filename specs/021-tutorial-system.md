# Spec 021: Tutorial System

## Summary
Introduce a guided tutorial system that teaches new players the UI/UX flow, core base-building sequence, unit control basics, and tech tree unlocks. The tutorial is skippable at every step, supports desktop and mobile instructions, uses a visible tutorial cursor, and provides optional speech narration via the browser Speech API.

## Goals
- Walk players through core onboarding steps (economy, construction, unit control, combat).
- Ensure each step shows a demo action and requires the player to repeat it to advance.
- Adapt input instructions for desktop (keyboard + mouse) and mobile (touch + joystick).
- Persist tutorial progress and “show tutorial” preference in localStorage.
- Allow restarting or disabling the tutorial from Settings.
- Provide English-only instructional content.

## UI/UX Requirements
1. **Overlay & Cursor**
   - Full-screen tutorial overlay with a floating instruction panel.
   - Tutorial cursor rendered above the game cursor.
   - Highlight rectangle around the current focus element (UI or map area).
2. **Controls**
   - Buttons for **Replay Demo**, **Skip Step**, and **Skip Tutorial**.
   - Skipping a step does not block progression.
3. **Settings Integration**
   - Add a "Tutorial" tab in the settings modal.
   - Include toggles:
     - “Show tutorial on start”
     - “Enable narration (Speech API)”
   - Include a “Restart Tutorial” button.

## Gameplay Steps
1. **Intro**: Explain the tutorial and skip options.
2. **Resources**: Show money and energy bars.
3. **Build Order**:
   - Power Plant
   - Ore Refinery
   - Vehicle (Weapons) Factory
   - Ore Transporter / Harvester
4. **Harvesting Behavior**:
   - Automatic ore field selection.
   - Manual ore field targeting.
5. **Unit Selection**:
   - Single unit selection.
   - Multiple unit selection.
   - Deselecting units.
6. **Unit Commands**:
   - Move selected units.
   - Set Vehicle Factory waypoint.
   - Build and command a tank.
   - Remote control mode (keyboard or joystick).
   - Attack commands and win condition explanation.
7. **Tech Tree Unlocks**:
   - Gas Station → Tanker Truck
   - Hospital → Ambulance + crew system
   - Ammunition Factory → Ammunition Truck + ammo HUD
   - Workshop → Recovery Tank

## Persistence
- Store tutorial state in localStorage:
  - Current step index
  - Completion flag
- Store “show tutorial” and “enable narration” flags in localStorage.

## Expansion Notes
- Steps should be defined in a data-driven list to allow easy additions.
- Each step should define:
  - Instruction text
  - Demo action
  - Completion predicate
  - Target highlight selector or coordinate callback

