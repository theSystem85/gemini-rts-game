# Gemini RTS Game

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/theSystem85/gemini-rts-game)

## Intro

This game is a test for me to work with frontier coding LLMs (mostly openAI and claude) on how to make a complex RTS game mostly from scratch without libraries to test the performance on a larger codebase while using prompting only (almost no handwritten code). Initially the project was just one HTML file but after a few iterations and more and more features built in the game needed to be refactored in multiple files to be maintainabble for an LLM because almost all LLMs did not work well with a file that had more than 1000 LOC. All assets in the game are also AI generated (Sound-Effects, Music, Images/Sprites).

### Setup
npm i
npm run dev

## Initial Prompt

Here is the initial prompt that needs to be refined over and over again to get the best result for an initial generation of the code.

### Prompt

Develop a fully functional, minimal viable product (MVP) of a real-time strategy (RTS) game using HTML, CSS, and vanilla JavaScript. Follow these specifications closely:

## 1. Intro

**1.1** Gemini RTS Game – a test project to build a complex RTS game from scratch using a 1M token context window.

## 2. General Setup

### 2.1 Full-Screen Map and Tile Grid

- **2.1.1** The game uses a full-screen map covering the entire browser window.
- **2.1.2** The map is divided into a grid of 32px by 32px tiles with subtle borders.
- **2.1.3** The grid must be generated and rendered with high performance.
- **2.1.4** Map scrolling: right-click and drag with inertia that decelerates smoothly and never exceeds map boundaries.
- **2.1.5** The initial viewport is set so that the player's base is always visible.

### 2.2 Tile Types and Features

#### 2.2.1 Supported tile types with colors:
- **2.2.1.1** Land – brown (e.g., `#A0522D`)
- **2.2.1.2** Water – blue (e.g., `#1E90FF`)
- **2.2.1.3** Rock – gray (e.g., `#808080`)
- **2.2.1.4** Street – light gray (e.g., `#D3D3D3`)
- **2.2.1.5** Ore – golden (e.g., `#FFD700`)

#### Additional Features:
- **2.2.2** Ore fields are passable.
- **2.2.3** Water, rock, and street features are arranged in connected patterns rather than randomly.
- **2.2.4** Carve an L-shaped corridor between the player and enemy factories so that water and rocks do not block the path.
- **2.2.5** The corridor uses street tiles that grant a 100% speed bonus.
- **2.2.6** Ore spreads to adjacent land tiles every 90 seconds with a probability factor of 0.06.
- **2.2.7** When generating the map randomly, include an ore growth mechanism with a spread interval of 90000 ms and a probability factor.
- **2.2.8** Ensure that at least one street always connects both bases.
- **2.2.9** Include a "Shuffle Map" button and a seed input field to generate reproducible maps.

## 3. Structures

### 3.1 Factory Buildings

- **3.1.1** Create two factories, each occupying a 3×2 tile area.
- **3.1.2** Factories are positioned at least 5 tiles away from map edges (for example, player at bottom left, enemy at top right).
- **3.1.3** Each factory has health and a visible health bar above it.
- **3.1.4** Factories are targetable and damageable by enemy units.
- **3.1.5** Factories produce units with a 3-second visible production timer that deducts money.
- **3.1.6** Tanks are produced whenever money is available and enough harvesters are alive to maintain a continuous income stream.
- **3.1.7** When a newly built unit's spawn area is blocked, use algorithm A1 (see section 7) to move the blocking unit to the closest free tile.
- **3.1.8** When a factory's health reaches 0, it is marked as destroyed and removed from the map.

## 4. Units

### 4.1 Tanks (Player and Enemy)

- **4.1.1** Movement uses A* pathfinding with diagonal support.
- **4.1.2** Tanks move at a speed of 0.5 tiles per second.
- **4.1.3** Movement includes smooth acceleration and deceleration.
- **4.1.4** Tanks cannot occupy the same tile; an occupancy check offsets units if necessary.
- **4.1.5** Tanks can be selected individually (click) or via multi-selection (drag bounding box).
- **4.1.6** When given move or attack orders, tanks compute a formation path, avoid overlaps, and stop within firing range.

#### 4.1.7 Mouse cursor changes:
- **4.1.7.1** Indicate if a target tile is blocked.
- **4.1.7.2** Indicate if an enemy unit or building is under the pointer (attack possible).
- **4.1.7.3** Indicate if the target is within firing range (no movement needed).

