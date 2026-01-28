/**
 * Unit tests for network command synchronization helpers and state hashing.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock buildings module to prevent benchmarkScenario.js from failing
vi.mock('../../src/buildings.js', () => ({
  buildingData: {
    constructionYard: { power: 0, cost: 5000 },
    powerPlant: { power: 100, cost: 300 },
    vehicleFactory: { power: -30, cost: 1000 }
  },
  placeBuilding: vi.fn(),
  canPlaceBuilding: vi.fn().mockReturnValue(true),
  createBuilding: vi.fn(),
  updatePowerSupply: vi.fn()
}))

// Mock main.js to prevent initialization issues
vi.mock('../../src/main.js', () => ({
  factories: [],
  units: [],
  bullets: [],
  mapGrid: [],
  getCurrentGame: vi.fn(),
  regenerateMapForClient: vi.fn()
}))

// Mock gameState
vi.mock('../../src/gameState.js', () => ({
  gameState: {
    humanPlayer: 'player1',
    buildings: [],
    units: [],
    money: 1000
  }
}))

// Mock config
vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32,
  setMapDimensions: vi.fn(),
  ORE_SPREAD_ENABLED: false,
  setOreSpreadEnabled: vi.fn()
}))

// Mock other dependencies
vi.mock('../../src/network/remoteConnection.js', () => ({
  getActiveRemoteConnection: vi.fn()
}))

vi.mock('../../src/network/webrtcSession.js', () => ({
  getActiveHostMonitor: vi.fn()
}))

vi.mock('../../src/network/lockstepManager.js', () => ({
  lockstepManager: {},
  LOCKSTEP_CONFIG: {},
  MS_PER_TICK: 16
}))

vi.mock('../../src/network/deterministicRandom.js', () => ({
  deterministicRNG: { random: vi.fn().mockReturnValue(0.5) },
  initializeSessionRNG: vi.fn(),
  syncRNGForTick: vi.fn()
}))

vi.mock('../../src/network/inputBuffer.js', () => ({
  InputBuffer: class {},
  LOCKSTEP_INPUT_TYPES: {},
  createLockstepInput: vi.fn()
}))

import {
  createMoveCommand,
  createAttackCommand,
  createBuildingPlaceCommand,
  createProductionCommand
} from '../../src/network/gameCommandSync.js'
import {
  compareHashes,
  computeStateHash,
  computeQuickHash,
  createHashReport,
  hashArrayOrdered
} from '../../src/network/stateHash.js'

describe('command sync helpers', () => {
  it('creates move command payloads with normalized unitIds', () => {
    expect(createMoveCommand('unit-1', 10, 12)).toEqual({
      unitIds: ['unit-1'],
      targetX: 10,
      targetY: 12
    })

    expect(createMoveCommand(['unit-1', 'unit-2'], 3, 4)).toEqual({
      unitIds: ['unit-1', 'unit-2'],
      targetX: 3,
      targetY: 4
    })
  })

  it('creates attack command payloads with normalized unitIds', () => {
    expect(createAttackCommand('unit-1', 'target-9', 'unit')).toEqual({
      unitIds: ['unit-1'],
      targetId: 'target-9',
      targetType: 'unit'
    })

    expect(createAttackCommand(['unit-1', 'unit-2'], 'building-3', 'building')).toEqual({
      unitIds: ['unit-1', 'unit-2'],
      targetId: 'building-3',
      targetType: 'building'
    })
  })

  it('creates building placement payloads', () => {
    expect(createBuildingPlaceCommand('powerPlant', 8, 9)).toEqual({
      buildingType: 'powerPlant',
      x: 8,
      y: 9
    })
  })

  it('creates production payloads', () => {
    expect(createProductionCommand('unit', 'tank', 'factory-1')).toEqual({
      productionType: 'unit',
      itemType: 'tank',
      factoryId: 'factory-1'
    })
  })
})

describe('state hash helpers', () => {
  const baseState = {
    units: [
      {
        id: 'unit-1',
        type: 'tank',
        owner: 'player-1',
        x: 10.12,
        y: 20.34,
        tileX: 1,
        tileY: 2,
        health: 80,
        maxHealth: 100,
        direction: 0.25,
        turretDirection: 0.5,
        gas: 40,
        ammunition: 5,
        oreCarried: 0,
        path: [{ x: 1, y: 2 }],
        moveTarget: { x: 64, y: 96 },
        target: { id: 'unit-2' },
        level: 2,
        bountyCounter: 1
      },
      {
        id: 'unit-2',
        type: 'harvester',
        owner: 'player-2',
        x: 40,
        y: 52,
        tileX: 2,
        tileY: 3,
        health: 120,
        maxHealth: 120,
        direction: 1.1
      }
    ],
    buildings: [
      {
        id: 'building-1',
        type: 'refinery',
        owner: 'player-1',
        x: 5,
        y: 6,
        health: 200,
        maxHealth: 200,
        constructionFinished: true
      },
      {
        id: 'building-2',
        type: 'powerPlant',
        owner: 'player-2',
        x: 7,
        y: 9,
        health: 150,
        maxHealth: 150,
        constructionFinished: false,
        constructionProgress: 0.4
      }
    ],
    bullets: [
      {
        id: 1,
        x: 12,
        y: 13,
        targetX: 40,
        targetY: 50,
        damage: 15,
        owner: 'player-1',
        type: 'cannon'
      }
    ],
    mines: [
      {
        id: 3,
        owner: 'player-2',
        x: 9,
        y: 10,
        health: 30,
        armed: true
      }
    ],
    partyStates: [
      { partyId: 'player-1', money: 1200 },
      { partyId: 'player-2', money: 800 }
    ],
    money: 500
  }

  it('computes deterministic hashes independent of array ordering', () => {
    const tick = 42
    const hashA = computeStateHash(baseState, tick)
    const reorderedState = {
      ...baseState,
      units: [...baseState.units].reverse(),
      buildings: [...baseState.buildings].reverse(),
      bullets: [...baseState.bullets].reverse(),
      mines: [...baseState.mines].reverse()
    }
    const hashB = computeStateHash(reorderedState, tick)

    expect(hashA).toBe(hashB)
  })

  it('changes hashes when important state changes occur', () => {
    const tick = 42
    const hashA = computeStateHash(baseState, tick)
    const changedState = {
      ...baseState,
      units: baseState.units.map(unit =>
        unit.id === 'unit-1' ? { ...unit, health: unit.health - 10 } : unit
      )
    }
    const hashB = computeStateHash(changedState, tick)

    expect(hashA).not.toBe(hashB)
  })

  it('changes hashes when tick changes', () => {
    const hashA = computeStateHash(baseState, 10)
    const hashB = computeStateHash(baseState, 11)

    expect(hashA).not.toBe(hashB)
  })

  it('compares hashes for equality', () => {
    const hashA = computeStateHash(baseState, 8)
    const hashB = computeStateHash(baseState, 8)
    const hashC = computeStateHash(baseState, 9)

    expect(compareHashes(hashA, hashB)).toBe(true)
    expect(compareHashes(hashA, hashC)).toBe(false)
  })

  it('computes quick hashes based on entity counts and totals', () => {
    const tick = 12
    const hashA = computeQuickHash(baseState, tick)
    const changedState = {
      ...baseState,
      units: baseState.units.map(unit =>
        unit.id === 'unit-2' ? { ...unit, health: unit.health + 20 } : unit
      )
    }
    const hashB = computeQuickHash(changedState, tick)

    expect(hashA).not.toBe(hashB)
  })

  it('builds detailed hash reports with full hash included', () => {
    const tick = 30
    const report = createHashReport(baseState, tick)

    expect(report).toMatchObject({
      tick,
      unitCount: 2,
      buildingCount: 2,
      bulletCount: 1,
      mineCount: 1,
      money: 500
    })
    expect(report.fullHash).toBe(computeStateHash(baseState, tick))
  })

  it('hashes ordered collections in order', () => {
    const hashA = hashArrayOrdered([1, 2, 3], value => value)
    const hashB = hashArrayOrdered([3, 2, 1], value => value)

    expect(hashA).not.toBe(hashB)
  })
})
