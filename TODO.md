## Improvements
- [x] ✅ Make scrolling on the minimap on mobile super smooth.
- [x] ✅ Allow the left sidebar to be toggled while playing on touch devices in portrait orientation so the canvas can fill the screen.
- [x] ✅ Remove the black strip when the portrait sidebar collapses, resize the canvas immediately, support swipe-to-close gestures, and keep the collapsed toggle transparent so the map stays visible.
- [x] ✅ Hide the portrait sidebar toggle while the panel is open and guarantee the collapsed state instantly fills the freed space with the map so no black bar ever remains.
- [ ] Ensure enemy AI prefers placing base buildings with an exact 2-tile gap when space allows; defensive structures and walls can still touch or sit directly adjacent.
- [ ] Throttle heavy-damage unit fume smoke to prevent particle overload and performance drops.
- [ ] Add a JSON file that determines the whole tech tree. Refactor the code to obey this file.
- [x] Ensure the money display updates only every 300ms to save performance on DOM rendering updates.
- [ ] Enemy AI should automatically build next what is the current production bottleneck regarding money supply. Highest prio is energy. When energy is too low it will build a power plant. When there is too little money it will build harvesters but only if there is less than 4 havesters per refinery otherwiese it will build a refinery but only if the money has reached 0 before. So whenevery the money supply reached 0 the highest prio is to build another refinery (given the power supply is sufficient). When money supply is sufficient focus on building a good base defence with at least 2 turrets and one tesla coil and one rocket launcher. If that is given focus on producing as many combat units as possible. When the money raises faster than tanks can be build then build more vehicle factories to speed up the production.
- [ ] Enemy AI must repair damaged buildings using the same post-attack cooldown rules as the player and prioritize critical infrastructure (construction yard, power, refinery, factory/workshop, radar) whenever its cash reserves are low.
- [ ] remove "tank" in favour of "tankV1" from codebase (redundant?)
- [ ] **Refactor:** move all constants into config.
- [x] Ensure mobile drag-to-build interactions auto-scroll the map within the last 20px near canvas edges on touch devices, speeding up as the cursor nears the boundary while keeping the center stationary.
- [x] Offset the left-edge drag-to-build scroll trigger on mobile by the action bar width and safe-area inset so accidental scrolling near the controls is avoided.

## Features
- [x] ✅ Implement articulated howitzer gun using the tankV1 barrel asset with ballistic elevation, directional muzzle flash, stronger recoil, and movement/firing lockouts while the barrel adjusts.
- [x] ✅ Rotate the shared howitzer barrel sprite by 180° and realign recoil/muzzle effects so the muzzle matches the wagon's facing.
- [x] ✅ Ensure ammunition trucks leave no wrecks on destruction and detonate with scattered munitions that threaten all nearby units and buildings.
- [ ] Danger Zone Map Feature (aka DZM): Let each enemy AI create a DZM where for each tile the damage per second is calculated based on the defence buildings of all non friendly other players on the map (including human and ai players). For each tile the damage per second will be calculated by checking which non allied defence buildings are in range and how much damage they could make based on their firing rate and damage per shot (also take burst shots into account). Whenever a new defence building is added to the map update that DZM. Ensure not to make this updates on a frame base in the game loop. Only do updates event based when new defence buildings get added or destroyed/sold. Also ensure this map is generated whenever a game is loaded (do not persist the DZM itself in save games). the DZM for each player can be show as an overlay on the map when pressing the z key. first time z key is pressed the DZM for the user player is shown. 2nd time the z key is pressed the DZM for the next player is shown and so on until all players were looped. Then it will hide the DZM overlay. Next time it will again start from user player DZM and so on.

The DZM overlay will look like a height map overlay with red 1px width lines that have 50% opacity. The closer the lines are together the higher the gradient is at this tile. Ensure to put the DZM overlay renderer into a separate new file. the DZM will be rendered on the map tiles but below buildings, units and HUD. When DZM overlay is active show in top right corner which player's (player red, yellow, green, blue) DZM is visible.

- [x] ✅ **Spec 004** Add remote control feature (aka RCF) for tanks
  - [x] ✅ when one or multiple tank(s) are selected the user can
    - [x] ✅ move it forwards by holding the arrow up key
    - [x] ✅ move it backwards by holding the arrow down key
    - [x] ✅ turn the wagon left by holding the left key
    - [x] ✅ turn the wagon right by holding the right key
    - [x] ✅ fire forwards by pressing the space key. Then the tank aims at the farthest point within range.