#### Additional Tank Features:
- **4.1.8** Each tank has a turret (a short line) pointing at its current target.
- **4.1.9** Tanks fire bullets with randomized damage scaling (0.8× to 1.2× base damage) requiring 3–5 hits to destroy a tank.
- **4.1.10** Friendly-fire prevention: Tanks do not fire at friendly units initially; firing only occurs when there is a clear line of sight to enemy targets.
- **4.1.11** Collision and stuck prevention: Before moving to the next tile, check if it is free; if occupied, move to a random nearby free tile using algorithm A1.
- **4.1.12** Additional bug fix: When tanks are in range of an enemy, they continue firing and can move if new orders are issued.

### 4.2 Harvesters

- **4.2.1** Harvesters are visually distinct (e.g., violet).
- **4.2.2** Harvesters move at 50% of the tank speed.
- **4.2.3** Harvesters have 300% the armor of tanks.
- **4.2.4** When on an ore tile, harvesters begin mining, which takes 10 seconds.
- **4.2.5** Harvesters have a capacity of 5 ore units with a progress bar shown below their health bar during mining; when full, the bar remains at 100% until unloading.
- **4.2.6** When full, harvesters automatically compute a path to any tile adjacent to the factory.
- **4.2.7** Upon unloading, add $1000 to the player's money and reset the harvester's ore load to 0.
- **4.2.8** After unloading, harvesters automatically move to the nearest ore field to resume mining.

### 4.3 Enemy Tanks

- **4.3.1** Enemy tanks are produced automatically at the enemy factory.
- **4.3.2** Production occurs when money is available and there are enough harvesters to sustain income.

#### 4.3.3 Enemy tanks are controlled by basic AI:
- **4.3.3.1** They move toward the player's factory and/or player units.
- **4.3.3.2** They scan for player units within a range (e.g., 10 tiles).
- **4.3.3.3** The AI prioritizes attacking harvesters first.
- **4.3.3.4** The AI prefers to defend its own harvesters over attacking the player's base.
- **4.3.3.5** Enemy units only begin attacking after the player launches their first attack.
- **4.3.3.6** They are assigned in small groups to attack the player's base.

- **4.3.4** Enemy tanks follow the same movement, targeting, and firing rules as player tanks.

## 5. Projectiles (Bullets)

### 5.1 Rendering and Speed

- **5.1.1** Bullets are rendered with visible trajectories so the player can track them.
- **5.1.2** Increase projectile speed by 3× compared to the base speed.
- **5.1.3** Bullets travel slowly enough to be visibly tracked.

### 5.2 Damage and Collision

- **5.2.1** Each bullet inflicts randomized damage (0.8× to 1.2× base damage).
- **5.2.2** A universal collision function checks for enemy units or factories within a 10-pixel threshold.
- **5.2.3** Bullets update positions every frame; if a collision is detected, damage is applied and the bullet is deactivated.
- **5.2.4** Check for zero distance to avoid division by zero errors.
- **5.2.5** If the target is already destroyed, mark the bullet as hit immediately.
- **5.2.6** Friendly-fire: Bullets skip collision checks with friendly units or factories.

## 6. User Interface & Controls

### 6.1 Sidebar and Minimap

- **6.1.1** Sidebar is located on the left and does not cover the main map.
- **6.1.2** The sidebar displays game statistics: money, game time, wins, losses.
- **6.1.3** It contains build options including a production dropdown for unit type (Tank, Rocket Tank, Harvester) and a production button with a visible countdown and progress percentage.
- **6.1.4** Production tiles are arranged in two columns with square tiles filling left to right; if more than 5 rows, a scrollbar appears.
- **6.1.5** Sidebar buttons must be styled beautifully and aligned.
- **6.1.6** The sidebar includes a "Shuffle Map" button and a seed input field for reproducible maps.
- **6.1.7** The minimap shows an overview of the entire game map with a bounding box indicating the current viewport.
- **6.1.8** Clicking on the minimap recenters the main view to the clicked location.

### 6.2 Map Scrolling

- **6.2.1** Right-click drag scrolling with inertia is implemented; inertia respects map boundaries.

### 6.3 Unit Selection and Orders

- **6.3.1** Single-unit selection via click and multi-unit selection via bounding box are supported.
- **6.3.2** If a selected unit is destroyed, it is automatically removed from the selection to avoid null references.
- **6.3.3** After selection, clicking on an empty tile issues a move command to all selected units.
- **6.3.4** Clicking on an enemy unit or building orders the selected units to move into range and fire.
- **6.3.5** The selection (bounding box drag) does not trigger movement commands by itself.
- **6.3.6** Mouse cursor changes indicate valid move or attack targets.

### 6.4 Start/Pause and Restart Controls

- **6.4.1** A toggle button is provided to start or pause the game.
- **6.4.2** A separate restart button is provided to reset the game.

