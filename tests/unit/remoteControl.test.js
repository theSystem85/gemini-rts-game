import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../setup.js'
import {
  updateRemoteControlledUnits,
  suspendRemoteControlAutoFocus
} from '../../src/game/remoteControl.js'
import { gameState } from '../../src/gameState.js'
import { selectedUnits } from '../../src/inputHandler.js'

// Mock dependencies
vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32,
  TANK_FIRE_RANGE: 8,
  STREET_SPEED_MULTIPLIER: 1.5,
  ENABLE_ENEMY_CONTROL: false,
  isTurretTankUnitType: vi.fn((type) => type === 'rocketTank'),
  APACHE_RANGE_REDUCTION: 0.8
}))

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    humanPlayer: 'player1',
    units: [],
    mapGrid: [],
    scrollOffset: { x: 0, y: 0 },
    remoteControl: null,
    remoteControlAbsolute: null,
    cameraFollowUnitId: null
  }
}))

vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn()
}))

vi.mock('../../src/inputHandler.js', () => ({
  selectedUnits: [],
  getKeyboardHandler: vi.fn(() => null)
}))

vi.mock('../../src/game/bulletSystem.js', () => ({
  fireBullet: vi.fn()
}))

vi.mock('../../src/rendering/apacheImageRenderer.js', () => ({
  getApacheRocketSpawnPoints: vi.fn(() => ({
    left: { x: 100, y: 100 },
    right: { x: 100, y: 100 }
  }))
}))

vi.mock('../../src/logic.js', () => ({
  angleDiff: vi.fn((a, b) => {
    let diff = b - a
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    return diff
  }),
  normalizeAngle: vi.fn((a) => {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }),
  smoothRotateTowardsAngle: vi.fn((current, target) => target)
}))

vi.mock('../../src/utils/layoutMetrics.js', () => ({
  getPlayableViewportWidth: vi.fn(() => 800),
  getPlayableViewportHeight: vi.fn(() => 600)
}))

