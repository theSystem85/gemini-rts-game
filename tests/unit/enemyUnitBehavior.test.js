import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateAIUnit } from '../../src/ai/enemyUnitBehavior.js'
import { AI_DECISION_INTERVAL, TILE_SIZE } from '../../src/config.js'
import { findPath } from '../../src/units.js'
import { getCachedPath } from '../../src/game/pathfinding.js'
import { applyEnemyStrategies } from '../../src/ai/enemyStrategies.js'

vi.mock('../../src/units.js', () => ({
  findPath: vi.fn(() => [{ x: 0, y: 0 }, { x: 1, y: 1 }])
}))

vi.mock('../../src/game/pathfinding.js', () => ({
  getCachedPath: vi.fn(() => [{ x: 0, y: 0 }, { x: 1, y: 1 }])
}))

vi.mock('../../src/ai/enemyStrategies.js', () => ({
  applyEnemyStrategies: vi.fn(),
  shouldConductGroupAttack: vi.fn(() => false),
  shouldRetreatLowHealth: vi.fn(() => false),
  shouldAIStartAttacking: vi.fn(() => false)
}))

vi.mock('../../src/ai/enemyUtils.js', () => ({
  isEnemyTo: vi.fn(() => true)
}))

vi.mock('../../src/buildings.js', () => ({
  buildingData: { rocketTurret: { fireRange: 16 } }
}))

const createMapGrid = (width = 20, height = 20) =>
  Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'grass' }))
  )

const createGameState = (overrides = {}) => ({
  humanPlayer: 'player',
  buildings: [],
  occupancyMap: { get: () => null },
  ...overrides
})

const createBaseUnit = (overrides = {}) => ({
  id: 'unit-1',
  owner: 'ai',
  type: 'tank',
  health: 100,
  x: 0,
  y: 0,
  tileX: 0,
  tileY: 0,
  path: [],
  ...overrides
})

