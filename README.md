# gemini-rts-game

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/theSystem85/gemini-rts-game)

## Intro
this game is a test for gemini advanced on how to make a complex RTS game mostly from scratch to test the 1M token context window.

# Initial prompt
Here is the initial prompt that needs to be refined over and over again to get the best result for an initial generation of the code.

## Prompt
Develop a fully functional, minimal viable product (MVP) of a real-time strategy (RTS) game using HTML, CSS, and vanilla JavaScript. Follow these specifications closely:
GENERAL SETUP:
 1.1 The game uses a full-screen map covering the entire browser window.
 1.2 The map is divided into a grid of 32px by 32px tiles.
 1.3 Tiles have subtle borders to clearly indicate boundaries.
 1.4 The grid is generated and rendered with high performance.

TILE TYPES AND FEATURES:
 2.1 Supported tile types include:
  2.1.1 Land (brown, e.g., #A0522D)
  2.1.2 Water (blue, e.g., #1E90FF)
  2.1.3 Rock (gray, e.g., #808080)
  2.1.4 Street (light gray, e.g., #D3D3D3)
  2.1.5 Ore (golden, e.g., #FFD700)
 2.2 Ore fields are passable.
 2.3 Water, rock, and street features are arranged in connected patterns.
 2.4 An L-shaped corridor is carved between the player and enemy factories; this corridor is replaced with street tiles that grant a 100% speed bonus.
 2.5 Ore spreads to adjacent land tiles every 90 seconds with a probability factor of 0.06.

FACTORIES:
 3.1 Two factory buildings are created—one for the player and one for the enemy—each occupying a 3×2 tile area.
 3.2 Factories are positioned at least 5 tiles away from the map edges.
 3.3 Each factory has health and displays a visible health bar above it; the enemy factory also displays its current budget.
 3.4 Factories produce units using a 3-second production timer (with a visible progress percentage) and deduct money accordingly.
 3.5 Factory tiles are marked as "building" to block unit movement.
 3.6 When a factory’s health reaches 0, it is marked as destroyed and then removed from the map.

UNITS:
 4.1 Unit Types and Costs:
  4.1.1 Normal Tanks cost $1000.
  4.1.2 Rocket Tanks cost $2000.
  4.1.3 Harvesters cost $500.
 4.2 Tanks and Rocket Tanks:
  4.2.1 Both use A* pathfinding with diagonal movement.
  4.2.2 Rocket Tanks have double the firing range of normal Tanks.
  4.2.3 Normal Tanks fire ballistic projectiles with a fixed trajectory.
  4.2.4 Rocket Tanks fire homing projectiles that seek their target.
 4.3 Harvesters:
  4.3.1 Harvesters move at 50% of tank speed.
  4.3.2 They have 300% the armor of tanks.
  4.3.3 Harvesters begin mining when on an ore tile; mining takes 10 seconds, and the ore is then removed from the map.
  4.3.4 Harvesters have a capacity of 5 ore units.
  4.3.5 A progress bar is displayed below the harvester’s health bar during mining; if the harvester reaches capacity, the progress bar remains at 100% until unloading.
  4.3.6 Once full, the harvester automatically sets its path to unload by moving to any tile adjacent to the factory (base).
  4.3.7 Unloading occurs as soon as the harvester reaches a tile adjacent to the factory; upon unloading, $1000 is added to the player’s money, the harvester’s ore resets to 0, and it automatically computes a path to the nearest ore field to resume harvesting.
 4.4 Unit Movement and Selection:
  4.4.1 Units move smoothly with gradual acceleration/deceleration.
  4.4.2 An occupancy map prevents multiple units from occupying the same tile; if they do, they are slightly offset.
  4.4.3 Units can be selected individually by clicking or via multi-selection with a bounding box.
  4.4.4 When given move or attack commands, tanks compute a formation path to avoid overlapping and stop when within firing range.

ENEMY UNITS AND AI:
 5.1 Enemy tanks spawn one at a time every 10 seconds from the enemy factory.
 5.2 Enemy tanks follow the same movement and firing rules as player tanks.
 5.3 Enemy tanks scan for any player unit within 10 tiles; if found, that unit becomes the target; otherwise, the enemy base is targeted.
 5.4 When attacked, enemy tanks counterattack by targeting the attacking player unit and eventually move to attack the player’s base.

PROJECTILES:
 6.1 All projectiles are rendered visibly and travel at a speed of 3.
 6.2 Normal tank projectiles are ballistic and follow a fixed trajectory calculated at firing time.
 6.3 Rocket tank projectiles are homing and actively seek their target.
 6.4 Normal tanks fire with a range equal to TANK_FIRE_RANGE (in tiles); Rocket Tanks fire with double that range.
 6.5 After each frame, all projectiles update their positions and then check for collisions.
 6.6 A universal collision function checks if any enemy unit or factory comes within a 10-pixel threshold of the projectile.
 6.7 If a collision is detected, the projectile deals randomized damage (between 0.8× and 1.2× base damage) and is then deactivated.
 6.8 Projectiles that leave the map boundaries are deactivated.
 6.9 Friendly-fire is prevented by skipping collision checks for any unit or factory that shares the same owner as the shooter.

PATHFINDING:
 7.1 The A* algorithm supports diagonal movement.
 7.2 Movement cost on street tiles is halved (multiplier 0.5) to favor the fastest route (using roads) over the shortest route.
 7.3 If no valid path is found, the unit remains stationary.

USER INTERFACE & CONTROLS:
 8.1 A left sidebar (in dark mode) displays a minimap, game statistics (money, time, wins, losses), and production controls.
 8.2 The production dropdown allows selection between Tank, Rocket Tank, and Harvester.
 8.3 The produce button initiates unit production with a 3-second countdown and a visible progress percentage.
 8.4 Right-click dragging scrolls the map with inertia.
 8.5 The minimap shows an overview of the map with a viewport rectangle representing the current view; clicking the minimap recenters the main view.
 8.6 The game auto-starts upon page load.

ERROR PREVENTION & DEBUGGING:
 9.1 All update functions include error handling to prevent crashes.
 9.2 A single global AudioContext is created and reused for all sound effects.
 9.3 Destroyed units and factories are removed from the game to prevent collisions and incorrect targeting.
 9.4 The A* algorithm prevents units from entering impassable tiles (water, rock, building).
 9.5 Projectiles check for collisions with enemy units and factories while ignoring friendly targets.

PROJECTILE AND COLLISION BEHAVIOR:
 10.1 All bullets update their position every frame.
 10.2 After moving, bullets use a universal collision function to detect if any enemy unit or factory comes within a 10-pixel threshold.
 10.3 If a collision is detected, randomized damage (0.8×–1.2× base damage) is applied and the bullet is deactivated.
 10.4 The collision check skips any target that shares the same owner as the shooter, ensuring no friendly-fire.

ENEMY BASE AND FACTORY:
 11.1 Enemy factories (bases) can be damaged by player projectiles.
 11.2 When an enemy factory’s health reaches 0, it is marked as destroyed and removed from the map.

FRIENDLY FIRE PREVENTION:
 12.1 Projectiles from any tank do not hit any friendly unit or factory (they skip collision checks with targets that share the shooter’s owner).

UNIT STUCK PREVENTION:
 13.1 After movement updates, if multiple units share the same tile, they are slightly offset to prevent them from becoming stuck in one location.

ENEMY AI BEHAVIOR:
 14.1 Enemy tanks continuously scan for any player unit within 10 tiles and, if one is found, target it to initiate a counterattack.
 14.2 If no player unit is within range, enemy tanks target the player’s base.

HARVESTER UNLOADING AND AUTO-RETURN:
 15.1 When a harvester’s ore capacity reaches 5, it automatically sets its path to an unload target (any tile adjacent to the factory).
 15.2 Unloading occurs as soon as the harvester reaches any tile adjacent to the factory; at that moment, $1000 is added to the player’s money and the harvester’s ore load resets to 0.
 15.3 After unloading, the harvester automatically computes a path to the nearest ore field and resumes harvesting.
 15.4 The harvester’s loading progress bar remains visible at 100% until unloading occurs.

ADDITIONAL COLLISION RESOLUTION:
 16.1 If a projectile passes near any enemy unit or factory (within 10 pixels), the collision is detected, damage is applied, and the projectile is deactivated.

PROJECTILE RANGE AND FRIENDLY FIRE:
 17.1 Rocket Tanks have double the firing range of normal Tanks.
 17.2 All projectile collision checks skip any target that shares the same owner as the shooter.

GENERAL GAME STATE:
 18.1 The game auto-starts upon page load.
 18.2 Destroyed units and factories are removed from the game.
 18.3 A global AudioContext is used for all sound effects.

UPDATED PATHFINDING AND FAST ROUTE SELECTION:
 19.1 The A* algorithm applies a 0.5 cost multiplier for street tiles so that roads are preferred as the fastest route rather than just the shortest.
 19.2 If no valid path is found, the unit remains stationary.

PROJECTILE COLLISION ENHANCEMENTS:
 20.1 After updating its position, each projectile checks for collisions with any enemy unit or factory along its path.
 20.2 If any enemy target comes within 10 pixels, the projectile registers a hit and deals randomized damage before being deactivated.
 20.3 Projectiles ignore any targets that are friendly (sharing the same owner as the shooter).

ENEMY AI ADDITIONAL BEHAVIOR:
 21.1 Enemy tanks now hunt player units when attacked and counterattack accordingly.
 21.2 If no player unit is within range, enemy tanks target the player’s base.

Important Notes:
1. Include necessary styles, scripts, and assets inline to avoid external dependencies.
3. Prioritize simplicity and functionality over advanced optimizations or extensive features.