describe('remoteControl.js', () => {
  let mockApache
  let mockRocketTank
  let mockUnits
  let mockBullets
  let mockMapGrid
  let mockOccupancyMap

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
      turretDirection: 0,
      rotationSpeed: 0.05,
      speed: 4,
      movement: {
        isMoving: false,
        velocity: { x: 0, y: 0 },
        targetVelocity: { x: 0, y: 0 }
      },
      remoteControlActive: false,
      rocketAmmo: 10,
      volleyState: null,
      target: null,
      path: []
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
      turretDirection: 0,
      rotationSpeed: 0.05,
      speed: 2,
      movement: {
        isMoving: false,
        velocity: { x: 0, y: 0 },
        targetVelocity: { x: 0, y: 0 }
      },
      remoteControlActive: false,
      ammunition: 10
    }

    mockUnits = [mockApache, mockRocketTank]
    mockBullets = []
    mockMapGrid = Array(100).fill(null).map(() =>
      Array(100).fill(null).map(() => ({ type: 'grass' }))
    )
    mockOccupancyMap = Array(100).fill(null).map(() => Array(100).fill(0))

    gameState.units = mockUnits
    gameState.mapGrid = mockMapGrid
    gameState.scrollOffset = { x: 0, y: 0 }
    gameState.remoteControl = null
    gameState.remoteControlAbsolute = null
    gameState.cameraFollowUnitId = null

    selectedUnits.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateRemoteControlledUnits', () => {
    it('should return early if no remoteControl state exists', () => {
      gameState.remoteControl = null
      const result = updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      expect(result).toBeUndefined()
    })

    it('should return early if no units are selected', () => {
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 0 }
      selectedUnits.length = 0

      const result = updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      expect(result).toBeUndefined()
    })

    it('should not process non-controllable unit types', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0 }
      const tank = {
        id: 3,
        type: 'tank',
        owner: 'player1',
        x: 100,
        y: 100,
        movement: {
          isMoving: false,
          velocity: { x: 0, y: 0 },
          targetVelocity: { x: 0, y: 0 }
        }
      }
      selectedUnits.push(tank)

      const initialPos = { x: tank.x, y: tank.y }
      updateRemoteControlledUnits([tank], mockBullets, mockMapGrid, mockOccupancyMap)
      // Regular tanks shouldn't be remotely controlled
      expect(tank.x).toBe(initialPos.x)
    })

    it('should process apache units when selected', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      selectedUnits.push(mockApache)

      // Should not throw
      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })

    it('should process rocket tank units when selected', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      selectedUnits.push(mockRocketTank)

      // Should not throw
      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })
  })

  describe('remote control state', () => {
    it('should handle forward movement input', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      // Function should execute without error
    })

    it('should handle backward movement input', () => {
      gameState.remoteControl = { forward: 0, backward: 1, turnLeft: 0, turnRight: 0, fire: 0 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      // Function should execute without error
    })

    it('should handle turn left input', () => {
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 1, turnRight: 0, fire: 0 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      // Function should execute without error
    })

    it('should handle turn right input', () => {
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 1, fire: 0 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      // Function should execute without error
    })

    it('should handle combined inputs', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 1, turnRight: 0, fire: 0 }
      selectedUnits.push(mockApache)

      updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)
      // Function should execute without error
    })
  })

  describe('suspendRemoteControlAutoFocus', () => {
    it('should be a callable function', () => {
      expect(typeof suspendRemoteControlAutoFocus).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => suspendRemoteControlAutoFocus()).not.toThrow()
    })

    it('should handle case when no camera follow unit is set', () => {
      gameState.cameraFollowUnitId = null
      suspendRemoteControlAutoFocus()
      // Should not throw
    })
  })

  describe('enemy unit handling', () => {
    it('should not allow remote control of enemy units by default', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      const enemyApache = {
        id: 10,
        type: 'apache',
        owner: 'enemy',
        x: 400,
        y: 300,
        movement: { isMoving: false, velocity: { x: 0, y: 0 } }
      }

      selectedUnits.push(enemyApache)
      const initialX = enemyApache.x
      updateRemoteControlledUnits([enemyApache], mockBullets, mockMapGrid, mockOccupancyMap)
      // Enemy unit position should not change
      expect(enemyApache.x).toBe(initialX)
    })
  })

  describe('player unit identification', () => {
    it('should recognize player1 units as player units', () => {
      gameState.humanPlayer = 'player1'
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      mockApache.owner = 'player1'
      selectedUnits.push(mockApache)

      // Should process without issues
      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })

    it('should recognize player units as player units', () => {
      gameState.humanPlayer = 'player1'
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      mockApache.owner = 'player'
      selectedUnits.push(mockApache)

      // Should process without issues (player is alias for player1)
      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })
  })

  describe('absolute controls', () => {
    it('should handle absolute wagon direction', () => {
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      gameState.remoteControlAbsolute = { wagonDirection: Math.PI / 4, wagonSpeed: 1 }
      selectedUnits.push(mockApache)

      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })

    it('should handle absolute turret direction', () => {
      gameState.remoteControl = { forward: 0, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      gameState.remoteControlAbsolute = { turretDirection: Math.PI / 2, turretTurnFactor: 1 }
      selectedUnits.push(mockRocketTank)

      expect(() => updateRemoteControlledUnits(mockUnits, mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })
  })

  describe('unit without movement property', () => {
    it('should skip units without movement property', () => {
      gameState.remoteControl = { forward: 1, backward: 0, turnLeft: 0, turnRight: 0, fire: 0 }
      const unitWithoutMovement = {
        id: 99,
        type: 'apache',
        owner: 'player1'
        // No movement property
      }
      selectedUnits.push(unitWithoutMovement)

      // Should not throw
      expect(() => updateRemoteControlledUnits([unitWithoutMovement], mockBullets, mockMapGrid, mockOccupancyMap)).not.toThrow()
    })
  })
})
