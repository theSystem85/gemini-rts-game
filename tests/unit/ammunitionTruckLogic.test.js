import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '../setup.js'

// Mock dependencies
vi.mock('../../src/config.js', async() => {
  const actual = await vi.importActual('../../src/config.js')
  return {
    ...actual,
    AMMO_RESUPPLY_TIME: 5000,
    AMMO_TRUCK_RANGE: 1.5,
    TILE_SIZE: 32
  }
})

vi.mock('../../src/performanceUtils.js', () => ({
  logPerformance: vi.fn(fn => fn)
}))

vi.mock('../../src/inputHandler.js', () => ({
  getUnitCommandsHandler: vi.fn()
}))

vi.mock('../../src/logic.js', () => ({
  triggerExplosion: vi.fn()
}))

vi.mock('../../src/ui/distortionEffect.js', () => ({
  triggerDistortionEffect: vi.fn()
}))

vi.mock('../../src/utils/gameRandom.js', () => ({
  gameRandom: vi.fn(() => 0.5)
}))

import { updateAmmunitionTruckLogic, detonateAmmunitionTruck } from '../../src/game/ammunitionTruckLogic.js'
import { getUnitCommandsHandler } from '../../src/inputHandler.js'
import { triggerExplosion } from '../../src/logic.js'
import { triggerDistortionEffect } from '../../src/ui/distortionEffect.js'

