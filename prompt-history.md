# Prompt History

## 2025-11-19 - gpt-5-codex
Make the base frontier visible with an  orange overlay that is visible by default. Build the defence along that frontier. I hereby clarify that base does not just mean the initial factory building bit the entirety of all ai buildings.

## 2025-11-18 - gpt-5-codex
I still see the defense buildings inside the enemy base and not on the outside frontiers. Improve!

## 2025-11-17 - gpt-5-codex
Make sure enemy ai builds defence buildings at along the shortest route from its base to the players base according to the tanks pathfinding algo so the defence is concentrated there at intersection of the outer edges of the base and the path to the players base.

## 2025-11-15 - gpt-5-codex
ensure new units only spawn at unoccupied tiles (currently the vehicle factory spawns vehicles also inside itself so on tiles that are occupied by the factory itself). when a tile that is a spawn target is occupied just take any neighbour tile instead and if all neighbour tiles of that are also occupied take their neighbour tiles and so on...

## 2025-11-12 - gpt-5-codex
Ensure enemy Ai repairs damaged building but under the same cooldown rule after an attack like for the human player. Ensure to prioritize critical buildings first when money is low.

## 2025-11-11 - gpt-5-codex
Make scrolling on the minimal on mobile super smooth!

## 2025-11-13 - GitHub Copilot
align the recoil direction with the rotation of the barrel

## 2025-11-13 - GitHub Copilot
It is still not aligned: you need to rotate the barrel by 180 degrees now but make sure the barrels kick back effect is aligned accordingly as well

## 2025-11-10 - chatGPT
use public/images/map/units/tankV1_barrel.png also for the howitzer so that when the howitzer aims at a target the barrel is lifted to point into the air for a ballistic trajectory. The howitzer has no turret to turn for aiming so the entire wagon is turning into direction of the target (already implemented). Come up with a nice realistic looks transformation and animation so that the barrel will point into the same direction the grande will start to fly along as well. the mounting point on the gun barrel is 2x0y and the mounting point on the howitzer is 30x30y (based on the original image assets for the map). Ensure there is also a retreat and flash animation similar to the one of the tank and make it a bit stronger. The flash should go to both sides and not in all directions. Make sure the howitzer does not fire before it has lifted his gun barrel slowly at the target. Also ensure the howitzer does not start to drive before it has lowered its gun barrel to be parallel to ground level again. Lifting and lowering it can take up to 4s depending on how far away the target is.

## 2025-11-12 - gpt-5-codex
- Works correctly but make it about 2x faster scrolling and faster the more it is dragged to the edges bit ensure the center space does not trigger scrolling at all only the last 20px before the edges.

## 2025-11-11 - gpt-5-codex
- When in drag to build mode on mobile ensure the map scrolls slowly when dragging to the edges
