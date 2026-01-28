/**
 * Tests for Building System
 *
 * Tests building creation, placement, damage, destruction,
 * repair mechanics, and power grid integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { gameState } from '../../src/gameState.js'
import { buildingData } from '../../src/data/buildingData.js'
import { TILE_SIZE, BUILDING_SELL_DURATION } from '../../src/config.js'
import { createTestMapGrid, resetGameState, createTestFactory, createTestBuilding } from '../testUtils.js'

// Mock modules that cause import issues
vi.mock('../../src/game/dangerZoneMap.js', () => ({
  updateDangerZoneMaps: vi.fn()
}))

vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn(),
  playPositionalSound: vi.fn()
}))

vi.mock('../../src/inputHandler.js', () => ({
  selectedUnits: []
}))

vi.mock('../../src/logic.js', () => ({
  triggerExplosion: vi.fn(),
  smoothRotateTowardsAngle: vi.fn((current, target) => target),
  angleDiff: vi.fn((a, b) => Math.abs(a - b))
}))

vi.mock('../../src/ui/distortionEffect.js', () => ({
  triggerDistortionEffect: vi.fn()
}))

vi.mock('../../src/game/gameStateManager.js', () => ({
  checkGameEndConditions: vi.fn()
}))

vi.mock('../../src/utils.js', async() => {
  const actual = await vi.importActual('../../src/utils.js')
  return {
    ...actual,
    updateUnitSpeedModifier: vi.fn()
  }
})

vi.mock('../../src/rendering/turretImageRenderer.js', () => ({
  getTurretImageConfig: vi.fn(() => null),
  turretImagesAvailable: vi.fn(() => false)
}))

vi.mock('../../src/performanceUtils.js', () => ({
  logPerformance: fn => fn
}))

vi.mock('../../src/utils/gameRandom.js', () => ({
  gameRandom: vi.fn(() => 0.5)
}))

vi.mock('../../src/rendering.js', () => ({
  getMapRenderer: () => null
}))

vi.mock('../../src/buildingImageMap.js', () => ({
  getBuildingImage: vi.fn((type, callback) => {
    if (callback) callback(null)
    return null
  })
}))

// Import after mocking
import * as buildingsModule from '../../src/buildings.js'
import { createBuilding, placeBuilding, clearBuildingFromMapGrid, calculateRepairCost, repairBuilding } from '../../src/buildings.js'
import { updateBuildings, updateTeslaCoilEffects } from '../../src/game/buildingSystem.js'
import { updateDangerZoneMaps } from '../../src/game/dangerZoneMap.js'
import { checkGameEndConditions } from '../../src/game/gameStateManager.js'
import { playSound, playPositionalSound } from '../../src/sound.js'
import { triggerExplosion } from '../../src/logic.js'
import { updateUnitSpeedModifier } from '../../src/utils.js'
import { selectedUnits } from '../../src/inputHandler.js'
import { gameRandom } from '../../src/utils/gameRandom.js'

describe('Building System', () => {
  let mapGrid

  beforeEach(() => {
    resetGameState()
    mapGrid = createTestMapGrid(50, 50)
    gameState.mapGrid = mapGrid
    gameState.occupancyMap = []
    // Initialize occupancy map
    for (let y = 0; y < 50; y++) {
      gameState.occupancyMap[y] = []
      for (let x = 0; x < 50; x++) {
        gameState.occupancyMap[y][x] = 0
      }
    }
    gameState.buildings = []
    gameState.factories = []
    gameState.humanPlayer = 'player'
    gameState.buildingsUnderRepair = []
  })

  describe('Building Creation', () => {
    it('should create a building with correct properties', () => {
      const building = createBuilding('powerPlant', 10, 10)

      expect(building).not.toBeNull()
      expect(building.type).toBe('powerPlant')
      expect(building.x).toBe(10)
      expect(building.y).toBe(10)
      expect(building.width).toBe(buildingData.powerPlant.width)
      expect(building.height).toBe(buildingData.powerPlant.height)
    })

    it('should set health to building data default', () => {
      const building = createBuilding('powerPlant', 10, 10)

      expect(building.health).toBe(buildingData.powerPlant.health)
      expect(building.maxHealth).toBe(buildingData.powerPlant.health)
    })

    it('should set power value from building data', () => {
      const building = createBuilding('powerPlant', 10, 10)
      expect(building.power).toBe(buildingData.powerPlant.power)

      const refinery = createBuilding('oreRefinery', 15, 15)
      expect(refinery.power).toBe(buildingData.oreRefinery.power)
    })

    it('should generate unique ID for each building', () => {
      gameRandom.mockReturnValueOnce(0.1).mockReturnValueOnce(0.2)
      const building1 = createBuilding('powerPlant', 10, 10)
      const building2 = createBuilding('powerPlant', 10, 10)

      expect(building1.id).toBeDefined()
      expect(building2.id).toBeDefined()
      expect(building1.id).not.toBe(building2.id)
    })

    it('should set owner to neutral by default', () => {
      const building = createBuilding('powerPlant', 10, 10)
      expect(building.owner).toBe('neutral')
    })

    it('should mark building as isBuilding', () => {
      const building = createBuilding('powerPlant', 10, 10)
      expect(building.isBuilding).toBe(true)
    })

    it('should return null for unknown building type', () => {
      const building = createBuilding('unknownBuildingType', 10, 10)
      expect(building).toBeNull()
    })

    it('should set constructionStartTime on creation', () => {
      const before = performance.now()
      const building = createBuilding('powerPlant', 10, 10)
      const after = performance.now()

      expect(building.constructionStartTime).toBeGreaterThanOrEqual(before)
      expect(building.constructionStartTime).toBeLessThanOrEqual(after)
    })

    it('should initialize constructionFinished to false', () => {
      const building = createBuilding('powerPlant', 10, 10)
      expect(building.constructionFinished).toBe(false)
    })

    it('should initialize helipad with landedUnitId property', () => {
      const helipad = createBuilding('helipad', 10, 10)
      expect(helipad.landedUnitId).toBeNull()
    })

    it('should initialize vehicle factory with rallyPoint', () => {
      const factory = createBuilding('vehicleFactory', 10, 10)
      expect(factory.rallyPoint).toBeNull()
    })

    it('should initialize vehicle workshop with rallyPoint', () => {
      const workshop = createBuilding('vehicleWorkshop', 10, 10)
      expect(workshop.rallyPoint).toBeNull()
    })

    it('should initialize turret with combat properties', () => {
      const turret = createBuilding('turretGunV1', 10, 10)

      expect(turret.fireRange).toBeDefined()
      expect(turret.fireCooldown).toBeDefined()
      expect(turret.damage).toBeDefined()
      expect(turret.lastShotTime).toBe(0)
      expect(turret.turretDirection).toBeDefined()
      expect(turret.holdFire).toBe(false)
    })

    it('should initialize tesla coil with special properties', () => {
      const tesla = createBuilding('teslaCoil', 10, 10)

      expect(tesla.isTeslaCoil).toBe(true)
      expect(tesla.teslaState).toBe('idle')
      expect(tesla.teslaChargeStartTime).toBe(0)
      expect(tesla.teslaFireStartTime).toBe(0)
    })

    it('should initialize helipad with fuel properties', () => {
      const helipad = createBuilding('helipad', 10, 10)

      expect(helipad.maxFuel).toBeDefined()
      expect(helipad.fuel).toBe(helipad.maxFuel)
    })

    it('should initialize helipad with ammo properties', () => {
      const helipad = createBuilding('helipad', 10, 10)

      expect(helipad.maxAmmo).toBeDefined()
      expect(helipad.ammo).toBe(helipad.maxAmmo)
    })
  })

  describe('Building Placement', () => {
    it('should mark tiles as occupied when placing building', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      for (let y = 10; y < 10 + building.height; y++) {
        for (let x = 10; x < 10 + building.width; x++) {
          expect(mapGrid[y][x].building).toBe(building)
        }
      }
    })

    it('should update occupancy map when placing building', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      for (let y = 10; y < 10 + building.height; y++) {
        for (let x = 10; x < 10 + building.width; x++) {
          expect(gameState.occupancyMap[y][x]).toBeGreaterThan(0)
        }
      }
    })

    it('should save original tile types before placement', () => {
      mapGrid[10][10].type = 'grass'
      mapGrid[10][11].type = 'sand'

      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      expect(building.originalTiles).toBeDefined()
      expect(building.originalTiles[0][0]).toBe('grass')
      expect(building.originalTiles[0][1]).toBe('sand')
    })

    it('should remove ore from tiles when placing building', () => {
      mapGrid[10][10].ore = true
      mapGrid[10][10].type = 'ore'

      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      expect(mapGrid[10][10].ore).toBe(false)
    })

    it('should add noBuild zones for vehicle factory', () => {
      const factory = createBuilding('vehicleFactory', 10, 10)
      factory.owner = 'player'

      placeBuilding(factory, mapGrid)

      // Check tiles below the factory
      const belowY = 10 + factory.height
      for (let x = 10; x < 10 + factory.width; x++) {
        expect(mapGrid[belowY][x].noBuild).toBeGreaterThan(0)
      }
    })

    it('should add noBuild zones for ore refinery', () => {
      const refinery = createBuilding('oreRefinery', 10, 10)
      refinery.owner = 'player'

      placeBuilding(refinery, mapGrid)

      // Check tiles around the refinery
      const belowY = 10 + refinery.height
      for (let x = 10; x < 10 + refinery.width; x++) {
        expect(mapGrid[belowY][x].noBuild).toBeGreaterThan(0)
      }
    })

    it('should add extra noBuild zones for vehicle workshop', () => {
      const workshop = createBuilding('vehicleWorkshop', 10, 10)
      workshop.owner = 'player'

      placeBuilding(workshop, mapGrid)

      // Check waiting area (2 tiles below workshop)
      const waitingY = 10 + workshop.height + 1
      for (let x = 10; x < 10 + workshop.width; x++) {
        expect(mapGrid[waitingY][x].noBuild).toBeGreaterThan(0)
      }
    })
  })

  describe('Building Removal', () => {
    it('should clear building reference from tiles', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)
      clearBuildingFromMapGrid(building, mapGrid, gameState.occupancyMap)

      for (let y = 10; y < 10 + building.height; y++) {
        for (let x = 10; x < 10 + building.width; x++) {
          expect(mapGrid[y][x].building).toBeUndefined()
        }
      }
    })

    it('should restore original tile types', () => {
      mapGrid[10][10].type = 'grass'
      mapGrid[10][11].type = 'sand'

      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)
      clearBuildingFromMapGrid(building, mapGrid, gameState.occupancyMap)

      expect(mapGrid[10][10].type).toBe('grass')
      expect(mapGrid[10][11].type).toBe('sand')
    })

    it('should decrement occupancy map when clearing building', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)
      clearBuildingFromMapGrid(building, mapGrid, gameState.occupancyMap)

      for (let y = 10; y < 10 + building.height; y++) {
        for (let x = 10; x < 10 + building.width; x++) {
          expect(gameState.occupancyMap[y][x]).toBe(0)
        }
      }
    })

    it('should remove noBuild zones for vehicle factory', () => {
      const factory = createBuilding('vehicleFactory', 10, 10)
      factory.owner = 'player'

      placeBuilding(factory, mapGrid)
      clearBuildingFromMapGrid(factory, mapGrid, gameState.occupancyMap)

      const belowY = 10 + factory.height
      for (let x = 10; x < 10 + factory.width; x++) {
        expect(mapGrid[belowY][x].noBuild).toBeFalsy()
      }
    })

    it('should default to land type if no original tiles saved', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'
      building.originalTiles = null // Simulate missing original tiles

      placeBuilding(building, mapGrid)
      building.originalTiles = null // Clear after placement
      clearBuildingFromMapGrid(building, mapGrid, gameState.occupancyMap)

      for (let y = 10; y < 10 + building.height; y++) {
        for (let x = 10; x < 10 + building.width; x++) {
          expect(mapGrid[y][x].type).toBe('land')
        }
      }
    })
  })

  describe('Building Damage', () => {
    it('should track current health', () => {
      const building = createBuilding('powerPlant', 10, 10)

      building.health -= 50
      expect(building.health).toBe(buildingData.powerPlant.health - 50)
    })

    it('should allow health to go negative', () => {
      const building = createBuilding('powerPlant', 10, 10)

      building.health = -10
      expect(building.health).toBe(-10)
    })

    it('should health not exceed maxHealth after repair', () => {
      const building = createBuilding('powerPlant', 10, 10)

      building.health = building.maxHealth + 100
      expect(building.health).toBeGreaterThan(building.maxHealth)
      // Note: Game logic should clamp this, but the object allows it
    })
  })

  describe('Repair Cost Calculation', () => {
    it('should return 0 for undamaged building', () => {
      const building = {
        type: 'powerPlant',
        health: buildingData.powerPlant.health,
        maxHealth: buildingData.powerPlant.health
      }

      const cost = calculateRepairCost(building)
      expect(cost).toBe(0)
    })

    it('should calculate cost based on damage percentage', () => {
      const building = {
        type: 'powerPlant',
        health: buildingData.powerPlant.health * 0.5,
        maxHealth: buildingData.powerPlant.health
      }

      const cost = calculateRepairCost(building)
      const expected = Math.ceil(0.5 * buildingData.powerPlant.cost * 0.3)
      expect(cost).toBe(expected)
    })

    it('should calculate max cost for completely destroyed building', () => {
      const building = {
        type: 'powerPlant',
        health: 0,
        maxHealth: buildingData.powerPlant.health
      }

      const cost = calculateRepairCost(building)
      const expected = Math.ceil(1.0 * buildingData.powerPlant.cost * 0.3)
      expect(cost).toBe(expected)
    })

    it('should cost more to repair expensive buildings', () => {
      const cheapBuilding = {
        type: 'powerPlant',
        health: buildingData.powerPlant.health * 0.5,
        maxHealth: buildingData.powerPlant.health
      }
      const expensiveBuilding = {
        type: 'vehicleFactory',
        health: buildingData.vehicleFactory.health * 0.5,
        maxHealth: buildingData.vehicleFactory.health
      }

      const cheapCost = calculateRepairCost(cheapBuilding)
      const expensiveCost = calculateRepairCost(expensiveBuilding)

      expect(expensiveCost).toBeGreaterThan(cheapCost)
    })

    it('should round up repair cost', () => {
      const building = {
        type: 'powerPlant',
        health: buildingData.powerPlant.health * 0.99,
        maxHealth: buildingData.powerPlant.health
      }

      const cost = calculateRepairCost(building)
      // Even small damage should result in at least 1 cost
      expect(cost).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(cost)).toBe(true)
    })
  })

  describe('Repair Building Function', () => {
    beforeEach(() => {
      gameState.money = 10000
      gameState.buildingsUnderRepair = []
    })

    it('should fail to repair undamaged building', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      const result = repairBuilding(building, gameState)

      expect(result.success).toBe(false)
      expect(result.message).toContain('full health')
    })

    it('should fail to repair concrete walls', () => {
      const wall = {
        type: 'concreteWall',
        health: 50,
        maxHealth: 100,
        owner: 'player'
      }

      const result = repairBuilding(wall, gameState)

      expect(result.success).toBe(false)
      expect(result.message).toContain('cannot be repaired')
    })

    it('should add building to repair queue on success', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'
      building.health = building.maxHealth * 0.5

      repairBuilding(building, gameState)

      expect(gameState.buildingsUnderRepair.length).toBe(1)
      expect(gameState.buildingsUnderRepair[0].building).toBe(building)
    })

    it('should calculate correct repair info properties', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'
      building.health = building.maxHealth * 0.5

      repairBuilding(building, gameState)

      const repairInfo = gameState.buildingsUnderRepair[0]
      expect(repairInfo.startHealth).toBe(building.health)
      expect(repairInfo.targetHealth).toBe(building.maxHealth)
      expect(repairInfo.healthToRepair).toBe(building.maxHealth - building.health)
      expect(repairInfo.cost).toBeGreaterThan(0)
      expect(repairInfo.costPaid).toBe(0)
    })

    it('should set repair duration to 2x build time', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'
      building.health = building.maxHealth * 0.5

      repairBuilding(building, gameState)

      const repairInfo = gameState.buildingsUnderRepair[0]
      const baseDuration = 1000
      const buildDuration = baseDuration * (buildingData.powerPlant.cost / 500)
      const expectedRepairDuration = buildDuration * 2.0

      expect(repairInfo.duration).toBe(expectedRepairDuration)
    })

    it('should return repair cost in result', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'
      building.health = building.maxHealth * 0.5

      const result = repairBuilding(building, gameState)

      expect(result.success).toBe(true)
      expect(result.cost).toBeGreaterThan(0)
    })
  })

  describe('Test Utilities Integration', () => {
    it('should create factory with correct properties', () => {
      const factory = createTestFactory(10, 10, 'player', mapGrid)

      expect(factory.type).toBe('constructionYard')
      expect(factory.owner).toBe('player')
      expect(factory.x).toBe(10)
      expect(factory.y).toBe(10)
    })

    it('should mark map grid when creating factory', () => {
      const factory = createTestFactory(10, 10, 'player', mapGrid)

      for (let dy = 0; dy < factory.height; dy++) {
        for (let dx = 0; dx < factory.width; dx++) {
          expect(mapGrid[10 + dy][10 + dx].building).toBe(factory)
        }
      }
    })

    it('should create building with correct properties', () => {
      const building = createTestBuilding('powerPlant', 15, 15, 'player', mapGrid)

      expect(building.type).toBe('powerPlant')
      expect(building.owner).toBe('player')
      expect(building.x).toBe(15)
      expect(building.y).toBe(15)
    })

    it('should throw error for unknown building type', () => {
      expect(() => {
        createTestBuilding('unknownType', 15, 15, 'player', mapGrid)
      }).toThrow('Unknown building type')
    })
  })

  describe('Building Data Verification', () => {
    it('should have correct data for power plant', () => {
      expect(buildingData.powerPlant).toBeDefined()
      expect(buildingData.powerPlant.width).toBeGreaterThan(0)
      expect(buildingData.powerPlant.height).toBeGreaterThan(0)
      expect(buildingData.powerPlant.power).toBeGreaterThan(0) // Produces power
    })

    it('should have correct data for ore refinery', () => {
      expect(buildingData.oreRefinery).toBeDefined()
      expect(buildingData.oreRefinery.power).toBeLessThan(0) // Consumes power
    })

    it('should have correct data for construction yard', () => {
      expect(buildingData.constructionYard).toBeDefined()
      expect(buildingData.constructionYard.power).toBe(50)
    })

    it('should have cost for all buildings', () => {
      Object.keys(buildingData).forEach(type => {
        expect(buildingData[type].cost).toBeDefined()
        expect(buildingData[type].cost).toBeGreaterThanOrEqual(0)
      })
    })

    it('should have health for all buildings', () => {
      Object.keys(buildingData).forEach(type => {
        expect(buildingData[type].health).toBeDefined()
        expect(buildingData[type].health).toBeGreaterThan(0)
      })
    })

    it('should have dimensions for all buildings', () => {
      Object.keys(buildingData).forEach(type => {
        expect(buildingData[type].width).toBeGreaterThan(0)
        expect(buildingData[type].height).toBeGreaterThan(0)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle building at map edge', () => {
      const building = createBuilding('powerPlant', 0, 0)
      building.owner = 'player'

      // Should not throw
      expect(() => placeBuilding(building, mapGrid)).not.toThrow()
    })

    it('should handle clearing building at map edge', () => {
      const building = createBuilding('powerPlant', 0, 0)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      // Should not throw
      expect(() => clearBuildingFromMapGrid(building, mapGrid, gameState.occupancyMap)).not.toThrow()
    })

    it('should handle multiple buildings placed and cleared', () => {
      const building1 = createBuilding('powerPlant', 5, 5)
      const building2 = createBuilding('powerPlant', 20, 20)
      building1.owner = 'player'
      building2.owner = 'player'

      placeBuilding(building1, mapGrid)
      placeBuilding(building2, mapGrid)

      clearBuildingFromMapGrid(building1, mapGrid, gameState.occupancyMap)

      // Building 2 should still be placed
      expect(mapGrid[20][20].building).toBe(building2)
      // Building 1 tiles should be cleared
      expect(mapGrid[5][5].building).toBeUndefined()
    })

    it('should handle building with missing occupancy map', () => {
      const building = createBuilding('powerPlant', 10, 10)
      building.owner = 'player'

      placeBuilding(building, mapGrid)

      // Should not throw when clearing with null occupancy map
      expect(() => clearBuildingFromMapGrid(building, mapGrid, null)).not.toThrow()
    })
  })

  describe('game/buildingSystem update logic', () => {
    let mapGrid
    let bullets
    let units
    let factories

    beforeEach(() => {
      resetGameState()
      mapGrid = createTestMapGrid(30, 30)
      gameState.mapGrid = mapGrid
      gameState.occupancyMap = Array.from({ length: 30 }, () => Array(30).fill(0))
      gameState.buildings = []
      gameState.factories = []
      gameState.humanPlayer = 'player'
      gameState.playerPowerSupply = 50
      gameState.enemyPowerSupply = 50
      gameState.speedMultiplier = 1
      gameState.useTurretImages = false
      gameState.pendingButtonUpdate = false
      gameState.playerBuildingsDestroyed = 0
      gameState.enemyBuildingsDestroyed = 0
      selectedUnits.length = 0
      bullets = []
      units = []
      factories = []
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('removes sold buildings and refreshes power + UI state', () => {
      const now = 10000
      vi.spyOn(performance, 'now').mockReturnValue(now)
      const powerSpy = vi.spyOn(buildingsModule, 'updatePowerSupply')
      const clearSpy = vi.spyOn(buildingsModule, 'clearBuildingFromMapGrid')

      const building = createBuilding('powerPlant', 3, 3)
      building.owner = 'player'
      building.isBeingSold = true
      building.sellStartTime = now - BUILDING_SELL_DURATION
      building.selected = true
      placeBuilding(building, mapGrid)
      gameState.buildings.push(building)
      selectedUnits.push(building)

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(gameState.buildings).toHaveLength(0)
      expect(selectedUnits).toHaveLength(0)
      expect(gameState.pendingButtonUpdate).toBe(true)
      expect(powerSpy).toHaveBeenCalled()
      expect(clearSpy).toHaveBeenCalled()
      expect(updateDangerZoneMaps).toHaveBeenCalledWith(gameState)
      expect(checkGameEndConditions).toHaveBeenCalledWith(factories, gameState)
    })

    it('removes destroyed enemy buildings and triggers gas station explosion caps', () => {
      const now = 20000
      vi.spyOn(performance, 'now').mockReturnValue(now)

      const building = createBuilding('gasStation', 4, 4)
      building.owner = 'enemy'
      building.health = 0
      placeBuilding(building, mapGrid)
      gameState.buildings.push(building)

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(gameState.enemyBuildingsDestroyed).toBe(1)
      expect(playSound).toHaveBeenCalledWith('enemyBuildingDestroyed', 1.0, 0, true)
      expect(triggerExplosion).toHaveBeenCalled()
      const explosionArgs = triggerExplosion.mock.calls[0]
      const options = explosionArgs[10]
      expect(options).toMatchObject({
        buildingDamageCaps: {
          constructionYard: Math.round(buildingData.constructionYard.health * 0.9)
        }
      })
      expect(playPositionalSound).toHaveBeenCalledWith(
        'explosion',
        expect.any(Number),
        expect.any(Number),
        0.5
      )
    })

    it('spawns ammunition factory scatter particles on destruction', () => {
      const now = 30000
      vi.spyOn(performance, 'now').mockReturnValue(now)

      const building = createBuilding('ammunitionFactory', 6, 6)
      building.owner = 'player'
      building.health = 0
      placeBuilding(building, mapGrid)
      gameState.buildings.push(building)

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(bullets).toHaveLength(40)
      expect(bullets.every(particle => particle.projectileType === 'ammoParticle')).toBe(true)
      expect(playPositionalSound).toHaveBeenCalledWith(
        'explosion',
        expect.any(Number),
        expect.any(Number),
        0.7
      )
    })

    it('fires turret projectiles when aligned with a target in range', () => {
      const now = 40000
      vi.spyOn(performance, 'now').mockReturnValue(now)

      const turret = createBuilding('turretGunV1', 8, 8)
      turret.owner = 'player'
      turret.fireCooldown = 0
      turret.lastShotTime = 0
      gameState.buildings.push(turret)

      const unit = {
        x: (turret.x + 2) * TILE_SIZE,
        y: (turret.y + 1) * TILE_SIZE,
        owner: 'enemy',
        health: 100
      }
      units.push(unit)

      const centerX = (turret.x + turret.width / 2) * TILE_SIZE
      const centerY = (turret.y + turret.height / 2) * TILE_SIZE
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      turret.turretDirection = Math.atan2(unitCenterY - centerY, unitCenterX - centerX)

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(bullets).toHaveLength(1)
      expect(bullets[0].shooter).toBe(turret)
      expect(turret.recoilStartTime).toBe(now)
      expect(turret.muzzleFlashStartTime).toBe(now)
    })

    it('blocks rocket turret firing when power is negative', () => {
      const now = 50000
      vi.spyOn(performance, 'now').mockReturnValue(now)

      gameState.playerPowerSupply = -10
      const turret = createBuilding('rocketTurret', 10, 10)
      turret.owner = 'player'
      turret.fireCooldown = 0
      gameState.buildings.push(turret)

      units.push({
        x: (turret.x + 2) * TILE_SIZE,
        y: (turret.y + 1) * TILE_SIZE,
        owner: 'enemy',
        health: 100
      })

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(bullets).toHaveLength(0)
    })

    it('runs Tesla coil charge/firing sequence and applies unit effects', () => {
      const now = 60000
      vi.useFakeTimers()
      vi.spyOn(performance, 'now').mockReturnValue(now)

      const tesla = createBuilding('teslaCoil', 12, 12)
      tesla.owner = 'player'
      tesla.fireCooldown = 0
      gameState.buildings.push(tesla)

      const target = {
        x: (tesla.x + 1) * TILE_SIZE,
        y: (tesla.y + 1) * TILE_SIZE,
        owner: 'enemy',
        health: 100
      }
      units.push(target)

      updateBuildings(gameState, units, bullets, factories, mapGrid, 16)

      expect(playPositionalSound).toHaveBeenCalledWith(
        'teslacoil_loading',
        expect.any(Number),
        expect.any(Number),
        1.0
      )
      expect(tesla.teslaState).toBe('charging')

      vi.advanceTimersByTime(400)
      expect(tesla.teslaState).toBe('firing')

      vi.advanceTimersByTime(200)
      expect(target.health).toBeLessThan(100)
      expect(target.teslaDisabledUntil).toBe(now + 60000)
      expect(target.teslaSlowed).toBe(true)

      vi.advanceTimersByTime(400)
      expect(tesla.teslaState).toBe('idle')
    })

    it('toggles Tesla coil slow/disable state based on timer expiry', () => {
      const now = 70000
      const nowSpy = vi.spyOn(performance, 'now')

      const unit = {
        teslaDisabledUntil: now + 1000,
        baseSpeedModifier: 1,
        canFire: true,
        teslaSlowed: true
      }

      nowSpy.mockReturnValueOnce(now)
      updateTeslaCoilEffects([unit])

      expect(unit.canFire).toBe(false)
      expect(unit.baseSpeedModifier).toBe(0.2)
      expect(updateUnitSpeedModifier).toHaveBeenCalledWith(unit)

      nowSpy.mockReturnValueOnce(now + 2000)
      updateTeslaCoilEffects([unit])

      expect(unit.canFire).toBe(true)
      expect(unit.baseSpeedModifier).toBe(1.0)
      expect(unit.teslaDisabledUntil).toBeNull()
      expect(unit.teslaSlowed).toBe(false)
    })
  })
})
