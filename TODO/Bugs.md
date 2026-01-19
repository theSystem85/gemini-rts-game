## Bugs
- [x] Tutorial minimize button does not collapse the tutorial overlay on mobile; ensure the button toggles a minimized state.
- [x] Avoid AudioContext start warnings by resuming audio only after a user gesture.
- [x] Tutorial continue button loses enabled state after minimize/restore; ensure state is preserved.
- [x] Restore a voice on/off toggle inside the tutorial window.
- [x] Skip tutorial should hide the overlay and dock until re-enabled in settings.
- [x] Continue button should unlock with a reward animation only after step goals are met.
- [x] Attack step should unlock when remote-control firing is used.
- [x] Tutorial should not start when the show tutorial setting is disabled on reload.
- [x] ✅ Fixed tutorial step 12 completion not unlocking when user uses remote control by adding hasUsedRemoteControl flag to units and updating completion check.
- [ ] Fix `buildOccupancyMap` throwing when `gameState.mapGrid` (or its row) is undefined, causing "Cannot read properties of undefined (reading 'length')" errors on load.
- [ ] Fix `generateDangerZoneMapForPlayer` crash when `mapGrid` rows are missing at startup.
- [ ] Fix `CursorManager.isBlockedTerrain` assuming `mapGrid` is ready (crashes reading `.length`).
- [ ] Fix `MinimapRenderer.render` crash when `mapGrid` or its rows are undefined during initialization.
- [ ] Fix `updateOreSpread` (gameStateManager.js) assuming `mapGrid` rows exist, causing `Cannot read properties of undefined (reading 'length')` during updateGame initialization.
- [x] ✅ Game loads without an auto-generated map; restore default random map generation on start and ensure map edit mode is disabled until explicitly toggled.
- [x] Ensure factories spawn units only on unoccupied tiles by searching outward from the intended spawn tile until a free neighbor is found.
- [x] (still an issue?) When about 10 units get stuck the game slows down significantly.

### Closed Issues

## Bug Fixes (2025-11-07)
- [x] ✅ Fixed Apache helicopter false "out of ammo" notifications when rockets available
- [x] ✅ Fixed Apache helicopters firing rockets faster than 300ms minimum interval
- [x] ✅ Fixed cheat system ammo commands not applying to Apache helicopters
- [x] ✅ Fixed combat system not checking `rocketAmmo` field for Apache units
- [x] ✅ Fixed cheat system using non-existent `window.debugGetSelectedUnits()` function
- [x] ✅ Updated cheat system to use `this.selectedUnits` reference for all ammo/fuel/medic commands

## Bug Fixes (2025-11-13)
- [x] ✅ Fixed howitzer gun barrel alignment - now points in driving direction by default using same direction as bullet trajectory, updated recoil effect and muzzle flash accordingly
- [x] ✅ Fixed howitzer aiming when target is below - barrel now points in correct launch direction with smooth transitions
- [x] ✅ Fixed howitzer bullet starting from end of gun barrel instead of center of wagon, aligned muzzle flash accordingly
- [x] ✅ Fixed howitzer recoil direction to align with barrel rotation

## Bug Fixes (2025-11-27)
- [x] ✅ Defeat modal subtitle overlapping statistics — now subtitle lines are wrapped and stats start below the subtitle (fix: `src/rendering/uiRenderer.js`)

## Bug Fixes (2025-01-26)
- [x] ✅ Fixed rocket tank rockets not homing toward moving targets - simplified burst fire to dynamically track target position each rocket
- [x] ✅ Fixed rockets targeting Apache helicopters aiming at center between Apache image and shadow - added altitude visual offset compensation (altitude * 0.4) in multiple locations: handleTankMovement, handleRocketBurstFire, fireBullet, homing logic, and collision detection

