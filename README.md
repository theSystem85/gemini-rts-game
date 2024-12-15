# gemini-rts-game

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/theSystem85/gemini-rts-game)

## Intro
this game is a test for gemini advanced on how to make a complex RTS game mostly from scratch to test the 1M token context window.

# Initial prompt
Here is the initial prompt that needs to be refined over and over again to get the best result for an initial generation of the code.

## Prompt
Develop a fully functional, minimal viable product (MVP) of a real-time strategy (RTS) game using HTML, CSS, and vanilla JavaScript. Ensure the game is implemented in one complete code block and works immediately without requiring additional setup. Follow these specifications closely:

1. General Setup
   1.1 Full-Screen Map
       1.1.1 Implement a full-screen map with scrollable tiles.

   1.2 Tiles
       1.2.1 Tile size: 32px by 32px.
       1.2.2 Tile types with respective colors:
             - Land: Brown => only tile that can have buildings on when user or computer builds them.
             - Water: Blue => tanks cannot move over water.
             - Rock: Gray => units can not move over rocks.
             - Street: Light gray => units on streets move 50% faster.
             - ore: golden =>
               - units can move over it
               - harvesters can remove it and get some money when they spend 10s time over it.
               - ore can spread to neighbour land tiles after 30s with a propability of 10%.
       1.2.3 Ensure subtle tile borders are visible for boundaries.
       1.2.4 Ensure water, rocks and streets are connected to each other and NOT totally randomly spread over the map.

   1.3 Map Scrolling
       1.3.1 Enable map scrolling with right-click and drag, restricted within map boundaries.

2. Structures
   2.1 Factory Building
       2.1.1 Size: Occupies a 3x2 tile area.
       2.1.2 Function: Produces tanks.
       2.1.3 Tank Production:
             - Triggered via a dropdown menu above the factory.
             - Takes a few seconds per tank, with a visible countdown timer.
             - Reduces player's money for each unit produced.
       2.1.4 Targeting: Can be attacked by enemy tanks.
       2.1.5 Harvester Production
        - color: violet
        - costs 5x as much as a tank
        - can charge the money of the player up 100$ when it spends 10s over an ore tile. ore tile then gets removed.
        - moves 50% slower than a tank
        - has 300% the armor of a tank

3. Units
   3.1 Tanks
       3.1.1 Movement
             - Move in real-time from tile to tile, controlled by the player.
             - units need some time to get from A to B depending on their current speed.
             - units need some time to accelerate to max speed and some time to stop before reacing their target tile.
             - Highlight the selected tank visually.
             - use A* path finding algorithm to get over blocked map areas to their targets
             - two units can not occupy the same tile at once (implement an occupancy map overlay that can be toggled on and off for debugging visibility by pressing the o key)
       3.1.2 Actions
             - Move: Command tanks to move to specific tiles with a visible highlight for the selected unit.
             - Shoot:
              - Attack enemy tanks or factories with visible targeting indicators.
              - range of tanks is 4 tiles for their bullets

       3.1.3 Health
             - Display a health bar above each tank and factory.
             - Implement destruction animations and sound effects when health reaches zero.
       3.1.4 Bullets
             - Render bullets in real-time with visible trajectories.
             - Bullets can damage opposing tanks and factories.
             - make sure bullets fly slowly enough the user can see them on the screen.

   3.2 Enemy Tanks
       3.2.1 Controlled by AI.
       3.2.2 Movement Logic: Follow simple AI behavior (e.g., random movement or pathfinding toward the player’s factory).
       3.2.3 Attack Logic: Prioritize attacking based on proximity to the player’s factory or units.

  3.3 Enemy Factory
    - ensure there is an initial enemy factory that produces tanks

4. Game Mechanics
   4.1 Economy
       4.1.1 Player's money increases over time and decreases with each unit production.
       4.1.2 Display available money as on-screen text.

   4.2 Victory Condition
       4.2.1 Player wins by destroying the enemy factory.

   4.3 Basic UI Elements
       4.3.1 Include Start, Pause and Restart buttons.
       4.3.2 Display basic stats such as wins/losses and game duration.

5. User Feedback and Visual Indicators
   5.1 Highlight selected tanks and structures.
   5.2 Show a marker for the target tile or enemy when chosen for movement or attack.
   5.3 Display a countdown timer for factory production.

6. Sound Effects
   6.1 Add sound effects for:
       - Unit selection.
       - Movement.
       - Shooting.
       - Destruction.

7. Debug/Developer Mode (Optional)
   7.1 Log actions and errors in the console for debugging and playtesting.
   7.2 On pressing h key show an alert window with all the control to command mappings (mouse and keyboard)

Important Notes:
1. Ensure all functionalities are encapsulated in one working code block WITHIN a single response!!
2. Include necessary styles, scripts, and assets inline to avoid external dependencies.
3. Prioritize simplicity and functionality over advanced optimizations or extensive features.