- [x] ✅ **Spec 003** Add recovery_tank to the game
  - [x] ✅ It can be built in the vehicle factory if a workshop exists
  - [x] ✅ The image assets for sidebar build button and unit on the map already exist in the respective folders named "recovery_tank.webp" each.
  - [x] ✅ It moves like a tocket_tank but 50% faster when not loaded otherwise it moves as fast as a tank when loaded
  - [x] ✅ It can repair any friendly damaged unit (repair mode).
  - [x] ✅ repairing a unit to 100% takes as long as buildings that specific unit.
  - [x] ✅ repairing works gradually and costs apply gradually but 100% repair would only cost 25% of the original cost to build that unit.
  - [x] ✅ any unit within 1 tile distance will be repaired automatically one by one at a time. The repair starts when the recovery_tank turned towards the unit (like aiming towards works from a rocket tank)
  - [ ] with the recovery tank when selected the user can click on a tank that is not moveable anymore (indicated by "moveInto" cursor) for towing it around. When the user click again on the unit that is being towed then it will release again.
  - [x] ✅ the recovery tank costs 3000 and has the same armor as the tank_v3.
  - [x] ✅ ensure to play the existing repair sound like (repairing.mp3, repairFinished.mp3)
- [x] ✅ **Spec 003** Add a hospital to the game:
- [x] ✅ 1) Add the build button to sidebar: cost 4000, health 200, power -50MW
- [x] ✅ 2) Add the image asset of the building for the map
- [x] ✅ 3) All tanks now have 4 crew people on board (each person is indicated by a small colored mannequin in a corner of the HUD):
- [x] ✅ 3.1 driver (top left blue) if dead tank cannot move wagon anymore but can still rotate the turret and fire at targets within range
- [x] ✅ 3.2 gunner (top right red) if dead tank cannot rotate the turret anymore but the tank can still fire at a target by rotating the entire wagon until gun points at target (might look funny)
- [x] ✅ 3.3 loader (bottom left yellow) if dead tank cannot fire anymore at all
- [x] ✅ 3.4 commander (bottom right green) if dead tank cannot be moved anymore by the user => it will only operate own and only defend itself or move back to base or complete it path when it was added before the commander died. Prio is as follows then: first defend yourself then continue path/waypoints if there is one then go back to base ideally directly to repair if there is a workshop.
- [x] ✅ 4) when the tank goes to the 3 tiles in below the hospital dead people will fill up again. One person will take 10s to be restored and costs 100.
- [x] ✅ 5) when a tank gets hit the likelyhood for each individual crew member to be killed is 15%.
- [x] ✅ 6) Make sure to play the respective sound file when a crew member got killed (loaderIsOut.mp3, driverIsOut.mp3, commanderIsOut.mp3, gunnerIsOut.mp3)
- [ ] 7) Ensure that the enemy AI will move the tanks with missing crew members back to hospital before continuing the battle.
- [x] ✅ **Spec 003** 8) Ambulance: When a hospital is build it unlocks the build button of an ambulance unit
- [x] ✅ 8.1 an ambulance unit costs 500 and has 25 health
- [x] ✅ 8.2 it is 3 times as fast as tank_v1 on streets and 1.5 times as fast as tank_v1 on grass
- [x] ✅ 8.3 when freshly build the ambulance has 10 people on board
- [x] ✅ 8.4 when an ambulance is selected and the mouse hovers over a friendly unit with missing crew members than the cursor turns into a "moveInto" cursor and the user can left click to command the ambulance to go to the target unit to restore the missing crew members.
- [x] ✅ 8.5 the ambulance has a loading bar (like the harvester) that correlates to the amount of loaded people (10 people equals 100%)
- [x] ✅ 8.6 the restore process starts when the ambulance is assigned to the unit and it is within 1 tile range. It takes 2 seconds for each person to go from the ambulance to the target unit. Make sure to update the loading bar of the ambulance during this process and add the mannequinns to the target unit.
- [x] 8.7 The mannequinns are added in this order: driver, commander, loader, gunner

