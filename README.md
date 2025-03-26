# gemini-rts-game

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/theSystem85/gemini-rts-game)

## Intro
this game is a test for gemini advanced on how to make a complex RTS game mostly from scratch to test the 1M token context window.

# Initial prompt
Here is the initial prompt that needs to be refined over and over again to get the best result for an initial generation of the code.

## Prompt
Develop a fully functional, minimal viable product (MVP) of a real-time strategy (RTS) game using HTML, CSS, and vanilla JavaScript. Follow these specifications closely:

Intro
1.1 Gemini RTS Game – a test project to build a complex RTS game from scratch using a 1M token context window.

General Setup
2.1 Full-Screen Map and Tile Grid
2.1.1 The game uses a full-screen map covering the entire browser window.
2.1.2 The map is divided into a grid of 32px by 32px tiles with subtle borders.
2.1.3 The grid must be generated and rendered with high performance.
2.1.4 Map scrolling: right-click and drag with inertia that decelerates smoothly and never exceeds map boundaries.
2.1.5 The initial viewport is set so that the player’s base is always visible.

2.2 Tile Types and Features
2.2.1 Supported tile types with colors:
2.2.1.1 Land – brown (e.g., #A0522D)
2.2.1.2 Water – blue (e.g., #1E90FF)
2.2.1.3 Rock – gray (e.g., #808080)
2.2.1.4 Street – light gray (e.g., #D3D3D3)
2.2.1.5 Ore – golden (e.g., #FFD700)
2.2.2 Ore fields are passable.
2.2.3 Water, rock, and street features are arranged in connected patterns rather than randomly.
2.2.4 Carve an L-shaped corridor between the player and enemy factories so that water and rocks do not block the path.
2.2.5 The corridor uses street tiles that grant a 100% speed bonus.
2.2.6 Ore spreads to adjacent land tiles every 90 seconds with a probability factor of 0.06.
2.2.7 When generating the map randomly, include an ore growth mechanism with a spread interval of 90000 ms and a probability factor.
2.2.8 Ensure that at least one street always connects both bases.
2.2.9 Include a "Shuffle Map" button and a seed input field to generate reproducible maps.

Structures
3.1 Factory Buildings
3.1.1 Create two factories, each occupying a 3×2 tile area.
3.1.2 Factories are positioned at least 5 tiles away from map edges (for example, player at bottom left, enemy at top right).
3.1.3 Each factory has health and a visible health bar above it.
3.1.4 Factories are targetable and damageable by enemy units.
3.1.5 Factories produce units with a 3-second visible production timer that deducts money.
3.1.6 Tanks are produced whenever money is available and enough harvesters are alive to maintain a continuous income stream.
3.1.7 When a newly built unit’s spawn area is blocked, use algorithm A1 (see section 7) to move the blocking unit to the closest free tile.
3.1.8 When a factory’s health reaches 0, it is marked as destroyed and removed from the map.

Units
4.1 Tanks (Player and Enemy)
4.1.1 Movement uses A* pathfinding with diagonal support.
4.1.2 Tanks move at a speed of 0.5 tiles per second.
4.1.3 Movement includes smooth acceleration and deceleration.
4.1.4 Tanks cannot occupy the same tile; an occupancy check offsets units if necessary.
4.1.5 Tanks can be selected individually (click) or via multi-selection (drag bounding box).
4.1.6 When given move or attack orders, tanks compute a formation path, avoid overlaps, and stop within firing range.
4.1.7 Mouse cursor changes:
4.1.7.1 Indicate if a target tile is blocked.
4.1.7.2 Indicate if an enemy unit or building is under the pointer (attack possible).
4.1.7.3 Indicate if the target is within firing range (no movement needed).
4.1.8 Each tank has a turret (a short line) pointing at its current target.
4.1.9 Tanks fire bullets with randomized damage scaling (0.8× to 1.2× base damage) requiring 3–5 hits to destroy a tank.
4.1.10 Friendly-fire prevention: Tanks do not fire at friendly units initially; firing only occurs when there is a clear line of sight to enemy targets.
4.1.11 Collision and stuck prevention: Before moving to the next tile, check if it is free; if occupied, move to a random nearby free tile using algorithm A1.
4.1.12 Additional bug fix: When tanks are in range of an enemy, they continue firing and can move if new orders are issued.

4.2 Harvesters
4.2.1 Harvesters are visually distinct (e.g., violet).
4.2.2 Harvesters move at 50% of the tank speed.
4.2.3 Harvesters have 300% the armor of tanks.
4.2.4 When on an ore tile, harvesters begin mining, which takes 10 seconds.
4.2.5 Harvesters have a capacity of 5 ore units with a progress bar shown below their health bar during mining; when full, the bar remains at 100% until unloading.
4.2.6 When full, harvesters automatically compute a path to any tile adjacent to the factory.
4.2.7 Upon unloading, add $1000 to the player’s money and reset the harvester’s ore load to 0.
4.2.8 After unloading, harvesters automatically move to the nearest ore field to resume mining.

4.3 Enemy Tanks
4.3.1 Enemy tanks are produced automatically at the enemy factory.
4.3.2 Production occurs when money is available and there are enough harvesters to sustain income.
4.3.3 Enemy tanks are controlled by basic AI:
4.3.3.1 They move toward the player’s factory and/or player units.
4.3.3.2 They scan for player units within a range (e.g., 10 tiles).
4.3.3.3 The AI prioritizes attacking harvesters first.
4.3.3.4 The AI prefers to defend its own harvesters over attacking the player’s base.
4.3.3.5 Enemy units only begin attacking after the player launches their first attack.
4.3.3.6 They are assigned in small groups to attack the player’s base.
4.3.4 Enemy tanks follow the same movement, targeting, and firing rules as player tanks.

Projectiles (Bullets)
5.1 Rendering and Speed
5.1.1 Bullets are rendered with visible trajectories so the player can track them.
5.1.2 Increase projectile speed by 3× compared to the base speed.
5.1.3 Bullets travel slowly enough to be visibly tracked.
5.2 Damage and Collision
5.2.1 Each bullet inflicts randomized damage (0.8× to 1.2× base damage).
5.2.2 A universal collision function checks for enemy units or factories within a 10-pixel threshold.
5.2.3 Bullets update positions every frame; if a collision is detected, damage is applied and the bullet is deactivated.
5.2.4 Check for zero distance to avoid division by zero errors.
5.2.5 If the target is already destroyed, mark the bullet as hit immediately.
5.2.6 Friendly-fire: Bullets skip collision checks with friendly units or factories.

User Interface & Controls
6.1 Sidebar and Minimap
6.1.1 Sidebar is located on the left and does not cover the main map.
6.1.2 The sidebar displays game statistics: money, game time, wins, losses.
6.1.3 It contains build options including a production dropdown for unit type (Tank, Rocket Tank, Harvester) and a production button with a visible countdown and progress percentage.
6.1.4 Production tiles are arranged in two columns with square tiles filling left to right; if more than 5 rows, a scrollbar appears.
6.1.5 Sidebar buttons must be styled beautifully and aligned.
6.1.6 The sidebar includes a "Shuffle Map" button and a seed input field for reproducible maps.
6.1.7 The minimap shows an overview of the entire game map with a bounding box indicating the current viewport.
6.1.8 Clicking on the minimap recenters the main view to the clicked location.
6.2 Map Scrolling
6.2.1 Right-click drag scrolling with inertia is implemented; inertia respects map boundaries.
6.3 Unit Selection and Orders
6.3.1 Single-unit selection via click and multi-unit selection via bounding box are supported.
6.3.2 If a selected unit is destroyed, it is automatically removed from the selection to avoid null references.
6.3.3 After selection, clicking on an empty tile issues a move command to all selected units.
6.3.4 Clicking on an enemy unit or building orders the selected units to move into range and fire.
6.3.5 The selection (bounding box drag) does not trigger movement commands by itself.
6.3.6 Mouse cursor changes indicate valid move or attack targets.
6.4 Start/Pause and Restart Controls
6.4.1 A toggle button is provided to start or pause the game.
6.4.2 A separate restart button is provided to reset the game.
6.5 Sound Effects
6.5.1 Sound effects are implemented for:
6.5.1.1 Unit selection
6.5.1.2 Movement commands
6.5.1.3 Shooting and bullet firing
6.5.1.4 Bullet impact/hit
6.5.1.5 Unit and factory destruction
6.5.1.6 Harvesting ore
6.5.1.7 Unloading ore (deposit)
6.5.1.8 Production start and production ready
6.5.2 Each sound is triggered only once per event and does not affect game performance.

Game Mechanics
7.1 Economy
7.1.1 The player earns money only through specific actions (e.g., harvesting ore); there is no passive income.
7.2 Victory and Defeat Conditions
7.2.1 The player wins by destroying the enemy factory.
7.2.2 The player loses if their own factory is destroyed.
7.2.3 Wins and losses are displayed in the UI.
7.3 Production and Resource Management
7.3.1 Production timers, money deductions, and unit spawning must be reliable.
7.3.2 No new unit spawns into an occupied area; if blockage occurs, use algorithm A1 to move the blocking unit.

Error Prevention and Debugging
8.1 Algorithm A1 – Central Movement Logic
8.1.1 A1 is the single algorithm for moving a unit from point A to B.
8.1.2 When a unit must dodge a bullet (triggered by a new projectile), immediately use A1 to move it to a random free nearby tile.
8.1.3 When a unit is built at a factory and its spawn area is blocked, use A1 to move the blocking unit to the closest free tile.
8.1.4 A1 is used only when a new destination is set or when units collide with moving objects.
8.1.5 Always check that the tile the unit is about to move to is free; if not, choose a random nearby free tile before continuing toward the target.
8.2 Collision and Bullet Logic Safety
8.2.1 Verify that targets exist and distances are nonzero before calculations to avoid errors.
8.2.2 Use try/catch blocks in critical update functions to log errors and prevent game freezes.
8.3 Unit Targeting and Selection Safety
8.3.1 When a selected unit is destroyed, remove it immediately from the selection to prevent null reference errors.
8.3.2 Handle simultaneous shooting and movement events carefully to avoid crashes.

General Requirements
9.1 The game must be implemented in three separate files (HTML, CSS, JavaScript) with inline assets for immediate execution.
9.2 Clearly separate UI logic from game logic through comments and structure.
9.3 Provide detailed inline comments explaining each part of the logic, especially where previous errors occurred.
9.4 Prioritize simplicity and functionality over advanced optimizations.
9.5 Ensure that pathfinding (A1) and collision checks are efficient even with hundreds of units.

Important Notes:
1. Include necessary styles, scripts, and assets inline to avoid external dependencies.
3. Prioritize simplicity and functionality over advanced optimizations or extensive features.

Open Features:
(-) disable default CSS mouse cursor on the game map and switch to an SVG with transparency and animations that is displayed on the game map whenever the mouse moves. Make sure to hide it when the cursor is on the sidebar. Here are the different cursor states:
    (1) Movement Cursor: When a unit (or group) is selected the cursor turns green (make sure to generate an animated svg that indicates a movement target for a game on a map)
    (2) Movement Blocked: When a unit (or group) is selected the cursor turns red (make sure to generate an animated svg that indicates a blocked movement target for a game on a map)
    (3) Attack: When a unit (or group) is selected the cursor turns red with a crosshair (make sure to generate an animated svg that indicates it)
(-) only focus groups on double tapping mapping key (300ms double tap) but not immediately like it is now
(-) refine the coloring of the power bar and its logic on impacting the production.
(-) Also make sure the enemy builds the defense buildings towards the direction of the closest ore field to protect harvesters and the base.
(-) make sure whenever player builds something the order of what the player build is stored to local storage for each game session so the AI can learn on what to build by the players last 20 sessions and replicate randomly any of these sessions. The placement though is randomly around the base independent of the players placement of the buildings but always towards the next ore field or the direction of the players base.
(-) add 3 star level system for any combat unit (all units but harvesters). Every unit start at level 0. Whenever a unit (player or enemy ai) kills an opponent unit (not building) the unit gets in internal bounty counter increased by the cost of the killed unit. When that bounty counter is twice the value of the unit itself, the unit gets promoted to level 1. When the counter is at 4x the unit value it gets to level 2 and when the counter is at 6 times the unit value it gets to final level 3. To indicate the units level there are up to 3 yellow stars adding up from the center above the units health bar.
(-) add meaning to the level system so
    Level 1: means that units will use the aim ahead feature
    Level 2: means that units will use the dodge feature
    Level 3: means that units will repair themselves when not moving by 1% every 3 seconds.
(-) add guard mode for units that means if active (indicated by a green circle around the unit) the unit will not move from its location but attack any incoming enemy unit without following it. When guard mode is active and the unit is selected and the player clicks on a friendly unit the guarding unit will follow that unit and attack any incoming enemy in range without following the enemy but only following the unit to guard. Guard mode can be activated when a unit is selected and the g key is pressed.
(-) when the h key is toggled an overview pops up or closes showing all the key bindings (mouse and keyboard) with explanations.
(-) add a radar station building to the buildings options. Its size is 2x3 tiles. Its armor is 2 times that of a tank. When build the radar station enables the overview map. Before that map is just gray. It consumes 50 energy.
(-) add a unit repair builing to the buildings menu. It costs 3000$ and has 3 times the armor of a tank. Any unit can be directed to move there when selected and player clicks on the building. Then the unit will move to any surrounding tile and stays there. As long as the unit is close to the repair building it will get repaired (restore healthbar) gradually 2% every second.
(-) any building can be repaired by clicking the repair button in the side menu and then on a building. As soon as player click right click the repair mode is deselected again. Repairing x% of a building cost x * 0.3 of what it would have cost to build it again. Repairing a building restores the healthbar of that building. 
(-) add artillery unit with 100% more range than tank and a radius of 3 tiles damage area around the impact. The accuracy is only 25% of hitting the target tile directly but 100% of hitting any tile in the radius of 3 tiles around the targetted tile.
(-) add refinery building costing 2500$. Its size is 3x3 tiles. Its armor is same as for the base factory. Any harvester can be assigned to one specific refinery to unlaod only there by having a harvester selected an clicking then on the refinery. The refinery needs 30 energy.
(-) implement turretGunV1, turretGunV2 and turretGunV3 defense buildings by extending the existing dummy building with active defense features. Its projectiles are same as a each respective tank_v1, tank_v2 and tank_v3. It automatically attacks any enemy units in range but has 50% more range. turretGunV2 additionally has an aim ahead function so it is increasing the likelyhood of hitting moving targets.
(-) add tank_v3 to the build menu. tank_v3 can all what tank_v2 can do but add the aim ahead feature so it takes the speed and direction of a moving target into account when fireing at it to increase the likelyhood of a direct hit. It costs 3000$ and has 30% more health than tank_v3.
(-) make tank_v2 get 30% more health as tank_v1.
(-) rename tank to tank_v1 in code and to Tank V1 in the UI.
(-) when game ist restarted with the restart button there should NOT be a page reload but the game state should be resetted AND the statistics should be kept (win/loss)

Newly Closed Features:
(x) Make sure units in alert mode also attack enemy defense buildings automatically when in range!
(x) when a group is selected and F key is pressed make sure that group keeps its relative position (formation) in between each unit of the group. F key can be toggled to switch formation on and off. If it is on it is indicated by a green group number.
(x) when a unit is in a group show a little number (group number) 1-9 in the bottom left corner of the unit representing the group it belongs to.
(x) Make sure new units that have alert mode support start in alert mode but make sure units in alert mode only attack enemy units within range automatically!
(x) add unit lost sound
(x) For every playSound call add a 2nd argument that specifies the loudness. By default it is 1.0. Set the loudness to 0.5 for the explosion sound(s).
(x) ensure unit ready sound is used
(x) make sure the enemy also can build turretGuns (v1 to v3)  and power plants if energy is needed.
(x) make sure enemy defense turrets are actually attacking player units when in range
(x) show a small centered tile sized image (use the same as for the build buttons) of what the enemy is building in the base over the factory building of the enemy.
(x) make sure tanks can fire in the direction of enemy units by tanking the targets speed and direction into account so that they can also hit moving targets. This feature is called aimAheadFunction (AAF). Implement a feature flag for every tank and defense turret so if the flag is tured on they will use that feature. For now only set the flag to true for tank-v2 and turretGunV2. Make sure to put in a global calibration factor variable that I can use to tweek the AAF angle when it is not precise and tell me how to change it in browser console.
(x) add concrete wall to building options. The wall prevents any tank projectiles from crossing. It costs 100$ and has 2 times the armor of a tank. Its size is 1x1. Its tile color is darker thank rock grey. It does not cost energy.
(x) implement rocket tower defense building costing 4000$ and consuming 50 energy. Its armor is 2 times that of a tank. Its range is 50% higher than that of the a rocket tank. Its projectiles are same as a rocket tank. It automatically attacks any eney unit in range.
(x) ensure that when the energy is below 10% then unit an building production is slowed down by 66% and the overview map turns gray. When enegery lever rises again above 10% then effects get resotred.
(x) Show the energy production as a green bar in the sidebar below the overview map going from left to right. The bar starts with 100% green and 100% width of the sidebar. When The available energy is consumed by buildings by 50% it turns full yellow and when only 25% energy is left it turns full orange and when only 10% energy is left it turns 100% red. The bar has a label showing "energy produced" in numbers (centered). The color changes gradually depending on the given color keyframes.
(x) ensure that construction of one unit and one building can run in parallel
(x) ensure that buildings can only be build within a distance of 3 tiles close to the next existing building of yours. When it is too far away the footprint building overlay on the map turns red. That means that if one tile of the newly to build footprint is in range the entire building can be constructed.
(x) ensure that newly build buildings are not passable for player or enemy ai
(x) make sure that the initial factory is also taken into account for building range when new buildings are placed.
(x) Make sure that all buildings also have a health bar like the factory and can be attacked and destroyed and selected.
(x) the game starts in pause mode on startup or reload
(x) add health values to all buildings described in buildingData inside buildings.js. take the values from the readme.md file. Also make sure that in the building buttons in the sidebar the cost is only visible on hover over the button but not part of the label!
(x) ensure that when a build button in the building tab is clicked its production gets started. When the production is 100% the build button can be clicked again in the sidebar to go into buildings placement mode on the game map. Then the cursor when hovered over the game map shows a transparent layout of the building where it might be placed. When user then left clicks on a free place on the map (none of the tiles of the buildings foundation should be blocked by rocks, other buildings, water, units) then the building can be placed there. If there is a blocking tile the overlay turns from 50% transparend green to 50% transparent red on that tile. A finished construction can be aborted by right click on the buildings build button in the sidebar. The the player gets the money back.
(x) add power plant to the building options costing 2000$ and its size is 2x3 tiles. It provies 100 power to the base.
(x) add tabs for a new building menu to contain units and buildings build menu represented as tabs. When the buildings tab is clicked to become active the units build options get swapped by the buildings build options and vice versa. Make sure that the units build menu does not intersect with the buildings build menu tab! Under the new buildings build option add dummy build buttons for ore refinery, power plant, vehicle factory, radar station, turret gun v1, turret gun v2, turret gun v3, rocket turret, tesla coil, artillery turret, concrete wall. Make it so that the images get loaded as soon as I provide the assets into the "public/images" folder it will work, so you have to define the filenames already!
(x) make a shuffle map button in sidebar where a new map is randomly generated with organic lakes, rocks and streets. Make sure there is at least one street connecting both factories. When map is shuffled the game is also resetted. next to the shuffle button there should be a random seed input which is initially set to 1. The shuffle map button uses the seed.
(x) When units are selected the player can press ctrl+NUMBER key to assign a command group to the selected units. whenever the user presses that NUMBER again the group of units gets selected again.
(x) if player presses the I key an alert window shows the current controls with explanation and the game pauses
(x) if player presses H key the view is focussing the factory
(x) the base factory should be selectable by the player and when he clicks on a map location all new units will move to that spot.
(x) when the factory is selected there should also be a yellow outline to indicate the selection
(x) when the factory is selected and the user clicks on the map to set the production deploy target there should be a litte flag on a pole symbol on the map tile to indicate it
(x) make sure the factory can only be selected by clicking at it directly and not by dragging a selection box
(x) Add a rectangular body to the units so it is not just a circle so you can see where the tank is headed to when moving. Like with a real tank there should be a direction of the wagon pointing to where it moves to and the turret independently pointing to where it is aiming to. Make sure to introduce a rate of turn "ROT" so that is takes some time before a tank can move onto a tile at a different direction. So when the tank is attacking a target at another direction the turret turns and the wagon below also starts to turn. The wagon does not move before the rotation is finished pointing to the target.
(x) When user drags with right click on the minimap then the viewport should update in realtime.
(x) The camera should initially start at the a position so that the factory of the player is visible.
(x) Players units can be set to alert mode when they are selected and "A" key is pressed on keyboard. Then a red circle appears around the unit to indicate that state. If a unit is in alert mode it attacks every enemy unit automatically when in range but is not chasing it. This feature is exclusive to Tank V2 units.
(x) Tank-V2 is an upgraded tank that costs $1500, deals 20% more damage than a regular tank, and is the only unit capable of alert mode. In alert mode, the Tank-V2 fires at any enemy in range but won't chase them, respecting normal cooldown timers.
(x) when a unit was produced play one of the unitReady01 or unitReady02 or unitReady03 sounds randomly
(x) when a unit is selected play the yesSir01 sound

Open Bugs:
(-) enemy units come out of factory immediatly before the build indicator shows that the build is done
(-) players units can end up on not passable terrain I guess when in alert mode or sth else

Fixed Bugs:
(x) the yellow selection frame is not visible anymore when dragging a frame around a group of units to select it.
(x) Prevent playing the same sound multiple times at the exact same time. When some sound x is already running do not add it on top but just start that sound from the beginning.
(x) Harvesters are able to harvest the same tile simultaneously. That should not happen. The ore tile shall be blocked as soon as one harvester is at it.
(x) Units when dodging should not move differently than normal. They shoul just move to a random adjacent tile when an enemy projectile is approacing. Doding should not be faster than normal movement.
(x) when enemy base is destroyed the game still continues but it should end with a message on the screen showing the curren win/loss ratio of the player.
(x) The coloring of enemy unit types shall be the same as for players units. Only mark enemy units by giving them a red health bar
(x) The selection border when drag selection is performed by user is not visible anymore (regression). Please get it back!
(x) Make sure the music does not play on startup automatically.
(x) the enemy rocket tank should not have the same color as the harvester.
(x) the aiming of the tank-v2 is totally off. It should be able to hit moving target as long as they do not change their trajectory.
(x) the color of the tank-v2 seems to change. It shold always be white.
(x) Console warning: "findPath: destination tile not passable (units.js:101)"
(x) when I click on some build button twice there is a 3 shown in the batch count.
(x) Units when attacking should keep being close enough to target in order to be in range of attack but not too close so they get also hit by thier own bullets impact.