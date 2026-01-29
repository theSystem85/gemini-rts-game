/**
 * Tests for src/updateGame.js
 * Main game update loop coordination testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../setup.js'

// Mock dependencies
vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32,
  SMOKE_EMIT_INTERVAL: 500,
  BUILDING_SMOKE_EMIT_INTERVAL: 1000,
  UNIT_SMOKE_SOFT_CAP_RATIO: 0.5,
  MAX_SMOKE_PARTICLES: 100
}))

vi.mock('../../src/utils/smokeUtils.js', () => ({
  emitSmokeParticles: vi.fn()
}))

vi.mock('../../src/performanceUtils.js', () => ({
  logPerformance: vi.fn((fn) => fn)
}))

vi.mock('../../src/enemy.js', () => ({
  updateEnemyAI: vi.fn()
}))

vi.mock('../../src/inputHandler.js', () => ({
  cleanupDestroyedSelectedUnits: vi.fn(),
  getUnitCommandsHandler: vi.fn(() => null)
}))

vi.mock('../../src/buildings.js', () => ({
  updateBuildingsUnderRepair: vi.fn(),
  updateBuildingsAwaitingRepair: vi.fn(),
  buildingData: {
    constructionYard: { health: 1000 },
    turretGunV1: {
      health: 500,
      fireRange: 5,
      fireCooldown: 1000,
      damage: 25
    }
  },
  cacheBuildingSmokeScales: vi.fn(),
  createBuilding: vi.fn(),
  placeBuilding: vi.fn(),
  updatePowerSupply: vi.fn()
}))

vi.mock('../../src/utils.js', () => ({
  handleSelfRepair: vi.fn()
}))

vi.mock('../../src/behaviours/guard.js', () => ({
  updateGuardBehavior: vi.fn()
}))

vi.mock('../../src/main.js', () => ({
  units: []
}))

vi.mock('../../src/game/spatialQuadtree.js', () => ({
  rebuildSpatialQuadtree: vi.fn()
}))

vi.mock('../../src/game/unitMovement.js', () => ({
  updateUnitMovement: vi.fn(),
  updateSpawnExit: vi.fn()
}))

vi.mock('../../src/game/unitCombat.js', () => ({
  updateUnitCombat: vi.fn(),
  cleanupAttackGroupTargets: vi.fn()
}))

vi.mock('../../src/game/harvesterLogic.js', () => ({
  updateHarvesterLogic: vi.fn()
}))

vi.mock('../../src/game/workshopLogic.js', () => ({
  updateWorkshopLogic: vi.fn()
}))

vi.mock('../../src/game/bulletSystem.js', () => ({
  updateBullets: vi.fn()
}))

vi.mock('../../src/game/unitWreckManager.js', () => ({
  updateWreckPhysics: vi.fn()
}))

vi.mock('../../src/game/hospitalLogic.js', () => ({
  updateHospitalLogic: vi.fn()
}))

vi.mock('../../src/game/ambulanceSystem.js', () => ({
  updateAmbulanceLogic: vi.fn()
}))

vi.mock('../../src/game/gasStationLogic.js', () => ({
  updateGasStationLogic: vi.fn()
}))

vi.mock('../../src/game/ammunitionSystem.js', () => ({
  updateAmmunitionSystem: vi.fn()
}))

vi.mock('../../src/game/helipadLogic.js', () => ({
  updateHelipadLogic: vi.fn()
}))

vi.mock('../../src/game/tankerTruckLogic.js', () => ({
  updateTankerTruckLogic: vi.fn()
}))

vi.mock('../../src/game/ammunitionTruckLogic.js', () => ({
  updateAmmunitionTruckLogic: vi.fn()
}))

vi.mock('../../src/game/recoveryTankSystem.js', () => ({
  updateRecoveryTankLogic: vi.fn()
}))

vi.mock('../../src/game/mineSystem.js', () => ({
  updateMines: vi.fn()
}))

vi.mock('../../src/game/mineLayerBehavior.js', () => ({
  updateMineLayerBehavior: vi.fn()
}))

vi.mock('../../src/game/mineSweeperBehavior.js', () => ({
  updateMineSweeperBehavior: vi.fn()
}))

vi.mock('../../src/game/buildingSystem.js', () => ({
  updateBuildings: vi.fn(),
  updateTeslaCoilEffects: vi.fn()
}))

vi.mock('../../src/game/soundCooldownManager.js', () => ({
  cleanupSoundCooldowns: vi.fn()
}))

vi.mock('../../src/game/commandQueue.js', () => ({
  processCommandQueues: vi.fn()
}))

vi.mock('../../src/game/gameStateManager.js', () => ({
  updateMapScrolling: vi.fn(),
  updateCameraFollow: vi.fn(),
  updateOreSpread: vi.fn(),
  updateExplosions: vi.fn(),
  updateSmokeParticles: vi.fn(),
  updateDustParticles: vi.fn(),
  cleanupDestroyedUnits: vi.fn(),
  updateUnitCollisions: vi.fn(),
  updateGameTime: vi.fn(),
  handleRightClickDeselect: vi.fn(),
  cleanupDestroyedFactories: vi.fn(),
  checkGameEndConditions: vi.fn()
}))

vi.mock('../../src/game/pathfinding.js', () => ({
  updateGlobalPathfinding: vi.fn()
}))

vi.mock('../../src/utils/logger.js', () => ({
  logUnitStatus: vi.fn()
}))

vi.mock('../../src/game/remoteControl.js', () => ({
  updateRemoteControlledUnits: vi.fn()
}))

vi.mock('../../src/game/shadowOfWar.js', () => ({
  updateShadowOfWar: vi.fn()
}))

vi.mock('../../src/network/gameCommandSync.js', () => ({
  processPendingRemoteCommands: vi.fn(() => []),
  isHost: vi.fn(() => true),
  COMMAND_TYPES: {
    BUILDING_PLACE: 'BUILDING_PLACE',
    BUILDING_SELL: 'BUILDING_SELL',
    UNIT_MOVE: 'UNIT_MOVE',
    UNIT_ATTACK: 'UNIT_ATTACK',
    UNIT_STOP: 'UNIT_STOP',
    UNIT_GUARD: 'UNIT_GUARD',
    UNIT_SPAWN: 'UNIT_SPAWN'
  },
  updateUnitInterpolation: vi.fn()
}))

vi.mock('../../src/game/dangerZoneMap.js', () => ({
  updateDangerZoneMaps: vi.fn()
}))

vi.mock('../../src/units.js', () => ({
  spawnUnit: vi.fn()
}))

describe('updateGame.js', () => {
  let updateGameModule

  beforeEach(async() => {
    vi.clearAllMocks()
    vi.resetModules()
    updateGameModule = await import('../../src/updateGame.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateGame', () => {
    it('should export updateGame function', () => {
      expect(typeof updateGameModule.updateGame).toBe('function')
    })

    it('should do nothing when game is paused', async() => {
      const { updateGameTime } = await import('../../src/game/gameStateManager.js')

      const gameState = {
        gamePaused: true,
        occupancyMap: []
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      // When paused, updateGameTime should not be called
      expect(updateGameTime).not.toHaveBeenCalled()
    })

    it('should call cleanup functions when game is running', async() => {
      const { cleanupDestroyedSelectedUnits } = await import('../../src/inputHandler.js')
      const { rebuildSpatialQuadtree } = await import('../../src/game/spatialQuadtree.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(cleanupDestroyedSelectedUnits).toHaveBeenCalled()
      expect(rebuildSpatialQuadtree).toHaveBeenCalled()
    })

    it('should update unit movement speeds based on speed multiplier', async() => {
      const gameState = {
        gamePaused: false,
        speedMultiplier: 2,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      const units = [
        { speed: 100, effectiveSpeed: 0 },
        { speed: 50, effectiveSpeed: 0 }
      ]

      updateGameModule.updateGame(16, [], [], units, [], gameState)

      expect(units[0].effectiveSpeed).toBe(200)
      expect(units[1].effectiveSpeed).toBe(100)
    })

    it('should initialize smokeParticles array if not present', async() => {
      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(gameState.smokeParticles).toBeInstanceOf(Array)
    })

    it('should call game system updates when host', async() => {
      const { updateUnitMovement } = await import('../../src/game/unitMovement.js')
      const { updateUnitCombat } = await import('../../src/game/unitCombat.js')
      const { updateBullets } = await import('../../src/game/bulletSystem.js')
      const { updateBuildings } = await import('../../src/game/buildingSystem.js')
      const { updateEnemyAI } = await import('../../src/enemy.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(updateUnitMovement).toHaveBeenCalled()
      expect(updateUnitCombat).toHaveBeenCalled()
      expect(updateBullets).toHaveBeenCalled()
      expect(updateBuildings).toHaveBeenCalled()
      expect(updateEnemyAI).toHaveBeenCalled()
    })

    it('should call map scrolling for UI regardless of host status', async() => {
      const { updateMapScrolling, updateCameraFollow } = await import('../../src/game/gameStateManager.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(updateMapScrolling).toHaveBeenCalled()
      expect(updateCameraFollow).toHaveBeenCalled()
    })

    it('should update visual effects (explosions, smoke, dust)', async() => {
      const { updateExplosions, updateSmokeParticles, updateDustParticles } = await import('../../src/game/gameStateManager.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(updateExplosions).toHaveBeenCalled()
      expect(updateSmokeParticles).toHaveBeenCalled()
      expect(updateDustParticles).toHaveBeenCalled()
    })

    it('should update shadow of war visibility', async() => {
      const { updateShadowOfWar } = await import('../../src/game/shadowOfWar.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(updateShadowOfWar).toHaveBeenCalled()
    })

    it('should handle errors gracefully without crashing', async() => {
      const { updateUnitMovement } = await import('../../src/game/unitMovement.js')
      updateUnitMovement.mockImplementation(() => {
        throw new Error('Test error')
      })

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      // Should not throw
      expect(() => {
        updateGameModule.updateGame(16, [], [], [], [], gameState)
      }).not.toThrow()

      // Reset the mock implementation for subsequent tests
      updateUnitMovement.mockImplementation(vi.fn())
    })

    it('should process remote commands when host', async() => {
      const { processPendingRemoteCommands, isHost } = await import('../../src/network/gameCommandSync.js')
      isHost.mockReturnValue(true)
      processPendingRemoteCommands.mockReturnValue([])

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(processPendingRemoteCommands).toHaveBeenCalled()
    })

    it('should skip game logic for remote clients', async() => {
      const { isHost, updateUnitInterpolation } = await import('../../src/network/gameCommandSync.js')

      isHost.mockReturnValue(false)

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: {
          isRemote: true
        }
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      // Remote clients should use interpolation instead of full update
      expect(updateUnitInterpolation).toHaveBeenCalled()
      // But should still update visuals
    })

    it('should emit smoke for heavily damaged tanks', async() => {
      const { emitSmokeParticles } = await import('../../src/utils/smokeUtils.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      const units = [
        {
          type: 'tank',
          health: 10,
          maxHealth: 100,
          x: 100,
          y: 100,
          direction: 0,
          lastSmokeTime: 0
        }
      ]

      updateGameModule.updateGame(16, [], [], units, [], gameState)

      expect(emitSmokeParticles).toHaveBeenCalled()
    })

    it('should not emit smoke for healthy units', async() => {
      const { emitSmokeParticles } = await import('../../src/utils/smokeUtils.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      const units = [
        {
          type: 'tank',
          health: 90,
          maxHealth: 100,
          x: 100,
          y: 100
        }
      ]

      updateGameModule.updateGame(16, [], [], units, [], gameState)

      // Healthy units (> 25% health) should not emit smoke
      expect(emitSmokeParticles).not.toHaveBeenCalled()
    })

    it('should update mines and mine layer behavior', async() => {
      const { updateMines } = await import('../../src/game/mineSystem.js')
      const { updateMineLayerBehavior } = await import('../../src/game/mineLayerBehavior.js')
      const { updateMineSweeperBehavior } = await import('../../src/game/mineSweeperBehavior.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(updateMines).toHaveBeenCalled()
      expect(updateMineLayerBehavior).toHaveBeenCalled()
      expect(updateMineSweeperBehavior).toHaveBeenCalled()
    })

    it('should check game end conditions', async() => {
      const { checkGameEndConditions } = await import('../../src/game/gameStateManager.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      updateGameModule.updateGame(16, [], [], [], [], gameState)

      expect(checkGameEndConditions).toHaveBeenCalled()
    })

    it('should log unit status for units with logging enabled', async() => {
      const { logUnitStatus } = await import('../../src/utils/logger.js')

      const gameState = {
        gamePaused: false,
        occupancyMap: [],
        smokeParticles: [],
        buildings: [],
        multiplayerSession: null
      }

      const units = [
        { loggingEnabled: true, type: 'tank', health: 100 },
        { loggingEnabled: false, type: 'harvester', health: 100 }
      ]

      updateGameModule.updateGame(16, [], [], units, [], gameState)

      expect(logUnitStatus).toHaveBeenCalledWith(expect.objectContaining({ loggingEnabled: true }))
    })
  })

  describe('updateTeslaCoilEffects', () => {
    it('should re-export updateTeslaCoilEffects', () => {
      expect(typeof updateGameModule.updateTeslaCoilEffects).toBe('function')
    })
  })

  describe('Module exports', () => {
    it('should export updateGame function', () => {
      expect(typeof updateGameModule.updateGame).toBe('function')
    })

    it('should export updateTeslaCoilEffects function', () => {
      expect(typeof updateGameModule.updateTeslaCoilEffects).toBe('function')
    })
  })
})
