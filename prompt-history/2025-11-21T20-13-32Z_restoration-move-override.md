2025-11-21T20-13-32Z
Model: GPT-5.1-Codex-Max

Prompt:
check if this is still an issue (was from an older code review) and if yes then fix it!

Problem
The restorationMoveOverride flag intended to let restored, crewless units move to their rally point never turns off if the unit receives a different move order before reaching that rally tile. This allows units with zero gas and no crew to drive freely anywhere.

Root Cause:

restorationMoveTarget is set once during unit restoration and never updated when moveTarget changes
When checking if target is reached, the code always uses unit.restorationMoveTarget || unit.moveTarget
After a player issues a new command, the path to the new target can complete, but reachedTarget still checks distance to the old rally point
Since the unit never reaches the stale rally point, restorationMoveOverride remains true forever
Solution
Clear both restorationMoveOverride and restorationMoveTarget whenever new movement orders are issued to ensure the override only applies to the initial rally point movement.