- [x] Add a gas station to the game
  1) add the image asset for the sidebar to the build button (images/sidebar/gas_station.webp)
  2) add the image asset for the building on the map (images/map/buildings/gas_station.webp)
  3) the building has 50hp and consumes 30MW and costs 2000
  4) when a units is at one of the 3 tiles below the building it can refill its gas.
  5) It takes 7 seconds for each unit to refill its gas.
  6) One refill costs 50.
  7) Ensure that now every unit has a gas indicator that lives in the center of the bottom of the hud and is about 50% the witdth of the HUD. It looks like the harvesters loading bar but in blue.
  8) When the gas loading bar is at 0% the unit cannot move anymore until it gets refilled by a mobile tanker truck.
  9) Gas tank sizes and consumption of units (assume 1 tile is about 1000m in width and height => put this tile length for gas consumption into a constant from config.js and reuse it for any further calculation )
     9.1 tank_v1 gas tank size is 1900l and consumes 450l/100km
     9.2 tank_v2 and tank_v3 same as tank_v1
     9.3 rocket_tank gas tank same as tank_v1
     9.4 harvester gas tank is 2.650l and consumes 30l/100km gas when moving AND 100l per harvested ore tile
     9.5 ambulance gas tank is 75l and consumes 25l/100km
- [x] Add a mobile tanker truck to the game
  1) add the image asset for the sidebar to the unit build button (images/sidebar/tanker_truck.webp)
  2) add the image asset for the unit on the map (images/map/units/tanker_truck.webp)
  3) the tanker truck has 20hp and costs 300. It moves twice as fast as a tank_v1.
  4) when the tanker truck is within 1 tile range of another unit this the tanker refils all surrounding units automatically one by one. Each refill tankes 7 seconds.
  5) when the tanker truck is selected and the mouse hovers over another unit the cursor turns into the "moveInto" cursor and when then left clicked on it the tanker truck will move there to refill that unit.
  6) the tanker truck has an own gas tank that is required for it to drive that takes 700l. This gas tank is indicated by a blue bar at the bottom (same like with any other unit).
  7) the tanker truck has another gas tank to refill other units. This gas tank has 40000l of gasoline. It is indicated by a loading bar on the top (same like the one used for harvesters).
- [ ] Add a sound for when party A attacks party B for the first time.
- [ ] Implement an allies system so that the player can ask an enemy to become an allie by clicking at thier base building and click the "unite" button that will appear when the diplomacy level between both parties reached 100%. The diplomacy level "DL" will level is a value that is hold for each party to each party. So party A can have another DL to B than B to A. When A attacks the enemy of B then DL for A raises on B. If A attacks B or an allie of B then the B's DL of A falls. When player clicks a base building then the DL of the party will be shown for each other party on the map with another "loading" bar below the health bar with the title "Diplomacy". The color of each bar indicates to which party it relaes to (each parties color).
- [ ] Ensure for each party P there is an internal statistic that tracks for each other party how much economical damage was made by adding the cost of the units and buildings destroyed by that specific party. Make sure there is a shortkey that toggles the display of that statistics during gameplay. Each enemy AI focusses on attacking the party that caused the most amount of economical harm to them so far.
- [ ] Add AI policy scripts: Make sure to come up with a sophisticated modular extensible unit AI policy architecture that can be used for humand and AI players' units. Create and integreate some JSON policy script to manage the AI's combat behaviour including priorities and another one to manage the AI's base build und unit production behaviour. Add the following initial scripts for this behaviour:
  - [ ] when player attacks -> defend or retreat into base if the unit under attack is too weak (havesters or combat units that are outnumbered) to regroup in the protection of the base defence. When attack was defended strike back.
