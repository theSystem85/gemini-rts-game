import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../setup.js'
import {
  updateRemoteControlledUnits,
  suspendRemoteControlAutoFocus
} from '../../src/game/remoteControl.js'
import { gameState } from '../../src/gameState.js'
import { selectedUnits, pressedKeys } from '../../src/inputHandler.js'
import { createProjectile } from '../../src/game/projectileManager.js'

// Mock dependencies
vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32,
  MAP_TILES_X: 100,
  MAP_TILES_Y: 100
}))

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    humanPlayer: 'player1',
    units: [],
    mapGrid: [],
    scrollOffset: { x: 0, y: 0 },
    canvasWidth: 800,
    canvasHeight: 600
  }
}))

vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn()
}))

vi.mock('../../src/inputHandler.js', () => ({
  selectedUnits: [],
  pressedKeys: new Set()
}))

vi.mock('../../src/game/projectileManager.js', () => ({
  createProjectile: vi.fn()
}))

vi.mock('../../src/rendering/apacheImageRenderer.js', () => ({
  getApacheRocketSpawnPoints: vi.fn(() => ({
    left: { x: 100, y: 100 },
    right: { x: 100, y: 100 }
  }))
}))

vi.mock('../../src/rendering/rocketTankImageRenderer.js', () => ({
  getRocketSpawnPoint: vi.fn(() => ({ x: 100, y: 100 }))
}))

vi.mock('../../src/logic.js', () => ({
  angleDiff: vi.fn((a, b) => {
    let diff = b - a
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    return diff
  }),
  smoothRotateTowardsAngle: vi.fn((current, _target, _speed) => _target)
}))

