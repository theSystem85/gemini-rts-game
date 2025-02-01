Build me an RTS game with these Criteria: GENERAL SETUP
1.1. Full-Screen Map and Tile Grid
1.1.1. The game must use a full-screen map that covers the entire browser window.
1.1.2. The map is divided into a grid of 32px by 32px tiles.
1.1.3. Tiles must have subtle borders to clearly indicate boundaries between them.
1.1.4. Ensure that the grid is generated and rendered without performance issues.

1.2. Tile Types and Features
1.2.1. The following tile types must be supported, each with a specific color:
1.2.1.1. Land – brown (e.g., #A0522D).
1.2.1.2. Water – blue (e.g., #1E90FF).
1.2.1.3. Rock – gray (e.g., #808080).
1.2.1.4. Street – light gray (e.g., #D3D3D3).
1.2.1.5. Ore – golden (e.g., #FFD700).
1.2.2. Ore fields must not obstruct unit movement (i.e., they are passable).
1.2.3. Water, rock, and street features should be placed in connected patterns rather than randomly.
1.2.4. Carve an L-shaped corridor between the player and enemy factories so that water and rocks do not block the path between bases.
1.2.5. Ore should have a growth/spread mechanism to adjacent land tiles; set the spread interval to be three times slower than the original (e.g., 90000 ms) and include a probability factor.

1.3. Map Scrolling and Inertia
1.3.1. The map must be scrollable using right-click and drag, with movement restricted within the map boundaries.
1.3.2. Implement scrolling inertia so that when the user stops dragging, the map continues to move briefly and then decelerates smoothly.
1.3.3. Ensure that the inertia calculations do not allow the scrollOffset to exceed map boundaries.

1.4. Sidebar and Minimap
1.4.1. Include a left sidebar that does not cover the main map area.
1.4.2. The sidebar must display game statistics (money, game time, wins, losses) and build options (unit production dropdown and button).
1.4.3. Place a minimap at the top of the sidebar that shows an overview of the entire game map.
1.4.4. The minimap must display a bounding box that represents the current viewport of the main map.
1.4.5. The minimap should be clickable: clicking on a location on the minimap must instantly recenter the main view to that location.

STRUCTURES
2.1. Factory Buildings
2.1.1. Create two factory buildings (one for the player and one for the enemy) that occupy a 3×2 tile area.
2.1.2. Position the player factory at a designated location (e.g., bottom left) and the enemy factory at a different location (e.g., top right).
2.1.3. Each factory must have health and display a health bar above it.
2.1.4. Factories must be able to produce units; include a production timer/countdown that is visible.
2.1.5. When production is triggered via a dropdown and a button, the factory should deduct the appropriate amount of money and spawn the unit after the countdown finishes.
2.1.6. Factories must be targetable and damageable by enemy units without causing UI or game logic freezes.

UNITS
3.1. Tanks
3.1.1. Player and enemy tanks must move in real time along the tile grid using A* pathfinding to navigate around obstacles.
3.1.2. Tanks must be able to accelerate and decelerate as they move between tiles (or at least show smooth movement).
3.1.3. Tanks cannot occupy the same tile simultaneously; implement an occupancy check.
3.1.4. Tanks should be selectable (single selection and multi-selection via bounding box) and visibly highlighted when selected.
3.1.5. Tanks must be ordered to move to a specific target tile; if the target is an enemy unit or building, they must approach within range and fire.
3.1.6. Increase tank movement speed by 100% (i.e., double the base speed compared to the original version).
3.1.7. Tanks must fire bullets when enemy targets are within range; if multiple bullets are required (e.g., 3–5 hits) to destroy a tank, implement randomized damage scaling (e.g., between 0.8× and 1.2× of a base damage value).
3.1.8. Prevent tanks from getting stuck when in range of an enemy; ensure they continue to fire and can also move if new commands are issued.
3.1.9. Implement safe targeting so that if a selected tank is destroyed, it is removed from the selection to prevent null reference errors.
3.1.10. Address any potential crashes when tanks are in close proximity by carefully handling simultaneous shooting and movement events.

3.2. Harvesters
3.2.1. Harvesters are produced by factories and should be visually distinct (e.g., colored violet).
3.2.2. Harvesters must move 50% slower than tanks.
3.2.3. Harvesters must have 300% the armor of tanks.
3.2.4. Harvesters can harvest ore from ore fields by staying on an ore tile for a specified duration (e.g., 10 seconds).
3.2.5. Harvesters have a capacity to hold 5 ore units; once full, they must return to the player factory to unload.
3.2.6. Upon unloading at the factory, the player should receive $500, and the harvester’s ore capacity resets.
3.2.7. Ensure that harvester unloading and ore harvesting are reliably implemented without UI glitches.

3.3. Enemy Tanks
3.3.1. Enemy tanks are controlled by a basic AI that moves them toward the player’s factory and/or player units.
3.3.2. Enemy tanks must follow the same movement, targeting, and firing rules as player tanks (including randomized damage and multiple-hit destruction).
3.3.3. Ensure that enemy tanks take damage correctly and do not cause crashes when in proximity to player tanks.

BULLETS
4.1. Bullets must be rendered with visible trajectories that allow the player to track their movement across the screen.
4.2. Bullets should travel slowly enough to be visibly tracked by the player.
4.3. Each bullet inflicts randomized damage (e.g., base damage multiplied by a factor between 0.8 and 1.2) so that multiple hits are required to destroy a tank.
4.4. Implement safe bullet update logic: check for zero distance (to avoid division by zero) and ensure that if a target is already destroyed, the bullet is marked as hit to avoid crashes.

USER INTERFACE & CONTROLS
5.1. Unit Selection
5.1.1. Single-unit selection: Clicking on a player unit should select and highlight it.
5.1.2. Multi-unit selection: The player must be able to drag a bounding box to select multiple units at once.
5.1.3. Ensure that if a selected unit is destroyed, it is automatically removed from the selection to prevent null references.
5.2. Move and Attack Orders
5.2.1. After selection (single or multiple), clicking on an empty tile issues a move command to all selected units.
5.2.2. Clicking on an enemy unit or building should order the selected tanks to move into range and begin firing at the target.
5.2.3. Ensure that units follow the move orders without getting stuck or causing crashes when approaching enemy targets.
5.3. Minimap Functionality
5.3.1. The minimap must display an overview of the entire game map.
5.3.2. The current viewport (bounding box) must be drawn on the minimap.
5.3.3. Clicking on the minimap should instantly center the main view to the clicked location.
5.4. Map Scrolling and Inertia
5.4.1. Implement right-click drag scrolling with inertia: when the user stops dragging, the map should continue moving briefly and then decelerate.
5.4.2. Ensure that the inertia effect respects map boundaries.
5.5. UI Buttons and Production Controls
5.5.1. Provide UI buttons for Start, Pause, and Restart that are fully responsive.
5.5.2. Include a dropdown for selecting the unit type to produce (tank or harvester) and a Produce button that initiates production.
5.5.3. Production must deduct the correct amount of money and show a visible countdown timer for unit production.
5.6. Sound Effects
5.6.1. Implement sound effects for the following events:
5.6.1.1. Unit selection.
5.6.1.2. Movement commands.
5.6.1.3. Shooting and bullet firing.
5.6.1.4. Bullet impact/hit.
5.6.1.5. Unit and factory destruction.
5.6.1.6. Harvesting ore.
5.6.1.7. Unloading ore (deposit).
5.6.2. Ensure that sounds are triggered only once per event and do not interfere with game performance.

GAME MECHANICS
6.1. Economy
6.1.1. The player should not receive passive income for doing nothing; money is earned only through specific actions (e.g., harvesting ore).
6.2. Victory and Defeat Conditions
6.2.1. The player wins by destroying the enemy factory.
6.2.2. The player loses if their own factory is destroyed.
6.2.3. Wins and losses must be displayed on the UI.
6.3. Production and Resource Management
6.3.1. Production timers, money deductions, and unit spawning must be reliably implemented to avoid UI or game logic errors.

ERROR PREVENTION AND DEBUGGING INSTRUCTIONS
7.1. Bullet Update Logic
7.1.1. Always check that the target exists and that the distance is not zero before performing division to prevent division by zero errors.
7.1.2. If a target is already destroyed, mark the bullet as hit immediately to avoid processing it further.
7.2. Unit Targeting and Selection
7.2.1. In the targeting logic, verify that the target is not null and that its health property is valid before accessing it.
7.2.2. When a selected unit is destroyed, ensure it is automatically removed from the selection list to prevent null reference errors.
7.3. A* Pathfinding
7.3.1. Ensure that if no valid path is found, the unit does not receive an empty or invalid path that could cause infinite loops.
7.4. Map Scrolling
7.4.1. Validate that inertia calculations never allow the scroll offset to exceed the map boundaries.
7.5. Multi-Unit Selection
7.5.1. Clearly define the conversion from screen coordinates to world coordinates when determining which units fall within the selection box.
7.6. Timers and Cooldowns
7.6.1. Ensure that production timers, harvest timers, and shooting cooldowns are correctly updated and reset to avoid unintended behavior.
7.7. Preventing Crashes During Combat
7.7.1. When tanks are in range of each other, ensure that the simultaneous shooting and movement logic is carefully handled to prevent the game from crashing.
7.7.2. Include error handling (try/catch blocks) in critical update functions to log and bypass errors without freezing the game.

GENERAL REQUIREMENTS
8.1. The entire game (HTML, CSS, JavaScript) must be implemented in one complete code block with inline assets so that it works immediately without additional setup.
8.2. Prioritize simplicity and functionality over advanced optimizations.
8.3. Clearly separate UI logic from game logic in the code (through comments and structure) to ease future debugging.
8.4. Provide detailed inline comments (in the final code) to explain each part of the logic, especially where previous errors occurred.