- [ ] Expand the sell buildings function so that also unit can be sold when they are in the repair workshop and fully repaired and the player clicks on them while in repair mode. When in repair mode and the user hovers over a unit that does not fulfill these conditions show the selling_blocked cursor instead of the sell cursor.
- [x] Add a unit repair building to the buildings menu. It costs 3000$ and has 3 times the armor of a tank. Any unit can be directed to move there when selected and player clicks on the building. Then the unit will move to any surrounding tile and stays there. As long as the unit is close to the repair building it will get repaired (restore healthbar) gradually 2% every second.
- [x] Add artillery unit with 100% more range than tank and a radius of 3 tiles damage area around the impact. The accuracy is only 25% of hitting the target tile directly but 100% of hitting any tile in the radius of 3 tiles around the targetted tile.
- [x] **Spec 008** Add Ammunition Factory & Supply Truck System (see `specs/008-ammunition-system/spec.md`)
  - [x] Ammunition Factory building: $2000 cost, 3x3 tiles, 250 health, 40MW power, resupplies units within 2 tiles in 7s
  - [x] Ammunition Supply Truck: $800 cost, 30 health, 2x tank speed, 500 rounds cargo, resupplies within 1 tile
  - [x] ✅ All combat units have limited ammunition (Tank V1/V2: 42 rounds, Tank V3: 50 rounds, Rocket Tank: 21 rockets, Howitzer: 30 rounds, Apache: 38 rounds)
  - [x] Orange ammunition bar on left side of HUD (health top, fuel right, ammo left)
  - [x] Ammunition Factory explosion: 2-tile initial blast + 30-50 scattering particles dealing 30-50 damage each for 5 seconds
  - [x] ✅ Helipad ammunition reserves: 250 rounds capacity (50% of truck cargo), resupplied by Ammunition Supply Truck, transfers to landed helicopters
  - [ ] Enemy AI builds
    - [x] ammunition factories
    - [x] produces supply trucks
    - [?] and manages unit resupply automatically
  - [x] ✅ Units with 0 ammunition cannot fire, display "No Ammunition" notification when attack commanded
  - [x] ✅ Apache helicopter ammunition system implemented with `rocketAmmo` field (38 rounds capacity)
  - [x] ✅ Apache combat system checks `rocketAmmo` before firing, enforces 300ms volley delay
  - [x] ✅ Helipad ammunition transfer to landed Apache helicopters implemented
  - [x] ✅ Cheat system supports ammunition manipulation for all unit types including Apache
  - [x] Image assets: `/public/images/map/buildings/ammunition_factory_map.webp`, `/public/images/sidebar/ammunition_factory_sidebar.webp`, `/public/images/map/units/ammunition_truck_map.webp`, `/public/images/sidebar/ammunition_truck_sidebar.webp`
- [ ] Add online multiplayer support where humans can join an existing game and take over an AI party.
  - [ ] The interface should be minimalistic
  - [ ] in the sidebar below the "Players: " input there will be a label for each active party in the game like "Red: NameOfRedPlayer" and so on. Each row has another party listed.
    - [ ] on the right of each row is a small invite button that generates an invite link to take over that party by a human player on the internet
    - [ ] when a human opens the link in a browser the game is started and the browser connects to that game and the party is taken over by that player.
  - [ ] Before connecting the new player has to enter his name/alias. After that he will join immediately to the running or paused game of the host.
  - [ ] Use WebRTC to connect the browsers directs to one another so no gaming server is needed. The host browser will serve as the source of truth when more than 2 players are joined.
  - [ ] the host will get a notification when a player joined successfully.
  - [ ] when a party disconnects i.e. by closing the tab the party will immediately be taken over by an ai player again but the invite link will work again if opened again in a browser.
  - [ ] the invite link is specific to a game instance and a party
  - [ ] any party can save the game but when a non host will load the game this non host will be the new host and the game instance will be different and also the invite links will be different from the original.
  - [ ] only the host can start/pause the game
  - [ ] For the initial webRTC connection setup use a public STUN like some from google "stun:stun.l.google.com:19302"
## Bugs
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

## Improvements
- [x] When a group of units attack a target and there are friendly units in line of sight so they can't fire then this unit needs to walk around the target in a circle until line of sight is free to attack the target. Make sure the circle's circumfence the unit is using to walk along has the radius that is equivalent to the distance between the target and the unit.
- [x] Make sure narrated sounds like (unitReady) can be chained and will not be played at the same time but one after another up until a stacking size of 3 everything after that will be skipped if it comes before the stackable sounds are finished playing. So for all playSound calls in the code that play a "narrated sound" make sure to add the new stacking boolean to true and update playSound so it is able to provide stacking behaviour as described.
- [x] Refine the coloring of the power bar and its logic on impacting the production.
- [x] Add all favicons and shortcut icons.
- [x] **Refactor:** remove the soundMapping and use soundFiles directly instead.
- [x] Use the same corner smoothing algorithm that is used for streets also for water tiles.
- [x] The game is lost for any player when he has no more buildings left. Make sure the game is not over only when the base construction building got destroyed!
- [x] Ensure tesla and rocket turret coil can only be build after radar.
- [x] When entering the save game's name the user can save by pressing enter.
- [x] Ensure the leveling stars on a unit when not selected look like the same as when they are not selected (smaller).
- [x] Make sure the showNotification clears the previous one immediatly before showing a new one.
- [x] On pressing R Key the repair mode should be toggled unless there is no input having focus.
- [x] Clear previous notifications before showing a new one.
- [x] Make sure the map generation makes the streets that connect the bases and ore fields are 1 tile thinner. Also Make sure that for multiple parties the streets merge and not overlap to prevent covering major parts of the map in streets.
- [x] The rocket tank should not have a turret but instead 3 small static tubes on top of it to indicate a rocket launcher.
- [x] only show health bars if units or buildings are damaged
- [x] The selection indicator for units should only be visible at the conrers (like with buildings).
- [x] Make sure buildings cannot be selected when dragging a selection box. (Works for AGF though).
- [x] Make the box that indicates a selection around a building only 2px wide and only show it at the corners not the entire edges.
- [x] The health bar for player's own units and buildings as well as the one for the enemies should only be visible if those units/buildings are damaged or selected.
- [x] Enemy unit types need to have the same color as the player unit types. That means for example that a tank_v1 of the player should be blue as well as a tank_v1 for the enemy.
- [x] cut out the images for the buildings to be rendered on the map so that the background tiles around are merging with the building. Make sure to use transparency for those images.
- [x] ✅ **Spec 005** Make sure every unit factory has its own individual assembly point that can be set by selecting the factory and then right clicking on the map. This will replace the current mechanism where the building factory is selected to define the assembly point. Whenever a factory gets selected their assembly points get visible otherwise they are hidden.
- [x] ✅ **Spec 006** Make sure the tanks (and turrets) when they fire have:
  - [x] ✅ (1) a recoil animation on their gun.
  - [x] ✅ (2) a muzzle flash animation