### 6.5 Sound Effects

#### 6.5.1 Sound effects are implemented for:
- **6.5.1.1** Unit selection
- **6.5.1.2** Movement commands
- **6.5.1.3** Shooting and bullet firing
- **6.5.1.4** Bullet impact/hit
- **6.5.1.5** Unit and factory destruction
- **6.5.1.6** Harvesting ore
- **6.5.1.7** Unloading ore (deposit)
- **6.5.1.8** Production start and production ready

- **6.5.2** Each sound is triggered only once per event and does not affect game performance.

## 7. Game Mechanics

### 7.1 Economy

- **7.1.1** The player earns money only through specific actions (e.g., harvesting ore); there is no passive income.

### 7.2 Victory and Defeat Conditions

- **7.2.1** The player wins by destroying the enemy factory.
- **7.2.2** The player loses if their own factory is destroyed.
- **7.2.3** Wins and losses are displayed in the UI.

### 7.3 Production and Resource Management

- **7.3.1** Production timers, money deductions, and unit spawning must be reliable.
- **7.3.2** No new unit spawns into an occupied area; if blockage occurs, use algorithm A1 to move the blocking unit.

## 8. Error Prevention and Debugging

### 8.1 Algorithm A1 – Central Movement Logic

- **8.1.1** A1 is the single algorithm for moving a unit from point A to B.
- **8.1.2** When a unit must dodge a bullet (triggered by a new projectile), immediately use A1 to move it to a random free nearby tile.
- **8.1.3** When a unit is built at a factory and its spawn area is blocked, use A1 to move the blocking unit to the closest free tile.
- **8.1.4** A1 is used only when a new destination is set or when units collide with moving objects.
- **8.1.5** Always check that the tile the unit is about to move to is free; if not, choose a random nearby free tile before continuing toward the target.

### 8.2 Collision and Bullet Logic Safety

- **8.2.1** Verify that targets exist and distances are nonzero before calculations to avoid errors.
- **8.2.2** Use try/catch blocks in critical update functions to log errors and prevent game freezes.

### 8.3 Unit Targeting and Selection Safety

- **8.3.1** When a selected unit is destroyed, remove it immediately from the selection to prevent null reference errors.
- **8.3.2** Handle simultaneous shooting and movement events carefully to avoid crashes.

## 9. General Requirements

- **9.1** The game must be implemented in three separate files (HTML, CSS, JavaScript) with inline assets for immediate execution.
- **9.2** Clearly separate UI logic from game logic through comments and structure.
- **9.3** Provide detailed inline comments explaining each part of the logic, especially where previous errors occurred.
- **9.4** Prioritize simplicity and functionality over advanced optimizations.
- **9.5** Ensure that pathfinding (A1) and collision checks are efficient even with hundreds of units.

### Important Notes:
1. Include necessary styles, scripts, and assets inline to avoid external dependencies.
2. Prioritize simplicity and functionality over advanced optimizations or extensive features.

## Improvements

### Pending Issues:
- [ ] The game is lost for any player when he has no more buildings left. Make sure the game is not over only when the base construction building got destroyed!
- [x] Tanks movement speed should be 50% higher in general.
- [x] Rocket tank shall fire 3 projectiles instead of 1 but with lower damage each. The projectiles are currently way too fast and need to be at least 4x slower.
- [ ] The tesla coil should make little damage to the target.
- [x] Tank projectiles make too much damage.
- [ ] **REFACTOR:** move all constants into config.
- [ ] **Refactor:** updateGame.js is too big and needs to be modularized.
- [ ] **Refactor:** enemy.js is too big and needs to be modularized.
- [x] **Refactor:** Rendering.js is too big and needs to be modularized.

## Open Features

### To Be Implemented:
- [ ] When units are below 25% health they start to move with 50% of the speed of normal units.
- [ ] Show some progress when the harvester is unloading the ore at the refinery by gradually adding the money to the balance of the player (or AI) and show how the load indicator at the harvesters goes to zero.
- [ ] Make sure the money for the repair will not be removed on click when repair mode gets applied but gradually. Also make sure that the repairing of a building can be stopped again when clicked again while repair mode is active and unfinished on that building.
- [ ] Expand the sell buildings function so that also unit can be sold when they are in the repair workshop and fully repaired and the player clicks on them while in repair mode. When in repair mode and the user hovers over a unit that does not fulfill these conditions show the selling_blocked cursor instead of the sell cursor.
- [ ] Make a dedicated sound for attacking confirmation
- [ ] Refine the coloring of the power bar and its logic on impacting the production.
- [ ] Add 3 star level system for any combat unit (all units but harvesters). Every unit start at level 0. Whenever a unit (player or enemy ai) kills an opponent unit (not building) the unit gets in internal bounty counter increased by the cost of the killed unit. When that bounty counter is twice the value of the unit itself, the unit gets promoted to level 1. When the counter is at 4x the unit value it gets to level 2 and when the counter is at 6 times the unit value it gets to final level 3. To indicate the units level there are up to 3 yellow stars adding up from the center above the units health bar.
- [ ] Add meaning to the level system so:
  - **Level 1:** means that units will use the aim ahead feature
  - **Level 2:** means that units will use the dodge feature
  - **Level 3:** means that units will repair themselves when not moving by 1% every 3 seconds.