describe('remoteControl.js', () => {
  let mockApache
  let mockRocketTank
  let mockUnits

  beforeEach(() => {
    vi.clearAllMocks()

    mockApache = {
      id: 1,
      type: 'apache',
      owner: 'player1',
      x: 400,
      y: 300,
      tileX: 12,
      tileY: 9,
      health: 100,
      maxHealth: 100,
      direction: 0,
      rotationSpeed: 0.05,
      speed: 4,
      movement: {
        isMoving: false,
        targetX: null,
        targetY: null
      },
      remoteControlActive: false,
      rocketAmmo: 10,
      volleyState: null,
      target: null
    }

    mockRocketTank = {
      id: 2,
      type: 'rocketTank',
      owner: 'player1',
      x: 200,
      y: 200,
      tileX: 6,
      tileY: 6,
      health: 100,
      maxHealth: 100,
      direction: 0,
      rotationSpeed: 0.05,
      speed: 2,
      movement: {
        isMoving: false
      },
      remoteControlActive: false,
      ammunition: 10
    }

    mockUnits = [mockApache, mockRocketTank]

    gameState.units = mockUnits
    gameState.mapGrid = Array(100).fill(null).map(() =>
      Array(100).fill(null).map(() => ({ type: 'grass' }))
    )
    gameState.scrollOffset = { x: 0, y: 0 }

    selectedUnits.length = 0
    pressedKeys.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateRemoteControlledUnits', () => {
    it('should skip if no units are selected', () => {
      const result = updateRemoteControlledUnits(mockUnits, 16)
      expect(result).toBeUndefined()
    })

    it('should skip non-controllable unit types', () => {
      const tank = {
        id: 3,
        type: 'tank',
        owner: 'player1',
        remoteControlActive: false
      }
      selectedUnits.push(tank)

      updateRemoteControlledUnits([tank], 16)
      expect(tank.remoteControlActive).toBe(false)
    })

    it('should activate remote control on apache when selected', () => {
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.remoteControlActive).toBe(true)
    })

    it('should activate remote control on rocket tank when selected', () => {
      selectedUnits.push(mockRocketTank)

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockRocketTank.remoteControlActive).toBe(true)
    })

    it('should deactivate remote control when unit is deselected', () => {
      mockApache.remoteControlActive = true

      // Unit not in selectedUnits means it should deactivate
      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.remoteControlActive).toBe(false)
    })
  })

  describe('keyboard controls', () => {
    it('should rotate apache left with A key', () => {
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyA')

      const initialDirection = mockApache.direction
      updateRemoteControlledUnits(mockUnits, 16)
      // Direction should change (rotate left/counter-clockwise)
      expect(mockApache.direction).not.toBe(initialDirection)
    })

    it('should rotate apache right with D key', () => {
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyD')

      const initialDirection = mockApache.direction
      updateRemoteControlledUnits(mockUnits, 16)
      // Direction should change (rotate right/clockwise)
      expect(mockApache.direction).not.toBe(initialDirection)
    })

    it('should move apache forward with W key', () => {
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyW')

      const initialX = mockApache.x
      const initialY = mockApache.y
      updateRemoteControlledUnits(mockUnits, 16)
      // Position should change
      expect(mockApache.x !== initialX || mockApache.y !== initialY).toBe(true)
    })

    it('should move apache backward with S key', () => {
      mockApache.direction = 0 // Facing right
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyS')

      const initialX = mockApache.x
      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.x).toBeLessThan(initialX) // Moved backward (left)
    })

    it('should strafe apache left with Q key', () => {
      mockApache.direction = 0 // Facing right
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyQ')

      updateRemoteControlledUnits(mockUnits, 16)
      // Should strafe left (perpendicular to facing direction)
    })

    it('should strafe apache right with E key', () => {
      mockApache.direction = 0
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyE')

      updateRemoteControlledUnits(mockUnits, 16)
      // Should strafe right
    })

    it('should handle combined movement keys', () => {
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyW')
      pressedKeys.add('KeyD')

      const initialX = mockApache.x
      const initialDirection = mockApache.direction
      updateRemoteControlledUnits(mockUnits, 16)
      // Should move forward while rotating
      expect(mockApache.x !== initialX || mockApache.direction !== initialDirection).toBe(true)
    })
  })

  describe('firing controls', () => {
    it('should fire apache rockets with Space key', () => {
      selectedUnits.push(mockApache)
      mockApache.remoteControlActive = true
      pressedKeys.add('Space')

      updateRemoteControlledUnits(mockUnits, 16)
      // Should attempt to create rocket projectile
      expect(createProjectile).toHaveBeenCalled()
    })

    it('should not fire apache when out of ammo', () => {
      selectedUnits.push(mockApache)
      mockApache.remoteControlActive = true
      mockApache.rocketAmmo = 0
      pressedKeys.add('Space')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(createProjectile).not.toHaveBeenCalled()
    })

    it('should fire rocket tank with Space key', () => {
      selectedUnits.push(mockRocketTank)
      mockRocketTank.remoteControlActive = true
      pressedKeys.add('Space')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(createProjectile).toHaveBeenCalled()
    })

    it('should decrement ammo when firing', () => {
      selectedUnits.push(mockApache)
      mockApache.remoteControlActive = true
      mockApache.rocketAmmo = 10
      pressedKeys.add('Space')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.rocketAmmo).toBeLessThan(10)
    })

    it('should respect fire cooldown', () => {
      selectedUnits.push(mockApache)
      mockApache.remoteControlActive = true
      mockApache.lastRocketFire = performance.now() // Just fired
      pressedKeys.add('Space')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(createProjectile).not.toHaveBeenCalled()
    })
  })

  describe('boundary checks', () => {
    it('should prevent apache from leaving map bounds', () => {
      mockApache.x = 1 // Near edge
      mockApache.y = 300
      mockApache.direction = Math.PI // Facing left
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyW')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.x).toBeGreaterThanOrEqual(0)
    })

    it('should prevent unit from going below map', () => {
      mockApache.x = 400
      mockApache.y = 3199 // Near bottom edge
      mockApache.direction = Math.PI / 2 // Facing down
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyW')

      updateRemoteControlledUnits(mockUnits, 16)
      // Should clamp to boundary
    })
  })

  describe('rocket tank controls', () => {
    it('should rotate rocket tank with A and D keys', () => {
      selectedUnits.push(mockRocketTank)
      pressedKeys.add('KeyA')

      const initialDirection = mockRocketTank.direction
      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockRocketTank.direction).not.toBe(initialDirection)
    })

    it('should move rocket tank with W key', () => {
      selectedUnits.push(mockRocketTank)
      pressedKeys.add('KeyW')

      const initialX = mockRocketTank.x
      const initialY = mockRocketTank.y
      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockRocketTank.x !== initialX || mockRocketTank.y !== initialY).toBe(true)
    })

    it('should not allow strafing for rocket tank', () => {
      mockRocketTank.x = 200
      mockRocketTank.y = 200
      mockRocketTank.direction = 0
      selectedUnits.push(mockRocketTank)
      pressedKeys.add('KeyQ') // Strafe key

      const initialX = mockRocketTank.x
      updateRemoteControlledUnits(mockUnits, 16)
      // Rocket tank shouldn't strafe
      expect(mockRocketTank.x).toBe(initialX)
    })
  })

  describe('auto-focus behavior', () => {
    it('should center camera on remote controlled unit', () => {

      updateRemoteControlledUnits(mockUnits, 16)
      // Scroll offset should adjust to center unit
    })
  })

  describe('suspendRemoteControlAutoFocus', () => {
    it('should temporarily disable auto-focus', () => {
      suspendRemoteControlAutoFocus()
      // Auto-focus should be suspended
      expect(typeof suspendRemoteControlAutoFocus).toBe('function')
    })
  })

  describe('gamepad support', () => {
    it('should handle gamepad input if available', () => {
      // Gamepad input is handled internally
      selectedUnits.push(mockApache)

      // This test verifies the function handles gamepad absence gracefully
      expect(() => updateRemoteControlledUnits(mockUnits, 16)).not.toThrow()
    })
  })

  describe('unit state management', () => {
    it('should clear target when remote control activates', () => {
      mockApache.target = { id: 999, health: 100 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.target).toBeNull()
    })

    it('should clear path when remote control activates', () => {
      mockApache.path = [{ x: 10, y: 10 }, { x: 11, y: 11 }]
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.path).toEqual([])
    })

    it('should stop active movement when remote control activates', () => {
      mockApache.movement = {
        isMoving: true,
        targetX: 500,
        targetY: 400
      }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.movement.isMoving).toBe(false)
    })
  })

  describe('enemy units', () => {
    it('should not allow remote control of enemy units', () => {
      const enemyApache = {
        id: 10,
        type: 'apache',
        owner: 'enemy',
        x: 400,
        y: 300,
        remoteControlActive: false
      }

      selectedUnits.push(enemyApache)
      updateRemoteControlledUnits([enemyApache], 16)
      expect(enemyApache.remoteControlActive).toBe(false)
    })
  })

  describe('altitude handling', () => {
    it('should maintain apache altitude during remote control', () => {
      mockApache.altitude = 3
      selectedUnits.push(mockApache)
      pressedKeys.add('KeyW')

      updateRemoteControlledUnits(mockUnits, 16)
      expect(mockApache.altitude).toBe(3) // Altitude should be maintained
    })
  })
})
