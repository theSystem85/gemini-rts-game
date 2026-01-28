import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32,
  TANK_FIRE_RANGE: 6
}))

vi.mock('../../src/units.js', () => ({
  findPathForOwner: vi.fn()
}))

vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn(),
  playPositionalSound: vi.fn()
}))

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    occupancyMap: [],
    attackGroupTargets: []
  }
}))

vi.mock('../../src/behaviours/retreat.js', () => ({
  cancelRetreatForUnits: vi.fn()
}))

vi.mock('../../src/game/harvesterLogic.js', () => ({
  forceHarvesterUnloadPriority: vi.fn()
}))

vi.mock('../../src/ui/notifications.js', () => ({
  showNotification: vi.fn()
}))

vi.mock('../../src/main.js', () => ({
  units: []
}))

vi.mock('../../src/utils.js', () => ({
  getBuildingIdentifier: vi.fn(() => 'building-id')
}))

vi.mock('../../src/utils/helipadUtils.js', () => ({
  getHelipadLandingCenter: vi.fn(),
  getHelipadLandingTile: vi.fn()
}))

vi.mock('../../src/game/unitWreckManager.js', () => ({
  getWreckById: vi.fn(),
  findNearestWorkshop: vi.fn(),
  releaseWreckAssignment: vi.fn(),
  getRecycleDurationForWreck: vi.fn()
}))

vi.mock('../../src/game/tankerTruckUtils.js', () => ({
  computeTankerKamikazeApproach: vi.fn(),
  clearTankerKamikazeState: vi.fn(),
  updateKamikazeTargetPoint: vi.fn()
}))

vi.mock('../../src/network/gameCommandSync.js', () => ({
  broadcastUnitMove: vi.fn(),
  broadcastUnitAttack: vi.fn()
}))

vi.mock('../../src/game/unifiedMovement.js', () => ({
  resetUnitVelocityForNewPath: vi.fn()
}))

import { UnitCommandsHandler } from '../../src/input/unitCommands.js'
import { findPathForOwner } from '../../src/units.js'
import { playSound } from '../../src/sound.js'
import { showNotification } from '../../src/ui/notifications.js'
import { gameState } from '../../src/gameState.js'
import {
  findNearestWorkshop,
  getRecycleDurationForWreck,
  getWreckById
} from '../../src/game/unitWreckManager.js'
import { units } from '../../src/main.js'

const createMapGrid = (width = 6, height = 6) =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => 0))