describe('ammunitionTruckLogic.js', () => {
  let gameState

  beforeEach(() => {
    vi.clearAllMocks()
    getUnitCommandsHandler.mockReturnValue({
      advanceUtilityQueue: vi.fn()
    })
    gameState = {
      mapGrid: Array(100).fill(null).map(() => Array(100).fill(0)),
      buildings: [],
      units: []
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateAmmunitionTruckLogic', () => {
    it('should do nothing if no ammo trucks exist', () => {
      const units = [
        { id: 'u1', type: 'tank', health: 100 }
      ]

      updateAmmunitionTruckLogic(units, gameState, 16)

      // No errors should occur
      expect(true).toBe(true)
    })

    it('should skip dead ammo trucks', () => {
      const units = [
        { id: 'a1', type: 'ammunitionTruck', health: 0, tileX: 10, tileY: 10 },
        { id: 'a2', type: 'ammunitionTruck', health: 100, tileX: 10, tileY: 10 }
      ]

      updateAmmunitionTruckLogic(units, gameState, 16)

      // Only alive trucks should be processed
      expect(units[1].ammoCargo).toBeDefined()
    })

    it('should initialize ammo cargo properties if undefined', () => {
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10
      }
      const units = [ammoTruck]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(ammoTruck.ammoCargo).toBe(500)
      expect(ammoTruck.maxAmmoCargo).toBe(500)
    })

    it('should clear resupply target if target does not exist', () => {
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'nonexistent' },
        ammoResupplyTimer: 1000
      }
      const units = [ammoTruck]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(ammoTruck.ammoResupplyTarget).toBe(null)
      expect(ammoTruck.ammoResupplyTimer).toBe(0)
    })

    it('should clear resupply target if target is dead', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 0,
        tileX: 10,
        tileY: 10,
        ammunition: 50,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 1000
      }
      const units = [ammoTruck, target]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(ammoTruck.ammoResupplyTarget).toBe(null)
    })

    it('should clear resupply target if unit has full ammunition', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammunition: 100,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 1000
      }
      const units = [ammoTruck, target]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(ammoTruck.ammoResupplyTarget).toBe(null)
    })

    it('should clear resupply target if apache has full rocket ammo', () => {
      const target = {
        id: 'u1',
        type: 'apache',
        health: 100,
        tileX: 10,
        tileY: 10,
        rocketAmmo: 16,
        maxRocketAmmo: 16
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 1000
      }
      const units = [ammoTruck, target]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(ammoTruck.ammoResupplyTarget).toBe(null)
    })

    it('should resupply unit when in range and not moving', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammunition: 50,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck, target]

      const initialAmmo = target.ammunition

      updateAmmunitionTruckLogic(units, gameState, 100)

      expect(target.ammunition).toBeGreaterThan(initialAmmo)
      expect(ammoTruck.ammoCargo).toBeLessThan(500)
    })

    it('should resupply apache rocket ammo', () => {
      const target = {
        id: 'u1',
        type: 'apache',
        health: 100,
        tileX: 10,
        tileY: 10,
        rocketAmmo: 5,
        maxRocketAmmo: 16
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck, target]

      const initialAmmo = target.rocketAmmo

      updateAmmunitionTruckLogic(units, gameState, 100)

      expect(target.rocketAmmo).toBeGreaterThan(initialAmmo)
    })

    it('should resupply building ammo', () => {
      const building = {
        id: 'b1',
        type: 'turret',
        health: 100,
        x: 10,
        y: 10,
        width: 2,
        height: 2,
        ammo: 50,
        maxAmmo: 200
      }
      gameState.buildings = [building]

      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'b1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck]

      const initialAmmo = building.ammo

      updateAmmunitionTruckLogic(units, gameState, 100)

      expect(building.ammo).toBeGreaterThan(initialAmmo)
    })

    it('should stop resupplying when truck runs out of cargo', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammunition: 50,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 0, // Empty
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck, target]

      updateAmmunitionTruckLogic(units, gameState, 100)

      expect(ammoTruck.ammoResupplyTarget).toBe(null)
    })

    it('should stop resupplying when target is full', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammunition: 99,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck, target]

      // Multiple updates to fill the target
      updateAmmunitionTruckLogic(units, gameState, 1000)
      updateAmmunitionTruckLogic(units, gameState, 1000)
      updateAmmunitionTruckLogic(units, gameState, 1000)

      expect(target.ammunition).toBeLessThanOrEqual(100)
    })

    it('should not resupply when ammo truck is moving', () => {
      const target = {
        id: 'u1',
        type: 'tank',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammunition: 50,
        maxAmmunition: 100
      }
      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'u1' },
        ammoResupplyTimer: 0,
        movement: { isMoving: true }
      }
      const units = [ammoTruck, target]

      const initialAmmo = target.ammunition

      updateAmmunitionTruckLogic(units, gameState, 100)

      // Should not resupply while moving
      expect(target.ammunition).toBe(initialAmmo)
    })

    it('should handle utility queue for ammo resupply', () => {
      const mockCommands = {
        advanceUtilityQueue: vi.fn()
      }
      getUnitCommandsHandler.mockReturnValue(mockCommands)

      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10,
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: null,
        utilityQueue: {
          mode: 'ammoResupply',
          currentTargetId: 'oldTarget',
          currentTargetType: 'unit'
        }
      }
      const units = [ammoTruck]

      updateAmmunitionTruckLogic(units, gameState, 16)

      expect(mockCommands.advanceUtilityQueue).toHaveBeenCalled()
    })

    it('should check adjacency for building resupply', () => {
      const building = {
        id: 'b1',
        type: 'turret',
        health: 100,
        x: 20,
        y: 20,
        width: 2,
        height: 2,
        ammo: 50,
        maxAmmo: 200
      }
      gameState.buildings = [building]

      const ammoTruck = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 100,
        tileX: 10, // Too far away
        tileY: 10,
        ammoCargo: 500,
        maxAmmoCargo: 500,
        ammoResupplyTarget: { id: 'b1' },
        ammoResupplyTimer: 0
      }
      const units = [ammoTruck]

      const initialAmmo = building.ammo

      updateAmmunitionTruckLogic(units, gameState, 100)

      // Building should not be resupplied - too far
      expect(building.ammo).toBe(initialAmmo)
    })
  })

  describe('detonateAmmunitionTruck', () => {
    it('should return false if unit is null', () => {
      const result = detonateAmmunitionTruck(null, [], [])
      expect(result).toBe(false)
    })

    it('should return false if unit has health', () => {
      const unit = { id: 'a1', health: 100 }
      const result = detonateAmmunitionTruck(unit, [], [])
      expect(result).toBe(false)
    })

    it('should return false if already detonated', () => {
      const unit = { id: 'a1', health: 0, _ammoTruckDetonated: true }
      const result = detonateAmmunitionTruck(unit, [], [])
      expect(result).toBe(false)
    })

    it('should trigger primary explosion', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      detonateAmmunitionTruck(unit, [], [])

      expect(triggerExplosion).toHaveBeenCalled()
    })

    it('should trigger distortion effect when gameState provided', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      detonateAmmunitionTruck(unit, [], [], gameState)

      expect(triggerDistortionEffect).toHaveBeenCalled()
    })

    it('should trigger multiple secondary explosions', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      detonateAmmunitionTruck(unit, [], [])

      // Primary + 10 secondary explosions
      expect(triggerExplosion).toHaveBeenCalledTimes(11)
    })

    it('should mark unit as detonated', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      detonateAmmunitionTruck(unit, [], [])

      expect(unit._ammoTruckDetonated).toBe(true)
    })

    it('should stop unit movement', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100,
        movement: {
          velocity: { x: 10, y: 10 },
          targetVelocity: { x: 5, y: 5 },
          isMoving: true,
          currentSpeed: 50
        }
      }

      detonateAmmunitionTruck(unit, [], [])

      expect(unit.movement.velocity.x).toBe(0)
      expect(unit.movement.velocity.y).toBe(0)
      expect(unit.movement.targetVelocity.x).toBe(0)
      expect(unit.movement.targetVelocity.y).toBe(0)
      expect(unit.movement.isMoving).toBe(false)
      expect(unit.movement.currentSpeed).toBe(0)
    })

    it('should set health to 0 and clear ammo cargo', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100,
        ammoCargo: 500
      }

      detonateAmmunitionTruck(unit, [], [])

      expect(unit.health).toBe(0)
      expect(unit.ammoCargo).toBe(0)
    })

    it('should return true on successful detonation', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      const result = detonateAmmunitionTruck(unit, [], [])

      expect(result).toBe(true)
    })

    it('should pass units and factories to explosion', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }
      const units = [{ id: 'u1' }]
      const factories = [{ id: 'f1' }]

      detonateAmmunitionTruck(unit, units, factories)

      // Check first (primary) explosion was passed units and factories
      const firstCall = triggerExplosion.mock.calls[0]
      expect(firstCall[3]).toBe(units)
      expect(firstCall[4]).toBe(factories)
    })

    it('should use correct explosion center position', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 200
      }

      detonateAmmunitionTruck(unit, [], [])

      // Primary explosion should be at unit center
      const firstCall = triggerExplosion.mock.calls[0]
      expect(firstCall[0]).toBe(116) // x + TILE_SIZE/2
      expect(firstCall[1]).toBe(216) // y + TILE_SIZE/2
      expect(firstCall[2]).toBe(80) // primary damage
    })

    it('should handle unit without movement property', () => {
      const unit = {
        id: 'a1',
        type: 'ammunitionTruck',
        health: 0,
        x: 100,
        y: 100
      }

      expect(() => detonateAmmunitionTruck(unit, [], [])).not.toThrow()
      expect(unit._ammoTruckDetonated).toBe(true)
    })
  })
})
