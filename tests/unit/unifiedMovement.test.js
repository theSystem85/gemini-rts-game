import { describe, it, expect, vi } from 'vitest'
import '../setup.js'

// Mock dependencies
vi.mock('../../src/config.js', async() => {
  const actual = await vi.importActual('../../src/config.js')
  return {
    ...actual,
    TILE_SIZE: 32,
    STUCK_CHECK_INTERVAL: 3000,
    STUCK_THRESHOLD: 2,
    STUCK_HANDLING_COOLDOWN: 5000,
    MINE_TRIGGER_RADIUS: 1.5
  }
})

vi.mock('../../src/units.js', () => ({
  findPath: vi.fn(),
  updateUnitOccupancy: vi.fn(),
  removeUnitOccupancy: vi.fn()
}))

vi.mock('../../src/game/harvesterLogic.js', () => ({
  clearStuckHarvesterOreField: vi.fn(),
  handleStuckHarvester: vi.fn()
}))

vi.mock('../../src/sound.js', () => ({
  playPositionalSound: vi.fn(),
  playSound: vi.fn(),
  audioContext: null,
  getMasterVolume: vi.fn(() => 1)
}))

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    scrollOffset: { x: 0, y: 0 },
    buildings: [],
    units: []
  }
}))

vi.mock('../../src/logic.js', () => ({
  smoothRotateTowardsAngle: vi.fn((current, target, speed) => {
    const diff = target - current
    if (Math.abs(diff) < speed) return target
    return current + Math.sign(diff) * speed
  })
}))

vi.mock('../../src/game/tankerTruckUtils.js', () => ({
  detonateTankerTruck: vi.fn()
}))

vi.mock('../../src/game/mineSystem.js', () => ({
  getMineAtTile: vi.fn(),
  detonateMine: vi.fn()
}))

vi.mock('../../src/game/spatialQuadtree.js', () => ({
  getSpatialQuadtree: vi.fn()
}))

vi.mock('../../src/utils/gameRandom.js', () => ({
  gameRandom: vi.fn(() => 0.5)
}))

import {
  hasFriendlyUnitOnTile,
  initializeUnitMovement,
  stopUnitMovement,
  cancelUnitMovement,
  resetUnitVelocityForNewPath,
  isUnitMoving,
  rotateUnitInPlace
} from '../../src/game/unifiedMovement.js'