- [x] Ensure the players tanks do not move away from the target or towards the target when attacking. ONLY when the target moves out of range they should follow until they get in range again.
- [x] Tanks movement speed should be 50% higher in general.
- [x] ✅ **Spec 006** Rocket tank shall fire 3 projectiles instead of 1 but with lower damage each. The projectiles are currently way too fast and need to be at least 4x slower.
- [x] The tesla coil should make little damage to the target.
- [x] Tank projectiles make too much damage.
- [x] **Refactor:** updateGame.js is too big and needs to be modularized.
- [x] **Refactor:** enemy.js is too big and needs to be modularized.
- [x] **Refactor:** Rendering.js is too big and needs to be modularized.
- [x] **Refactor:** inputHandler.js is too big and needs to be modularized.

## Features
- [ ] Wrecks and recovery/recycling: Ensure the units when destroyed do not just vanish from the map but their left overs keep lying on the map. The left overs should look totally color desaturated and slightly noisy to indicated dirt and damage (cache those desaturated images and reuse them). Any (also the ones from the enemy) left over unit can be pulled by a recovery tank to the base when player has the recovery tank selected and clicks on the tank. The the recovery tank will drive to the target then mount (indicated by a 2px black string that connects both units) and then automatically drive to the workshop where it unmounts and the unit gets fully restored but without crew. 

