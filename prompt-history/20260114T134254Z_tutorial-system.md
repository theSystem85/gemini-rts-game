UTC Timestamp: 2026-01-14T13:42:54Z
LLM: codex

User prompt:
Build a tutorial system that explains to new users how to play the game, i.e. how the UI/UX works. Below are some required acceptance criteria, but you can and should also add additional steps that you consider useful if I forgot something:

1. The tutorial can be skipped (including every single step).
2. Everything is in English.
3. A tutorial cursor is visible (in addition to the real mouse cursor), so the user knows where to click. The user first sees how the tutorial system performs an action, and then has to replicate it before the tutorial proceeds to the next step. The tutorial distinguishes between mobile and desktop controls (it adapts to the device, i.e. touch controls vs. keyboard + mouse).
4. For example, it is shown that at the beginning you need to build a power plant, then an ore refinery, then a weapons factory, and then ore transporters in order to establish a stable income.
5. It is shown where energy and money are displayed in the UI.
6. It is explained that ore transporters automatically drive to the nearest ore field, but that they can also be directed manually to a specific one.
7. It is shown how to select units. The game is automatically played by the tutorial while using the real UX and HUD elements (automated), so everything looks and behaves like in the actual game. It is shown how to select single units as well as groups of units, and also how to deselect units again.
8. Then it is shown how to move selected units.
9. Then it is shown how to build a tank and how to set the waypoint for the weapons factory.
10. When the tank is finished, it is shown how to send it to a location on the map and alternatively how to control it manually (remote control mode).
11. Then it is shown how to attack targets with it and that the goal of the game is to destroy all enemy buildings.
12. Furthermore, it is shown which buildings must be constructed to unlock additional buildings until the entire tech tree is unlocked. In particular, the following buildings and units are explained in detail:
    12.1) Tanker and tank station
    12.2) Ambulance and hospital, as well as the crew system
    12.3) Ammunition factory and ammunition truck, as well as the ammunition system (where to see how much ammo a unit has left)
    12.4) Workshop and recovery tank (armored recovery vehicle).”
13) persist the state of the tutorial and if the tutorial shall be shown again in the localStorage of the browser. Put a "show tutorial" flag option in the settings menu.
14) Ensure the tutorial system can be easily expanded and that all steps are written as instructions on the screen but also read out aloud by the browsers speech api (this speech can be also disabled in settings but is enabled by default)
