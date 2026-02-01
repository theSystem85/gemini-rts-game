# 2026-02-01T13-18-15Z
LLM: GitHub Copilot (GPT-5.2-Codex)

Prompt:
fix these failing unit tests while keeping them useful:

 FAIL  tests/unit/buildingSystem.test.js > Building System > game/buildingSystem update logic > fires turret projectiles when aligned with a target in range
Error: [vitest] No "hasLineOfSightToTarget" export is defined on the "../../src/logic.js" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("../../src/logic.js"), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // your mocked methods
  }
})

 ❯ hasClearLineOfSight src/game/buildingSystem.js:365:35
    363|         const mapGrid = Array.isArray(gameState.mapGrid) ? gameState.mapGrid : []
    364|         const hasClearLineOfSight = target => (
    365|           mapGrid.length === 0 || hasLineOfSightToTarget({ x: centerX, y: centerY }, target, mapGrid)
       |                                   ^
    366|         )
    367| 
 ❯ src/game/buildingSystem.js:402:20
 ❯ updateDefensiveBuildings src/game/buildingSystem.js:193:13
 ❯ Module.updateBuildings src/game/buildingSystem.js:175:5
 ❯ tests/unit/buildingSystem.test.js:822:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  tests/unit/buildingSystem.test.js > Building System > game/buildingSystem update logic > fires artillery turret projectiles using stored target positions
Error: [vitest] No "hasLineOfSightToTarget" export is defined on the "../../src/logic.js" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("../../src/logic.js"), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // your mocked methods
  }
})

 ❯ hasClearLineOfSight src/game/buildingSystem.js:365:35
    363|         const mapGrid = Array.isArray(gameState.mapGrid) ? gameState.mapGrid : []
    364|         const hasClearLineOfSight = target => (
    365|           mapGrid.length === 0 || hasLineOfSightToTarget({ x: centerX, y: centerY }, target, mapGrid)
       |                                   ^
    366|         )
    367| 
 ❯ src/game/buildingSystem.js:402:20
 ❯ updateDefensiveBuildings src/game/buildingSystem.js:193:13
 ❯ Module.updateBuildings src/game/buildingSystem.js:175:5
 ❯ tests/unit/buildingSystem.test.js:858:7