## Bug Fixes (2025-12-16)
- [x] ✅ Rockets from rocket turret and rocket tank now fly over units, wrecks, and buildings to hit their intended target
- [x] ✅ Rocket tank remote control mode added with red crosshair reticle (similar to Apache)
- [x] ✅ Rocket tanks are 30% faster on streets than regular tanks
- [x] ✅ Fixed rocket tank firing only once - ammunition was being depleted 3x per burst (9 instead of 3)
- [x] ✅ Rocket tanks can now fire partial bursts when low on ammo (1-2 rockets if that's all that remains)
- [x] ✅ Rocket tank left bar now shows reload progress instead of ammunition
- [x] ✅ Fixed ammunitionTruckLogic.js crash when target is undefined

## Bug Fixes (2025-12-18)
- [x] ✅ Rocket tank reload phase now begins only after entire 4-rocket burst completes (both normal and remote control)
- [x] ✅ Rocket tank in remote control mode immediately rotates towards selected target (10x faster than normal rotation)
- [x] ✅ Rocket tank no longer fires at old target position when target unit dies
- [x] ✅ Rocket tank remote control now tracks actual selected unit position instead of just using current direction
- [x] ✅ Rocket tank now actively rotates body towards target in normal combat mode (normal rotation speed)
- [x] ✅ Rocket tank projectiles now deal exactly 23% damage to normal tanks (100 HP) per rocket
- [x] ✅ Rocket tank ammunition capacity set to 24 rockets
- [x] ✅ Rocket tank stops attacking when target is destroyed
- [x] ✅ Rocket tank rotation speed normalized to 0.1 radians/frame in all modes
- [x] ✅ Rocket tank reload phase begins only after entire 4-rocket burst completes

## Bugs
- [x] Align Apache helicopter selection hits with the rendered helicopter/HUD so clicks are not required between the image and its shadow.
- [ ] Tanks must respect building line-of-sight: blocked shots should prevent firing for both player and AI and trigger repositioning until clear.
- [ ] On mobile PWA portrait mode, stretch the sidebar to the very bottom so no unused black bar remains.
- [ ] Remove the blue progress bar from sidebar build buttons once a unit finishes production.
- [ ] Airborne units must never collide with each other or take impact damage; they should only use predictive, position-based avoidance.
- [ ] Slow Apache rocket volley cadence by 50% and shorten the reload cooldown between volleys by 30% so bursts fire slower but rearm faster.
- [x] Prevent Apache rockets from damaging ground units or buildings when engaging airborne targets.
- [x] Clear restoration move overrides when new movement commands are issued so restored crewless units can't roam indefinitely.
- [x] Hide the desktop energy bar while in the mobile landscape layout so only the dedicated mobile status bar energy indicator is visible.
- [x] Hide the desktop money bar while in the mobile landscape layout so only the dedicated mobile HUD money indicator is visible.
- [x] Ensure the standalone/PWA mobile landscape layout can scroll upward while dragging to build and does not leave a stray black bar along the bottom edge of the viewport.
- [x] Enemy units seem to aim at my units but they do not attack (means fire) at my units when in range. Also they do not fire at my buildings when the attack my base.
- [x] initial building factory is still treated differently than other buildings. For example the health bar is not changing color when low or it does not have the party flag like other buildings. Ensure the there is not separate redundant code for the initial factory since it should be the same as any other later build additional building factory. Ensure when the map is generated with that factory already there is is as if the user has build the factory there. Before you make code changes make sure to find out everything so far what is different about the initial building factory compared to the ones that can be build later by the user. Then refactor the code to make everything coherent.
- [x] when a construction process runs out of money and then new money comes in by cheat code make sure the construction process is continued.
- [x] ✅ **Spec 006** Ensure the "critical_damage" sound is only played when the players units are hit from behind. Currently it is also played for enemy AI units.
- [x] Ensure the harvesters can only progress harvesting while they rest on an ore tile. Currently they can move on it and drive away immediately while havesting on the go which is not correct.
- [x] Make sure always the clothest harvester to the refinery get unloaded first and reschedule the queue accordingly. Also make sure the harvesters do not move away from the refinery when they want to unload.
- [x] Ensure the Restart Game button does also update the occupancy map when a new map is generated.
- [x] Ensure when power is below 0 make that the production speed of buildings and units is calculated as follows: normal speed * (energy production capacity / energy consumption).
- [x] The main factory somehow does not count into the list of a players building so that when all other buildings are destroyed the game is already over. That mean that if you build a wall in the very beginning of the game and sell it, then you lost the game.
- [x] Some HUD elements like the health bar and the attack pins can get rendered under the units layer. Ensure they are always on top of the units and buildings.
- [x] When initial building factory gets destroyed there is not map background left, just black.
- [x] The initial power level shows 100 but in fact it is just 0. Make sure it actually is 100.
- [x] Unit when produced by the enemy leave the factory immediately not after the build time is done.
- [x] When selling a building the occupancy map is not updated and still blocked there.
- [x] Ensure the harvesting and ore unloading sound is not played when enemy units are doing it.
- [x] When refinery is destroyed the harvesters can still got to building factory to unload ore but they should only do it at the refinery.
- [x] Ensure on map generation there is no ore overlapping with buildings.
- [x] Repairing a building takes no time. Make sure it takes 50% of the time it took to build it to restore 100% of the healthbar. also make sure the cursor turns into a wrench svg icon (path cursors/wrench.svg) when repair mode is on and mouse hovers over a building that can be repaired.
- [x] Enemy units come out of factory immediately before the build indicator shows that the build is done
- [x] When enemy buildings get destroyed it looks like the occupancy map is not updated and the tiles are still blocked!
- [x] Saving games does not work anymore.
- [x] when a combat unit is selected and I hover over another of my units then the cursor should not be an attack cursor but just a normal cursor "arrow".
- [x] The occupancy map shows that not the center of a unit is determining weather a unit is on a tile but its top left corner.
- [x] When in attack mode unit do currently not respect the occupancy map.
- [x] Ensure for every attacking and chasing unit that the pathfinding is not updated more often than every 3s to improve performance.
- [x] Tanks are not accelerating or decelerating anymore. Make sure they do before reaching max speed. 
- [x] all selected units try to go to the same tile when commanded to move. That causes them to get stuck there and dodge around instead of standing still. Make sure when a group is commanded to move that all units get different nearby tiles to move to.
- [x] Ensure that ore does not grow on occupant tiles. (Currently is is grows on and into rocks and buildings). It should only be on plain grass and street tiles that are unoccupied by buildings or anything else.
- [x] Enemy is still building buildings even when his base is destroyed.
- [x] The sound for bullet impact seems to be missing.
- [x] The rocket tank does not correctly fire at enemy buildings. the projectiles seem to go into another direction.
- [x] The rocket tank rockets do not detonate where the rockets are impacting. Make sure the explosions happen where the rockets move to before they vanish.
- [x] The harvesting animation is now working anymore.
- [x] Harvesters can get stuck in the base and cannot move anymore. Make sure they can rotate on spot to solve getting stuck.
- [x] Enemy does not loose money when building units.
- [x] Enemy defense buildings are missing healthbar and don't take damage.
- [x] The ore tiles do not get removed after harvesting.
- [x] The initial construction yard building is not respected in the occupancy map.
- [x] When tank_v1 is produced it leaves the factory in different (random?) colors. Tank_v1 should always be blue.
- [x] Enemy units do not defend their harvesters when being attacked.
- [x] Sometimes the loading indicator of a harvester goes black again even when fully loaded and the yellow bar was visible before. Ensure the loading state is always visible.
- [x] There are colored bars on the edges of some buildings who's map images do not fit exactly into the tile map grid. Those bars should be removed. Make sure when the image to place on the map does not fit into the grid that the map tiles from before are still visible in the background.
- [x] When selling a building the occupancy map is not updated and still blocked there.
- [x] The initial construction yard building is not respected in the occupancy map.
- [x] When production queue is aborted the money goes back totally not gradually so you can actually earn money which is wrong!
- [x] Tank v1 somehow changes color during the game. They should all be blue.
- [x] When tank_v1 is produced it leaves the factory in different (random?) colors. Tank_v1 should always be blue.
- [x] Enemy units do not defend their harvesters when being attacked.
- [x] The game gets extremely slow when power is low. The game speed should not be affected by the power level only the production speed and the defence buildings loading speed.
- [x] Units move much slower only when moving to the west
- [x] When selecting a group using number buttons the autofocus on the group is totally off. Fix the coordinates (maybe a retina issue) and then disable the feature on first keypress of a number key but enable it when the key was pressed twice within 500ms.
- [x] The energy consumption of the player and the enemy AI is somehow shared. Make sure they have independent energy generation and consumption.
- [x] Images in build button do not show up immediately after clicking the tab (only after 2nd click)
- [x] Build menu is clickable even before game was started. Disable the build button until the game gets started. Even the build progress starts before the game got started.
- [x] After scrolling on the map the units get deselected
- [x] The yellow selection frame is not visible anymore when dragging a frame around a group of units to select it.
- [x] Prevent playing the same sound multiple times at the exact same time. When some sound x is already running do not add it on top but just start that sound from the beginning.
- [x] Harvesters are able to harvest the same tile simultaneously. That should not happen. The ore tile shall be blocked as soon as one harvester is at it.
- [x] Units when dodging should not move differently than normal. They should just move to a random adjacent tile when an enemy projectile is approaching. Dodging should not be faster than normal movement.
- [x] When enemy base is destroyed the game still continues but it should end with a message on the screen showing the current win/loss ratio of the player.
- [x] The coloring of enemy unit types shall be the same as for players units. Only mark enemy units by giving them a red health bar
- [x] The selection border when drag selection is performed by user is not visible anymore (regression). Please get it back!
- [x] Make sure the music does not play on startup automatically.
- [x] The enemy rocket tank should not have the same color as the harvester.
- [x] The aiming of the tank-v2 is totally off. It should be able to hit moving target as long as they do not change their trajectory.
- [x] The color of the tank-v2 seems to change. It should always be white.
- [x] Console warning: "findPath: destination tile not passable (units.js:101)"
- [x] When I click on some build button twice there is a 3 shown in the batch count.
- [x] Units when attacking should keep being close enough to target in order to be in range of attack but not too close so they get also hit by their own bullets impact.