describe('UnitCommandsHandler utility queues', () => {
  let handler
  let mapGrid

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new UnitCommandsHandler()
    mapGrid = createMapGrid()
    units.length = 0
    gameState.attackGroupTargets = []
    gameState.occupancyMap = mapGrid
  })

  it('initializes and resets utility queue state when mode changes', () => {
    const unit = {}

    const queue = handler.ensureUtilityQueueState(unit, 'heal')

    expect(queue.mode).toBe('heal')
    expect(queue.targets).toEqual([])
    queue.targets.push({ id: 'u1', type: 'unit' })
    queue.currentTargetId = 'u1'

    handler.ensureUtilityQueueState(unit, 'refuel')

    expect(queue.mode).toBe('refuel')
    expect(queue.targets).toEqual([])
    expect(queue.currentTargetId).toBe(null)
    expect(queue.lockedByUser).toBe(false)
  })

  it('clears utility queue state without removing the queue object', () => {
    const unit = {
      utilityQueue: {
        mode: 'repair',
        targets: [{ id: 'u2', type: 'unit' }],
        currentTargetId: 'u2',
        currentTargetType: 'unit',
        currentTargetAction: 'tow',
        source: 'user',
        lockedByUser: true
      }
    }

    handler.clearUtilityQueueState(unit)

    expect(unit.utilityQueue.mode).toBe(null)
    expect(unit.utilityQueue.targets).toEqual([])
    expect(unit.utilityQueue.currentTargetId).toBe(null)
    expect(unit.utilityQueue.source).toBe(null)
    expect(unit.utilityQueue.lockedByUser).toBe(false)
  })

  it('cancels current utility task state based on unit type', () => {
    const ambulance = { type: 'ambulance', healingTarget: { id: 'u1' }, healingTimer: 5 }
    const tanker = { type: 'tankerTruck', refuelTarget: { id: 'u2' }, refuelTimer: 3, emergencyTarget: 'u3', emergencyMode: true }
    const recovery = {
      type: 'recoveryTank',
      repairTarget: { id: 'u4' },
      repairTargetUnit: { id: 'u4' },
      repairData: { progress: 1 },
      repairStarted: true
    }

    handler.cancelCurrentUtilityTask(ambulance)
    handler.cancelCurrentUtilityTask(tanker)
    handler.cancelCurrentUtilityTask(recovery)

    expect(ambulance.healingTarget).toBe(null)
    expect(ambulance.healingTimer).toBe(0)
    expect(tanker.refuelTarget).toBe(null)
    expect(tanker.refuelTimer).toBe(0)
    expect(tanker.emergencyTarget).toBe(null)
    expect(tanker.emergencyMode).toBe(false)
    expect(recovery.repairTarget).toBe(null)
    expect(recovery.repairTargetUnit).toBe(null)
    expect(recovery.repairData).toBe(null)
    expect(recovery.repairStarted).toBe(false)
  })

  it('validates wreck targets only for repair mode and assigned tanks', () => {
    const serviceUnit = { id: 'rt1', type: 'recoveryTank' }
    const wreck = { id: 'w1', isBeingRestored: false, isBeingRecycled: false, towedBy: null, assignedTankId: null }

    getWreckById.mockReturnValue(wreck)

    expect(handler.isUtilityTargetValid('heal', serviceUnit, { id: 'w1', isWreckTarget: true })).toBe(false)
    expect(handler.isUtilityTargetValid('repair', serviceUnit, { id: 'w1', isWreckTarget: true })).toBe(true)

    getWreckById.mockReturnValue({ ...wreck, assignedTankId: 'rt2' })
    expect(handler.isUtilityTargetValid('repair', serviceUnit, { id: 'w1', isWreckTarget: true })).toBe(false)
  })

  it('validates unit targets based on utility mode requirements', () => {
    const serviceUnit = { id: 'a1', type: 'ambulance', owner: 'player', ammoCargo: 0, maxAmmoCargo: 10 }

    expect(handler.isUtilityTargetValid('heal', serviceUnit, {
      id: 'tank1',
      type: 'tank',
      owner: 'player',
      health: 10,
      crew: { driver: false, gunner: true }
    })).toBe(true)

    expect(handler.isUtilityTargetValid('refuel', serviceUnit, {
      id: 'tank2',
      type: 'tank',
      owner: 'player',
      health: 10,
      gas: 5,
      maxGas: 20
    })).toBe(true)

    expect(handler.isUtilityTargetValid('ammoResupply', serviceUnit, {
      id: 'ammoFactory',
      type: 'ammunitionFactory',
      owner: 'player',
      health: 200
    })).toBe(true)

    expect(handler.isUtilityTargetValid('repair', serviceUnit, {
      id: 'tank3',
      type: 'tank',
      owner: 'player',
      health: 5,
      maxHealth: 10
    })).toBe(true)

    expect(handler.isUtilityTargetValid('repair', serviceUnit, {
      id: 'tank4',
      type: 'tank',
      owner: 'player',
      health: 10,
      maxHealth: 10
    })).toBe(false)
  })

  it('assigns an ambulance to a target and builds movement plan', () => {
    const ambulance = { id: 'amb1', type: 'ambulance', owner: 'player', tileX: 0, tileY: 0, medics: 1, health: 10 }
    const target = { id: 'tank1', type: 'tank', owner: 'player', tileX: 1, tileY: 0, crew: { driver: false, gunner: true } }

    findPathForOwner.mockReturnValue([{ x: 0, y: 0 }, { x: 1, y: 0 }])

    const result = handler.assignAmbulanceToTarget(ambulance, target, mapGrid, { suppressNotifications: true })

    expect(result).toBe(true)
    expect(ambulance.path).toEqual([{ x: 1, y: 0 }])
    expect(ambulance.moveTarget).toEqual({ x: 1, y: 0 })
    expect(ambulance.healingTarget).toBe(target)
    expect(ambulance.healingTimer).toBe(0)
  })

  it('rejects ambulance targets that already have full crew', () => {
    const ambulance = { id: 'amb1', type: 'ambulance', owner: 'player', tileX: 0, tileY: 0, medics: 1, health: 10 }
    const target = { id: 'tank1', type: 'tank', owner: 'player', tileX: 1, tileY: 0, crew: { driver: true, gunner: true } }

    const result = handler.assignAmbulanceToTarget(ambulance, target, mapGrid)

    expect(result).toBe(false)
    expect(showNotification).toHaveBeenCalledWith('Target unit is already fully crewed!', 2000)
  })

  it('assigns a tanker truck to a refuel target', () => {
    const tanker = { id: 'tank1', type: 'tankerTruck', owner: 'player', tileX: 0, tileY: 0, health: 5 }
    const target = { id: 'unit1', type: 'tank', owner: 'player', tileX: 1, tileY: 0, gas: 0, maxGas: 10 }

    findPathForOwner.mockReturnValue([{ x: 0, y: 0 }, { x: 1, y: 0 }])

    const result = handler.assignTankerToTarget(tanker, target, mapGrid, { suppressNotifications: true })

    expect(result).toBe(true)
    expect(tanker.path).toEqual([{ x: 1, y: 0 }])
    expect(tanker.moveTarget).toEqual({ x: 1, y: 0 })
    expect(tanker.refuelTarget).toBe(target)
  })

  it('assigns ammunition trucks for resupply and sets queue metadata', () => {
    const ammoTruck = {
      id: 'ammo1',
      type: 'ammunitionTruck',
      owner: 'player',
      health: 10,
      ammoCargo: 5,
      maxAmmoCargo: 10,
      tileX: 1,
      tileY: 1
    }
    const building = { id: 'b1', type: 'ammunitionFactory', owner: 'player', x: 2, y: 2, width: 2, height: 2, ammo: 0, maxAmmo: 10 }

    findPathForOwner.mockReturnValue([{ x: 1, y: 1 }, { x: 1, y: 2 }])

    const result = handler.assignAmmunitionTruckToTarget(ammoTruck, building, mapGrid, { suppressNotifications: true })

    expect(result).toBe(true)
    expect(ammoTruck.ammoResupplyTarget).toBe(building)
    expect(ammoTruck.ammoResupplyTimer).toBe(0)
    expect(ammoTruck.utilityQueue.currentTargetId).toBe('b1')
    expect(ammoTruck.utilityQueue.currentTargetType).toBe('building')
  })

  it('blocks recovery tasks when another tank is assigned to the wreck', () => {
    const tank = { id: 'rt1', type: 'recoveryTank', owner: 'player', tileX: 0, tileY: 0, health: 10 }
    const wreck = { id: 'w1' }

    getWreckById.mockReturnValue({
      id: 'w1',
      assignedTankId: 'rt2',
      isBeingRestored: false,
      isBeingRecycled: false,
      towedBy: null
    })

    units.push({ id: 'rt2', type: 'recoveryTank', health: 10 })

    const result = handler.assignRecoveryTankToWreck(tank, wreck, mapGrid)

    expect(result).toBe(false)
    expect(showNotification).toHaveBeenCalledWith('Another recovery tank is already assigned to this wreck.', 2000)
  })

  it('assigns recovery tanks to tow wrecks and records workshop data', () => {
    // Recovery tank needs crew with loader for canRecoveryTankRepair to pass
    const tank = {
      id: 'rt1',
      type: 'recoveryTank',
      owner: 'player',
      tileX: 0,
      tileY: 0,
      health: 10,
      crew: { loader: true }
    }
    const wreck = { id: 'w1' }

    // Wreck must have valid coordinates for path computation
    getWreckById.mockReturnValue({
      id: 'w1',
      tileX: 1,
      tileY: 0,
      x: 32,
      y: 0,
      assignedTankId: null,
      isBeingRestored: false,
      isBeingRecycled: false,
      towedBy: null
    })

    findNearestWorkshop.mockReturnValue({
      workshop: { id: 'ws1', owner: 'player', x: 5, y: 5 },
      entryTile: { x: 6, y: 5 }
    })

    findPathForOwner.mockReturnValue([{ x: 0, y: 0 }, { x: 1, y: 0 }])

    const result = handler.assignRecoveryTankToWreck(tank, wreck, mapGrid, { suppressNotifications: true })

    expect(result).toBe(true)
    expect(tank.recoveryTask).toMatchObject({
      wreckId: 'w1',
      mode: 'tow',
      state: 'movingToWreck',
      workshopId: 'ws1',
      workshopOwner: 'player',
      workshopX: 5,
      workshopY: 5,
      workshopEntry: { x: 6, y: 5 }
    })
    expect(tank.guardMode).toBe(false)
    expect(playSound).not.toHaveBeenCalled()
  })

  it('starts the next utility task for queued wreck targets', () => {
    const tank = {
      id: 'rt1',
      type: 'recoveryTank',
      owner: 'player',
      tileX: 0,
      tileY: 0,
      health: 10,
      utilityQueue: {
        mode: 'repair',
        targets: [{ id: 'w2', type: 'wreck', action: 'recycle' }],
        currentTargetId: null,
        currentTargetType: null,
        currentTargetAction: null,
        source: 'user',
        lockedByUser: false
      }
    }

    getWreckById.mockReturnValue({ id: 'w2' })
    getRecycleDurationForWreck.mockReturnValue(10)
    vi.spyOn(handler, 'isUtilityTargetValid').mockReturnValue(true)
    vi.spyOn(handler, 'assignRecoveryTankToWreck').mockReturnValue(true)

    const result = handler.startNextUtilityTask(tank, mapGrid, true)

    expect(result).toBe(true)
    expect(handler.assignRecoveryTankToWreck).toHaveBeenCalledWith(
      tank,
      { id: 'w2' },
      mapGrid,
      { suppressNotifications: true, mode: 'recycle' }
    )
    expect(tank.utilityQueue.currentTargetId).toBe('w2')
    expect(tank.utilityQueue.currentTargetType).toBe('wreck')
    expect(tank.utilityQueue.currentTargetAction).toBe('recycle')
  })

  it('reports queue position for current and queued targets', () => {
    const unit = {
      utilityQueue: {
        currentTargetId: 'u1',
        currentTargetType: 'unit',
        targets: [{ id: 'u2', type: 'unit' }, { id: 'w1', type: 'wreck' }]
      }
    }

    expect(handler.getUtilityQueuePosition(unit, { id: 'u1' })).toBe(1)
    expect(handler.getUtilityQueuePosition(unit, { id: 'u2' })).toBe(2)
    expect(handler.getUtilityQueuePosition(unit, { id: 'w1', isWreckTarget: true })).toBe(3)
  })
})