2nd option is that the user has the recovery tank selected and clicks on the left over unit while holding shift key. Then the leftover unit get recycled completely (vanishes from the map) but the owner of the recovery tank gets 33% of the value of the unit added to his budget (like a harvesting of resources). This process takes about as long as it took the unit to build. Show blue progress bar on the recovery tank while this mode is active.
- [x] ✅ **Spec 005** Add Drag and Drop mode for units (aka DnDU): User can drag a build button of a unit on the map that means when the unit is ready it will automatically move that point on the map.
- [x] Use arial sound for moving tanks and combat sounds so that these get the loudest when they are in the center of the screen and get quieter when the screen center moves away from the location of the sound.
- [x] ✅ **Spec 004** Add guard mode feature (GMF) for combat units. When guard mode is active and the unit is selected and the player clicks on a friendly unit the guarding unit will follow that unit and attack any incoming enemy in range without following the enemy but only following the unit to guard. Guard mode can be activated when a unit is selected and the cmd key is hold and then the unit to be guarded it selected by left click. As soon as the cmd key is pressed while a unit is selected the cursor turns into the "gurad.svg" cursor.
- [x] ✅ **Spec 004** Add a path planning feature (PPF): When user has selected some units then they can be commanded to do a list of actions in the order they were assigned. Those actions can be move to or attack or retreat. The PPF is used while holding shift key and then every normal action will be chained. Actions like move to or attack or AGF (attacking multiple targets) can be used with PPF. Make sure this feature does not interfere with the expand selection feature where move units can be added to current selection when shift is hold while clicking on friendly units to add them to the selection.
- [x] ✅ **Spec 005** Add the chain build mode (CBM) that works as follows: When user drags a building build button in the sidebar while holding shift key then CBM is active as long as shift key is pressed. The process is like this: User presses shift key, drags a build button (like the concrete wall but works for all buildings) on the map, releases the left mouse button, then the first building in BPM is planned on the map (so far everything working as before in BPM) but now CBM kicks in and the user moves the cursor over the map and while doing that CBM will render the map build overlay on the map for a straingt chain of buildings that fit in between the first building (that is already planned on the map) and the position of the cursor. When user now clicks a 2nd time the line of buildings to be planned is locked in and BPM starts for that line of buildings. Now (as long as the shif key is still pressed) the endpoint of the line is the new startpoint for a new line of that kind of buildings and so on util the user releases the shift key which results in the termination of CBM and no further chain of buildings will be planned. Make sure that CMB does not interfere with normal BMP or the default build mode. Both should still work like before! Also make sure that When a chain is planned that the build button's stack counter bubble gets increased accordingly.
- [x] ✅ **Spec 005** Make a little flag animation for buildings instead of the colored square in the HUD currently used to indicate the party a buildings belongs to. Replace it with a flag that has a pole and a rectangular flag in the color of the party. The flag is always on the ground in the top left corner. Make sure there is some flattering in the wind animation of the flag and that is has a black border and a dark silver pole. Ensure the wind direction is the same as for the smoke wind direction animation! The size of the flag should not be wider as the current HUD rectangle.
- [x] Add some some animations for the cooling towers of the refinery and the power plant. Make sure to analyse the map image assets to determine the center fore the each somke animation. Make sure to add some wind effect for the direction of the smoke animation. Reuse when possible the somke animations from the tank when it is damaged or use utility functions for both.
- [x] ✅ **Spec 005** Introduce drag and drop build mode:
  - [x] ✅ When user drags an image from the sidebar onto the map immediately when the cursor is above the map while dragging ensure the placement overlay for the specific building is shown. When the user releases the left mouse button to finish the dragging then the blueprint mode (aka BPM) gets active. That means that on the map there will be a blue overlay being shown with the name of the building inside as text.
  - [x] ✅ as soon as the construction of that building is finished the building will be automatically placed where the blueprint was set. No need for extra placement by clicking the build button again.
  - [x] ✅ Make shure this feature does NOT interfere with the normal build workflow that should still be possible like before.
  - [x] ✅ When construction gets aborted (normal workflow by rightclick on sidebar's build button) make sure to remove the blueprint from the map again.
  - [x] ✅ Make sure to only place the finished building on the map when the occupancy map allows it (the blueprint should not block the tiles itself!) especially when the construction is finished and the final building gets placed automatically. Besides that the blueprint cannot be set when any map tile is occupied (same logic as normal placement logic => reuse that logic!).
- [x] ✅ **Spec 005** When a new building is placed on the map create a construction animation by slowly letting an uncolored image of the building's image asset fade in from bottom to top for 3s (this means the height of the building is clipped and increases over the timespan of 3s from 0% to 100%) and then letting the full color of it fade in for another 2s.
- [x] Completely hide build options in the sidebar for units and buildings until they are unlocked. When they get unlocked play sound "new_building_types_available" or "new_units_types_available" and show a yellow "new" label in the top right corner of the production tile until the first production of that kind was triggered.
- [x] Add some smoke animation on the back of tanks when they are below 25% health.
- [x] Introduce a new seed crystal that cannot be harvested and has 2x the spreading rate but only spreads normal blue crystals. Use the ore1_red.webp image asset for it. Make sure during map generation those seed crysals (1-3 of them) are always in the center of an ore filed.
- [x] Add corner smoothening rendering algorithm to the map renderer where the corners of streets get cut smoothly to form straight diagonal lines. Smoothening Overlay Textures (SOT) use the street texture, work in all diagonal orientations, apply only on land tiles, render above streets but below rocks, ore and buildings, and expand slightly to hide single-pixel gaps.
- [x] Make sure the money for the repair will not be removed on click when repair mode gets applied but gradually. Also make sure that the repairing of a building can be stopped again when clicked again while repair mode is active and unfinished on that building.
- [x] Add an fps overlay in the top right corner that can be toggled on/off with "f" key. Add info to help menu.
- [x] Add corner smoothening rendering algorithm to the map renderer where the corners of streets get cut smoothly to form straight diagonal lines. Smoothening Overlay Textures (SOT) use the street texture, work in all diagonal orientations, apply only on grass tiles, render above streets but below rocks, ore and buildings, and expand slightly to hide single-pixel gaps.
- [x] When units are below 25% health they start to move with 50% of the speed of normal units.
- [x] Rocks currently do not block the occupancy map.
- [x] Add 3 star level system for any combat unit (all units but harvesters). Every unit starts at level 0. Whenever a unit (player or enemy ai) kills an opponent unit (not building) the unit gets in internal bounty counter increased by the cost of the killed unit. When that bounty counter is twice the value of the unit itself, the unit gets promoted to level 1. When the counter is at 4x the unit value it gets to level 2 and when the counter is at 6 times the unit value it gets to final level 3. To indicate the units level there are up to 3 yellow stars adding up from the center above the units health bar. Make sure this system works for all players (human and AI).
- [x] Make sure there is some 2px yellow levelup progress indicator inside the health bar on top of it in the same box overlaying it so I can see the progress up to the next level when unit is in combat. When next level is reached it starts again from 0.
- [x] Add meaning to the level system so:
  - **Level 1:** means that units will get 20% range increase.
  - **Level 2:** means that units will get 50% armor increase.
  - **Level 3:** means that units will repair themselves when not moving by 1% every 3 seconds AND will get 33% increase in fire rate.
- [x] When units are selected and the "s" key is pressed then they stop attacking. When no units are selected then the s key triggers the sell mode on/off.
- [x] ✅ **Spec 006** Make sure tanks have hit zone damage multipliers: when hit from behind the damage is 2.0. When hit from front the damage is 1.0 and from the side it is 1.3.
- [x] ✅ **Spec 006** When commanding a group of units to move to one spot make sure that every unit gets a different tile to move to assigned. Also make sure that the targetted tiles are highlighted by some green semi-transparent triangle (upside down like the one for the AGF but in green). Whenever a unit gets selected again make sure to show that indicator again on the map IF that unit is moving (also ensure the same holds for the AGF attacking indicator)
  ✅ Red indicators for normal attacks (only when attacker is selected)
  ✅ Green indicators for movement targets (only when unit is selected)
  ✅ Both red and green indicators during AGF
  ✅ Live updates as units move during attacks
  ✅ Proper persistence after reselection
  ✅ Proper cleanup when attacks finish or targets change
- [x] Show occupancy map as red glow on each tile when toggeled with "o"-key.
- [x] Make sure that when any input is selected keyboard shortcuts are disabled.
- [x] ✅ **Spec 006** Change tank rendering to support tank image assets consisting of 3 images with transparency to render one tank dynamically. (1) the tank wagon (tank_wagon.png) with the mounting point 32x60y in pixels from top left to mount the turret's center. The image asset for turret is named "turret_no_barrel.png". It has a mounting point for the gun barrel at 32x,68y pixels from top left. The gun barrel rotates with the turret in sync. The turret can rotate on the wagon. When the tank fires the gun barrel moves (dampened movement) up to 5 pixels to the top (reduces y coord) to indicate a recoil. Basically use the same mechanism like before but with image assets instead. Make sure to cache the images to make the rendering of hundreds of tank performant. Also shift the muzzle flash to coords 2x, 64y based on the gun barrel image. The rotation of all 3 image assets is aligned by default within the assets (they all point south).
  - [x] ✅ Make sure to implement this as an alternative rendering method to the existing non image based tank rendering so it can be toggled on and off during combat by the user (use some keyboard shortcut). Make sure to put the image based rendering in at least one separate file to have the code separated from the previous tank rendering. If possible use code fragments from the previous rendering technique or at least make sure there is not too much code redundancy.
  - [x] ✅ (1) Make the mounting points I described configurable by some json file so I can tweek them if needed.
  - [x] ✅ (2) Do not change the aspect ratio of the 3 images!
  - [x] ✅ (3) when the wagon rotates the turret should also rotate in the same way BUT only if the turret is aiming at some thing then it will rotate independently from the wagon to keep aiming at the target.
  - [x] ✅ (4) The orientation of the wagon is by default in the image asset facing down (to bottom). Same for the gun barrel and the turret. Make sure that the driving direction in the game is aligned with the facing of the wagon. If tank drives from top to bottom then the wagon should face also to the bottom.
- [x] ✅ **Spec 007** Support up to 4 parties in a game. Each player starts in one corner. One party can be played by human player. The others by AI (or later via network by ohter humans -> keep the interface abstract to upport AI and other humans). Define a set of 4 Colors that can identify each party. Add a number input to the end of the sidebar to define the number of players (label: "Players") on the map. Whenever the map is newly generated it will affect the map creation but not instantly. Make sure each AI player is attacking any player on the map (there is no teams feature yet, will come later). Make sure the map creation process is influenced by the number of players (regarding the direction of streets and ore spots)
- [x] Make a dedicated sound for attacking confirmation
- [x] ✅ **Spec 006** Add tank_v3 to the build menu. tank_v3 can all what tank_v2 can do but add the aim ahead feature so it takes the speed and direction of a moving target into account when fireing at it to increase the likelyhood of a direct hit. It costs 3000$ and has 30% more health than tank_v2.
- [x] Support cheat codes for better testing via browser console. Make sure there is a code for invincibility for all units (like "godmode on" or "godmode off") and a code to get x amount of money (like "give 10000$")
- [x] ✅ **Spec 004** Implement an attack group feature (aka AGF): All selected players units can attack a group of enemy units by left click and hold to drag a box (displayed in red) around the enemy units to be attacked. Then all those units will be attacked one after another. All units to be attacked will then have a small semi transparent slightly bouncing red triangle above the health bar to indicate that they are being attacked. Make any unit in ADF mode will leave that mode when commanded to do sth. else (including another AGF mode).
- [x] When a unit on the map is double clicked then automatically all units of this type visible on the screen will be selected together. When player holds shift key while double clicking on a unit then all units of that type will be added to the existing selection. When player just holds shift key and just makes a normal click on a unit then only this unit will be added to current selection.
- [x] ✅ **Spec 006** Ensure that enemy units always attack player units when they are being attacked themselves, unless they are in "flee to base" mode
- [x] Show some progress when the harvester is unloading the ore at the refinery by showing how the load indicator at the harvesters goes to zero.
- [x] Add refinery building costing 2500$. Its size is 3x3 tiles. Its armor is same as for the base factory. Any harvester can be assigned to one specific refinery to unload only there by having a harvester selected an clicking then on the refinery. The refinery needs 30 energy.
- [x] When player builds the radar station it enables the overview mini map. Before that map is just gray. It consumes 50 energy. When it get destroyed and no other radar station is in the players building list the mini map gets disabled again.
- [x] Make sure the bullets from tanks and turrets fire at an exact location on the map and explode there rather than fly over the entire map.
- [x] When game ist restarted with the restart button there should NOT be a page reload but the game state should be resetted AND the statistics should be kept (win/loss)
- [x] Implement milestone system and show first milestone of building a refinery by showing a video with sound of a tank running over crystals.
- [x] Make the enemy more intelligent so it does not just run into players defense over and over again but moves away when his units are too weak to break into players base turret defense. Then the enemy gaters units in safe distance to players base and starts another attack with more units trying to break players defense and so on. The enemy should also try to find a way around the players defense to attack weak spots of the base.
- [x] Ensure harvesters spawn from the vehicle factory not the building factory.
- [x] Ensure money for builds is gradually spend during build process
- [x] Lower harvester unload time to 10s.
- [x] Increase map scroll speed inertia by 3x.
- [x] Add save and load game functionality with a menu containing a list with save games and their labels.
- [x] Ensure that production queues for buildings and units can be filled even when no more money is available. Ensure the money is only charged when production is actually starting.
- [x] Ensure enemy also has to build ore refineries and vehicle factories to produce harvesters and vehicles. Same build rules should apply for enemy AI like they are now for the player.
- [x] Make sure the newly produced vehicles get spawned from the vehicle factory and not from the construction yard. When there are multiple vehicle factories make sure the units come out alternatingly from all of the factories one by one.
- [x] Vehicles now spawn on the tile directly below the center of the vehicle factory. If that tile is occupied, the existing unit is moved to a nearby free tile using algorithm A1 before the new unit appears.
- [x] For any vehicle to be build a vehicle factory is required. Make sure the build options in the sidebar are disabled until the factory is built. Disabled sidebar buttons are grayed out (just add 50% transparency). The more vehicle factories are build the faster the vehicle production gets. If production speed with one factory is 1x it is 2x with two factories and so on.
- [x] For harvesters to be build it is required to have a refinery and a vehicle factory.
- [x] Harvesters can only bring the ore the the refinery not to the construction yard anymore. At the refinery it takes the harvester 20s to unload the ore before it can go again to harvest automatically. At each refinery there can only be on harvester at the time being unloaded all othery have to wait for it.

## Bugs
- [ ] Ensure enemy AI enforces a minimum one-tile gap between buildings before construction starts, except for walls and adjacent defensive structures.
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