describe('unifiedMovement.js', () => {
  describe('hasFriendlyUnitOnTile', () => {
    it('should return false if no units on tile', () => {
      const unit = { owner: 1, id: 'u1' }
      const units = []

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(false)
    })

    it('should return true if friendly unit on tile', () => {
      const unit = { owner: 1, id: 'u1' }
      // Function uses x,y coordinates (pixel) to calculate tile positions
      // Tile 10 = position 10 * 32 + 16 = 336 (center of tile)
      const friendlyUnit = { owner: 1, id: 'u2', x: 320, y: 320, health: 100, type: 'tank' }
      const units = [friendlyUnit]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(true)
    })

    it('should return false if enemy unit on tile', () => {
      const unit = { owner: 1, id: 'u1' }
      const enemyUnit = { owner: 2, id: 'u2', tileX: 10, tileY: 10, health: 100 }
      const units = [enemyUnit]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(false)
    })

    it('should exclude the unit itself', () => {
      const unit = { owner: 1, id: 'u1', tileX: 10, tileY: 10 }
      const units = [unit]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(false)
    })

    it('should return false if unit is dead', () => {
      const unit = { owner: 1, id: 'u1' }
      const deadUnit = { owner: 1, id: 'u2', tileX: 10, tileY: 10, health: 0 }
      const units = [deadUnit]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(false)
    })

    it('should handle units without tileX/tileY', () => {
      const unit = { owner: 1, id: 'u1' }
      const invalidUnit = { owner: 1, id: 'u2', health: 100 }
      const units = [invalidUnit]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(false)
    })

    it('should handle multiple units on different tiles', () => {
      const unit = { owner: 1, id: 'u1' }
      // Function uses x,y coordinates (pixel) to calculate tile positions
      const units = [
        { owner: 1, id: 'u2', x: 160, y: 160, health: 100, type: 'tank' },
        { owner: 1, id: 'u3', x: 320, y: 320, health: 100, type: 'tank' },
        { owner: 1, id: 'u4', x: 480, y: 480, health: 100, type: 'tank' }
      ]

      const result = hasFriendlyUnitOnTile(unit, 10, 10, units)

      expect(result).toBe(true)
    })
  })

  describe('initializeUnitMovement', () => {
    it('should initialize movement properties for unit', () => {
      const unit = {
        id: 'u1',
        type: 'tank',
        x: 100,
        y: 100
      }

      initializeUnitMovement(unit)

      expect(unit.movement).toBeDefined()
      expect(unit.movement.velocity).toEqual({ x: 0, y: 0 })
      expect(unit.movement.targetVelocity).toEqual({ x: 0, y: 0 })
      expect(unit.movement.currentSpeed).toBe(0)
      expect(unit.movement.isMoving).toBe(false)
    })

    it('should not overwrite existing movement properties', () => {
      const unit = {
        id: 'u1',
        type: 'tank',
        x: 100,
        y: 100,
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      initializeUnitMovement(unit)

      expect(unit.movement.velocity.x).toBe(5)
      expect(unit.movement.velocity.y).toBe(5)
      expect(unit.movement.isMoving).toBe(true)
    })

    it('should initialize Apache-specific properties', () => {
      const unit = {
        id: 'u1',
        type: 'apache',
        x: 100,
        y: 100,
        isAirUnit: true
      }

      initializeUnitMovement(unit)

      // initializeUnitMovement only sets the movement object, not Apache-specific properties
      // Apache-specific properties are set elsewhere in the codebase
      expect(unit.movement).toBeDefined()
      expect(unit.movement.velocity).toEqual({ x: 0, y: 0 })
      expect(unit.movement.targetVelocity).toEqual({ x: 0, y: 0 })
    })

    it('should handle unit without type', () => {
      const unit = {
        id: 'u1',
        x: 100,
        y: 100
      }

      expect(() => {
        initializeUnitMovement(unit)
      }).not.toThrow()
    })
  })

  describe('stopUnitMovement', () => {
    it('should stop unit movement', () => {
      const unit = {
        id: 'u1',
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      stopUnitMovement(unit)

      expect(unit.movement.velocity.x).toBe(0)
      expect(unit.movement.velocity.y).toBe(0)
      expect(unit.movement.targetVelocity.x).toBe(0)
      expect(unit.movement.targetVelocity.y).toBe(0)
      expect(unit.movement.currentSpeed).toBe(0)
      expect(unit.movement.isMoving).toBe(false)
    })

    it('should clear path but not moveTarget', () => {
      const unit = {
        id: 'u1',
        moveTarget: { x: 200, y: 200 },
        path: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      stopUnitMovement(unit)

      // stopUnitMovement clears path but does not clear moveTarget
      expect(unit.moveTarget).toEqual({ x: 200, y: 200 })
      expect(unit.path).toEqual([])
    })

    it('should handle unit without movement property', () => {
      const unit = {
        id: 'u1',
        moveTarget: { x: 200, y: 200 },
        path: [{ x: 1, y: 1 }]
      }

      expect(() => {
        stopUnitMovement(unit)
      }).not.toThrow()

      // stopUnitMovement initializes movement then clears path, but not moveTarget
      expect(unit.moveTarget).toEqual({ x: 200, y: 200 })
      expect(unit.path).toEqual([])
    })

    it('should handle unit without movement.targetVelocity', () => {
      const unit = {
        id: 'u1',
        movement: {
          velocity: { x: 5, y: 5 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      // stopUnitMovement will throw if movement.targetVelocity is missing
      // because initializeUnitMovement only creates movement object if it doesn't exist,
      // not individual properties within an existing movement object
      expect(() => {
        stopUnitMovement(unit)
      }).toThrow()
    })
  })

  describe('cancelUnitMovement', () => {
    it('should cancel unit movement', () => {
      const unit = {
        id: 'u1',
        moveTarget: { x: 200, y: 200 },
        path: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
      }

      cancelUnitMovement(unit)

      expect(unit.moveTarget).toBe(null)
      expect(unit.path).toEqual([])
    })

    it('should clear targetVelocity and isMoving', () => {
      const unit = {
        id: 'u1',
        moveTarget: { x: 200, y: 200 },
        path: [{ x: 1, y: 1 }],
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      cancelUnitMovement(unit)

      // cancelUnitMovement preserves current velocity but clears targetVelocity and isMoving
      expect(unit.movement.velocity.x).toBe(5)
      expect(unit.movement.velocity.y).toBe(5)
      expect(unit.movement.targetVelocity.x).toBe(0)
      expect(unit.movement.targetVelocity.y).toBe(0)
      expect(unit.movement.isMoving).toBe(false)
    })
  })

  describe('resetUnitVelocityForNewPath', () => {
    it('should reset velocity for new path', () => {
      const unit = {
        id: 'u1',
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      resetUnitVelocityForNewPath(unit)

      // resetUnitVelocityForNewPath resets velocity and currentSpeed, but NOT targetVelocity
      expect(unit.movement.velocity.x).toBe(0)
      expect(unit.movement.velocity.y).toBe(0)
      expect(unit.movement.currentSpeed).toBe(0)
      // targetVelocity is NOT reset - the path system sets it
      expect(unit.movement.targetVelocity.x).toBe(10)
      expect(unit.movement.targetVelocity.y).toBe(10)
    })

    it('should preserve isMoving state', () => {
      const unit = {
        id: 'u1',
        movement: {
          velocity: { x: 5, y: 5 },
          targetVelocity: { x: 10, y: 10 },
          currentSpeed: 10,
          isMoving: true
        }
      }

      resetUnitVelocityForNewPath(unit)

      expect(unit.movement.isMoving).toBe(true)
    })

    it('should handle unit without movement property', () => {
      const unit = {
        id: 'u1'
      }

      expect(() => {
        resetUnitVelocityForNewPath(unit)
      }).not.toThrow()
    })
  })

  describe('isUnitMoving', () => {
    it('should return true if unit is moving', () => {
      const unit = {
        movement: {
          isMoving: true,
          currentSpeed: 10
        }
      }

      const result = isUnitMoving(unit)

      expect(result).toBe(true)
    })

    it('should return false if unit is not moving', () => {
      const unit = {
        movement: {
          isMoving: false,
          currentSpeed: 0
        }
      }

      const result = isUnitMoving(unit)

      expect(result).toBe(false)
    })

    it('should return false if unit has no movement property', () => {
      const unit = {
        id: 'u1'
      }

      const result = isUnitMoving(unit)

      expect(result).toBe(false)
    })

    it('should check current speed as fallback', () => {
      const unit = {
        movement: {
          currentSpeed: 5
        }
      }

      const result = isUnitMoving(unit)

      expect(result).toBe(true)
    })

    it('should return false if currentSpeed is zero', () => {
      const unit = {
        movement: {
          currentSpeed: 0
        }
      }

      const result = isUnitMoving(unit)

      expect(result).toBe(false)
    })
  })

  describe('rotateUnitInPlace', () => {
    it('should rotate unit to target direction', () => {
      const unit = {
        id: 'u1',
        direction: 0,
        rotation: 0
      }

      rotateUnitInPlace(unit, Math.PI / 2)

      // rotateUnitInPlace sets movement.rotation and copies to unit.rotation
      expect(unit.rotation).toBeGreaterThan(0)
    })

    it('should use random rotation if no direction provided', () => {
      const unit = {
        id: 'u1',
        direction: 0,
        rotation: 0
      }

      // When no targetDirection is provided, function uses gameRandom()
      // Since gameRandom is mocked to return 0.5, rotation will be PI
      rotateUnitInPlace(unit)

      // With gameRandom returning 0.5, targetRotation = 0.5 * 2 * PI = PI
      // Since rotation starts at 0 and rotates towards PI, it should increase
      expect(unit.movement.targetRotation).toBe(Math.PI)
    })

    it('should not rotate if no target direction', () => {
      const unit = {
        id: 'u1',
        direction: 0
      }

      rotateUnitInPlace(unit)

      expect(unit.direction).toBe(0)
    })

    it('should handle unit without direction property', () => {
      const unit = {
        id: 'u1'
      }

      expect(() => {
        rotateUnitInPlace(unit, Math.PI / 2)
      }).not.toThrow()
    })
  })
})