describe('enemyUnitBehavior updateAIUnit', () => {
  let mapGrid
  let gameState
  let now

  beforeEach(() => {
    mapGrid = createMapGrid()
    gameState = createGameState()
    now = 10000
    vi.clearAllMocks()
  })

  it('resets attack flags after cooldown and returns early for workshop repair', () => {
    const unit = createBaseUnit({
      isBeingAttacked: true,
      lastDamageTime: now - 6000,
      lastAttacker: { id: 'attacker', health: 100 },
      returningToWorkshop: true
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.isBeingAttacked).toBe(false)
    expect(unit.lastAttacker).toBeNull()
  })

  it('clears invalid attacker references when attacker is destroyed', () => {
    const unit = createBaseUnit({
      isBeingAttacked: true,
      lastDamageTime: now - 4000,
      lastAttacker: { id: 'attacker', health: 0 },
      returningToWorkshop: true
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.lastAttacker).toBeNull()
    expect(unit.isBeingAttacked).toBe(false)
  })

  it('keeps disabled crew units in place while firing defensively', () => {
    const attacker = { id: 'attacker', health: 100, x: 32, y: 32, tileX: 1, tileY: 1 }
    const unit = createBaseUnit({
      crew: { driver: false, commander: true, gunner: true },
      isBeingAttacked: true,
      lastAttacker: attacker,
      path: [{ x: 2, y: 2 }],
      moveTarget: { x: 64, y: 64 }
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.target).toBe(attacker)
    expect(unit.moveTarget).toBeNull()
    expect(unit.path).toEqual([])
  })

  it('clears hospital return flags when crew is restored near the hospital', () => {
    const unit = createBaseUnit({
      crew: { driver: true, commander: true, gunner: true },
      returningToHospital: true,
      hospitalTarget: { id: 'hospital-1' },
      needsHospital: true,
      moveTarget: { x: TILE_SIZE, y: TILE_SIZE }
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.returningToHospital).toBe(false)
    expect(unit.hospitalTarget).toBeNull()
    expect(unit.needsHospital).toBe(false)
    expect(unit.moveTarget).toBeNull()
    expect(unit.path).toEqual([])
  })

  it('routes ambulances to hospitals when crew needs refilling', () => {
    const hospital = { id: 'hospital-1', type: 'hospital', owner: 'ai', health: 100, x: 5, y: 5, width: 2, height: 2 }
    gameState.buildings = [hospital]

    const unit = createBaseUnit({
      type: 'ambulance',
      crew: 2,
      tileX: 2,
      tileY: 2
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.refillingTarget).toBe(hospital)
    expect(findPath).toHaveBeenCalled()
    expect(unit.moveTarget).toEqual({
      x: (hospital.x + Math.floor(hospital.width / 2)) * TILE_SIZE,
      y: (hospital.y + hospital.height + 1) * TILE_SIZE
    })
  })

  it('assigns ambulances to heal nearby immobile units', () => {
    const immobileTank = {
      id: 'ally-1',
      owner: 'ai',
      type: 'tank',
      health: 100,
      x: TILE_SIZE * 2,
      y: TILE_SIZE * 2,
      crew: { driver: false, commander: true, gunner: true }
    }

    const unit = createBaseUnit({
      type: 'ambulance',
      crew: 4,
      x: 0,
      y: 0
    })

    updateAIUnit(unit, [unit, immobileTank], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.healingTarget).toBe(immobileTank)
    expect(unit.healingTimer).toBe(0)
    expect(unit.moveTarget).toBeNull()
  })

  it('targets nearby enemy tanks when harvester hunters are threatened', () => {
    const threatTank = {
      id: 'enemy-1',
      owner: 'player',
      type: 'tank',
      health: 100,
      x: TILE_SIZE * 2,
      y: TILE_SIZE * 2
    }

    const unit = createBaseUnit({
      harvesterHunter: true,
      holdInFactory: true,
      spawnedInFactory: true,
      path: [{ x: 1, y: 1 }]
    })

    updateAIUnit(unit, [unit, threatTank], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.holdInFactory).toBe(false)
    expect(unit.spawnedInFactory).toBe(false)
    expect(unit.target).toBe(threatTank)
    expect(unit.allowedToAttack).toBe(true)
    expect(unit.path).toEqual([])
    expect(unit.moveTarget).toBeNull()
    expect(unit.lastDecisionTime).toBe(now)
  })

  it('defends the base by targeting nearby player units', () => {
    const aiBuilding = { id: 'base', owner: 'ai', health: 100, x: 5, y: 5, width: 2, height: 2 }
    const playerUnit = {
      id: 'raider',
      owner: 'player',
      type: 'tank',
      health: 100,
      x: (aiBuilding.x + 1) * TILE_SIZE,
      y: (aiBuilding.y + 1) * TILE_SIZE,
      tileX: aiBuilding.x + 1,
      tileY: aiBuilding.y + 1
    }

    gameState.buildings = [aiBuilding]

    const unit = createBaseUnit({
      x: (aiBuilding.x + 1) * TILE_SIZE,
      y: (aiBuilding.y + 1) * TILE_SIZE,
      tileX: aiBuilding.x + 1,
      tileY: aiBuilding.y + 1
    })

    updateAIUnit(unit, [unit, playerUnit], gameState, mapGrid, now, 'ai', [], [])

    expect(applyEnemyStrategies).toHaveBeenCalled()
    expect(unit.defendingBase).toBe(true)
    expect(unit.target).toBe(playerUnit)
    expect(unit.lastTargetChangeTime).toBe(now)
    expect(getCachedPath).toHaveBeenCalled()
    expect(unit.path.length).toBeGreaterThan(0)
  })

  it('retreats apaches when air defenses are nearby', () => {
    const rocketTank = {
      id: 'rocket-1',
      owner: 'player',
      type: 'rocketTank',
      health: 100,
      x: 0,
      y: 0
    }

    gameState.buildings = [
      { id: 'ai-base', owner: 'ai', health: 100, x: 3, y: 3, width: 2, height: 2 }
    ]

    const unit = createBaseUnit({
      type: 'apache',
      tileX: 1,
      tileY: 1
    })

    updateAIUnit(unit, [unit, rocketTank], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.airDefenseRetreating).toBe(true)
    expect(unit.target).toBeNull()
    expect(findPath).toHaveBeenCalled()
    expect(unit.moveTarget).toBeTruthy()
  })

  it('honors decision intervals before re-evaluating apache targets', () => {
    const unit = createBaseUnit({
      type: 'apache',
      lastDecisionTime: now - AI_DECISION_INTERVAL + 100
    })

    updateAIUnit(unit, [unit], gameState, mapGrid, now, 'ai', [], [])

    expect(unit.target).toBeUndefined()
    expect(unit.moveTarget).toBeUndefined()
    expect(unit.path).toEqual([])
  })
})
