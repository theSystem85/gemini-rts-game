# Rocket Flyover Behavior and Remote Control

**UTC Timestamp:** 2025-12-16T12:00:00Z
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt 1

1) ensure rockets from rocket turret and rocket tank fly over over units and wrecks and only explode on impact on their specific target
2) The rockets also should not explode why flying over buildings that block the path to the target
3) The rockets are still exploding when flying over buildings while a target behind the building is aimed at. Ensure the rockets do not explode on intermediate buildings that are in the way but ensure the rockets fly over the building and hit the actual target. Also ensure the rockets when fired from rocket tank in remote control mode do not stuck in mid air but just fly into the direction of sight and explode at maximum range similar to how remote control firing works for apache (also show the red crosshair). Make sure on streets the rocket tanks are 30% faster than tanks.

## Prompt 2

- Fix: after first 3 shots the rocket tank does not fire again anymore
- Ensure the rocket tank also fires when there is only ammo for one shot left (not a full burst)
- Make the bar below the HP bar of the rocket tank a reload rocket burst bar instead to indicate how long until next attack (color orange)
- Fix error: updateGame.js:467 Critical error in updateGame: TypeError: Cannot read properties of undefined (reading 'tileX') at ammunitionTruckLogic.js:53:36

## Changes Made

### 1. Rocket Collision Bypass (`skipCollisionChecks`)

Modified rocket projectiles from both rocket turrets and rocket tanks to bypass intermediate collision checks with units, wrecks, and buildings, allowing them to fly over obstacles to reach their intended target.

**Files Modified:**
- `src/game/buildingSystem.js` - Added `skipCollisionChecks: true`, `projectileType: 'rocket'`, `originType: 'rocketTurret'`, `maxFlightTime`, and `creationTime` to rocket turret projectiles
- `src/game/bulletSystem.js` - Added the same properties to rocket tank rockets in `fireBullet()` function, plus added handling for rocket turret/tank rockets reaching their target
- `src/game/unitCombat.js` - Added `skipCollisionChecks`, `originType`, `maxFlightTime`, and `creationTime` to rocket tank rockets in `handleTankFiring()`

### 2. Rocket Target Detection

Added new logic in `bulletSystem.js` to detect when rocket turret and rocket tank rockets reach their target position and explode appropriately:
- Rockets track distance to target position
- Homing rockets update target position as the target moves
- Rockets explode when within half a tile of target or when max flight time exceeded

### 3. Rocket Tank Remote Control Mode

Added remote control firing capability for rocket tanks similar to Apache helicopters:
- Added `computeRocketTankRemoteAim()` function to compute aim target in turret direction
- Added `getRocketTankRemoteRange()` function for range calculation
- Rocket tanks now show red crosshair reticle when in remote control mode
- Space key fires rockets in the direction the turret is facing

**Files Modified:**
- `src/game/remoteControl.js` - Added rocket tank remote aim computation and firing logic
- `src/rendering/unitRenderer.js` - Extended `renderApacheRemoteReticle()` to also render reticle for rocket tanks

### 4. Street Speed Bonus for Rocket Tanks

Added 30% street speed bonus for rocket tanks compared to regular tanks:
- Base street speed multiplier is 1.5x for all units
- Rocket tanks now get 1.95x (1.5 * 1.3) speed on streets

**Files Modified:**
- `src/game/unifiedMovement.js` - Added rocket tank street speed multiplier
- `src/game/remoteControl.js` - Added same multiplier for remote control movement

### 5. Fixed Rocket Tank Ammunition Bug

The rocket tank was consuming 9 ammo per burst instead of 3:
- Each burst fires 3 rockets
- Each rocket was depleting `ammoPerShot` (3) ammo = 9 total per burst
- Fixed to deplete 1 ammo per rocket for rocket tanks

**Files Modified:**
- `src/game/unitCombat.js` - Fixed ammunition depletion logic

### 6. Allow Partial Burst Firing

Rocket tanks can now fire partial bursts when low on ammo:
- If only 1-2 rockets remain, fires those instead of waiting for full burst
- Checks ammo availability before starting burst

**Files Modified:**
- `src/game/unitCombat.js` - Modified burst initialization to check available ammo

### 7. Reload Bar for Rocket Tanks

Changed the left bar from ammunition display to reload progress:
- Shows 0% during burst (reloading)
- Fills up over 12 seconds (fire rate) to indicate when next burst is ready
- Orange color maintained

**Files Modified:**
- `src/rendering/unitRenderer.js` - Added special handling for rocket tank reload bar

### 8. Fixed Ammunition Truck Error

Fixed crash when ammunition truck target is undefined:
- Added null check before accessing `target.tileX`
- Early return when target doesn't exist

**Files Modified:**
- `src/game/ammunitionTruckLogic.js` - Added null check for target