- [ ] Add guard mode for units that means if active (indicated by a green circle around the unit) the unit will not move from its location but attack any incoming enemy unit without following it. When guard mode is active and the unit is selected and the player clicks on a friendly unit the guarding unit will follow that unit and attack any incoming enemy in range without following the enemy but only following the unit to guard. Guard mode can be activated when a unit is selected and the g key is pressed.
- [ ] Add a unit repair building to the buildings menu. It costs 3000$ and has 3 times the armor of a tank. Any unit can be directed to move there when selected and player clicks on the building. Then the unit will move to any surrounding tile and stays there. As long as the unit is close to the repair building it will get repaired (restore healthbar) gradually 2% every second.
- [ ] Add artillery unit with 100% more range than tank and a radius of 3 tiles damage area around the impact. The accuracy is only 25% of hitting the target tile directly but 100% of hitting any tile in the radius of 3 tiles around the targetted tile.
- [x] Add refinery building costing 2500$. Its size is 3x3 tiles. Its armor is same as for the base factory. Any harvester can be assigned to one specific refinery to unload only there by having a harvester selected an clicking then on the refinery. The refinery needs 30 energy.
- [ ] Add tank_v3 to the build menu. tank_v3 can all what tank_v2 can do but add the aim ahead feature so it takes the speed and direction of a moving target into account when fireing at it to increase the likelyhood of a direct hit. It costs 3000$ and has 30% more health than tank_v3.
- [ ] Make tank_v2 get 30% more health as tank_v1.
- [ ] Rename tank to tank_v1 in code and to Tank V1 in the UI.
- [x] When player builds the radar station it enables the overview mini map. Before that map is just gray. It consumes 50 energy. When it get destroyed and no other radar station is in the players building list the mini map gets disabled again.
- [x] Make sure the bullets from tanks and turrets fire at an exact location on the map and explode there rather than fly over the entire map.

### Completed Features:
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
- [x] For any vehicle to be build a vehicle factory is required. Make sure the build options in the sidebar are disabled until the factory is built. Disabled sidebar buttons are grayed out (just add 50% transparency). The more vehicle factories are build the faster the vehicle production gets. If production speed with one factory is 1x it is 2x with two factories and so on.
- [x] For harvesters to be build it is required to have a refinery and a vehicle factory.
- [x] Harvesters can only bring the ore the the refinery not to the construction yard anymore. At the refinery it takes the harvester 20s to unload the ore before it can go again to harvest automatically. At each refinery there can only be on harvester at the time being unloaded all othery have to wait for it.

## Bugs

### Current Issues:
- [ ] When power below 0 make sure the production speed of buildings and units is only at 33%.
- [x] The initial construction yard building is not respected in the occupancy map.
- [x] When tank_v1 is produced it leaves the factory in different (random?) colors. Tank_v1 should always be blue.
- [x] Enemy units do not defend their harvesters when being attacked.
- [ ] When selling a building the occupancy map is not updated and still blocked there.
- [x] Sometimes the loading indicator of a harvester goes black again even when fully loaded and the yellow bar was visible before. Ensure the loading state is always visible.
- [ ] When refinery is destroyed the harvesters can still got to building factory to unload ore but they should only do it at the refinery.
- [ ] The initial power level shows 100 but in fact it is just 0. Make sure it actually is 100.
- [ ] Repairing a building takes no time. Make sure it takes 50% of the time it took to build it to restore 100% of the healthbar. also make sure the cursor turns into a wrench svg icon (path cursors/wrench.svg) when repair mode is on and mouse hovers over a building that can be repaired.
- [ ] Image for the concrete wall on map is incorrect.
- [x] There are colored bars on the edges of some buildings who's map images do not fit exactly into the tile map grid. Those bars should be removed. Make sure when the image to place on the map does not fit into the grid that the map tiles from before are still visible in the background.
- [ ] Enemy units come out of factory immediately before the build indicator shows that the build is done

### Fixed Issues:
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
