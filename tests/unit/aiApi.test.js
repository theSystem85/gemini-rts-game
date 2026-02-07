import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TILE_SIZE } from '../../src/config.js'
import { gameState } from '../../src/gameState.js'
import { applyGameTickOutput } from '../../src/ai-api/applier.js'
import { validateGameTickInput, validateGameTickOutput } from '../../src/ai-api/validate.js'
import { createTestMapGrid, resetGameState, createTestFactory, createTestBuilding } from '../testUtils.js'

const earlyGameInput = JSON.parse(
  readFileSync(new URL('../../src/ai-api/examples/early-game-input.json', import.meta.url))
)
const earlyGameOutput = JSON.parse(
  readFileSync(new URL('../../src/ai-api/examples/early-game-output.json', import.meta.url))
)
const combatInput = JSON.parse(
  readFileSync(new URL('../../src/ai-api/examples/combat-input.json', import.meta.url))
)
const combatOutput = JSON.parse(
  readFileSync(new URL('../../src/ai-api/examples/combat-output.json', import.meta.url))
)

describe('LLM Control API validation', () => {
  it('accepts the example payloads', () => {
    const results = {
      earlyInput: validateGameTickInput(earlyGameInput),
      earlyOutput: validateGameTickOutput(earlyGameOutput),
      combatInput: validateGameTickInput(combatInput),
      combatOutput: validateGameTickOutput(combatOutput)
    }

    expect(results.earlyInput.ok).toBe(true)
    expect(results.earlyOutput.ok).toBe(true)
    expect(results.combatInput.ok).toBe(true)
    expect(results.combatOutput.ok).toBe(true)
    expect(results).toMatchSnapshot()
  })
})

describe('LLM Control API applier', () => {
  it('applies building placement and unit production actions', () => {
    const state = resetGameState()
    const mapGrid = createTestMapGrid(24, 24)
    const occupancyMap = Array.from({ length: mapGrid.length }, () => Array(mapGrid[0].length).fill(0))
    const units = []
    const buildings = []
    const factories = []

    state.mapGrid = mapGrid
    state.occupancyMap = occupancyMap
    state.money = 50000

    const constructionYard = createTestFactory(2, 2, 'player1', mapGrid)
    const vehicleFactory = createTestBuilding('vehicleFactory', 12, 2, 'player1', mapGrid)

    factories.push(constructionYard)
    buildings.push(vehicleFactory)

    const output = {
      protocolVersion: '1.0',
      tick: state.frameCount,
      actions: [
        {
          actionId: 'act-build-pp',
          type: 'build_place',
          buildingType: 'powerPlant',
          tilePosition: { x: 6, y: 2, space: 'tile' }
        },
        {
          actionId: 'act-queue-tank',
          type: 'build_queue',
          factoryId: vehicleFactory.id,
          unitType: 'tank_v1',
          count: 1,
          priority: 'normal',
          rallyPoint: { x: 10, y: 8, space: 'tile' }
        }
      ]
    }

    const result = applyGameTickOutput(state, output, {
      units,
      buildings,
      factories,
      mapGrid,
      playerId: 'player1'
    })

    expect(result.rejected).toHaveLength(0)
    expect(result.accepted.map(entry => entry.type)).toEqual(['build_place', 'build_queue'])
    expect(buildings.some(building => building.type === 'powerPlant')).toBe(true)
    expect(units).toHaveLength(1)
  })

  it('applies move and attack commands', () => {
    resetGameState()
    const mapGrid = createTestMapGrid(20, 20)
    const units = [
      {
        id: 'unit_1',
        owner: 'player1',
        x: TILE_SIZE * 5,
        y: TILE_SIZE * 5,
        moveTarget: null,
        target: null,
        guardMode: false,
        guardTarget: null
      },
      {
        id: 'enemy_1',
        owner: 'enemy',
        x: TILE_SIZE * 9,
        y: TILE_SIZE * 5
      }
    ]

    const output = {
      protocolVersion: '1.0',
      tick: gameState.frameCount,
      actions: [
        {
          actionId: 'act-move-1',
          type: 'unit_command',
          unitIds: ['unit_1'],
          command: 'move',
          targetPos: { x: 8, y: 8, space: 'tile' },
          queueMode: 'replace'
        },
        {
          actionId: 'act-attack-1',
          type: 'unit_command',
          unitIds: ['unit_1'],
          command: 'attack',
          targetId: 'enemy_1',
          queueMode: 'replace'
        }
      ]
    }

    const result = applyGameTickOutput(gameState, output, {
      units,
      buildings: [],
      factories: [],
      mapGrid,
      playerId: 'player1'
    })

    const unit = units.find(entry => entry.id === 'unit_1')

    expect(result.rejected).toHaveLength(0)
    expect(unit.moveTarget).toBeNull()
    expect(unit.target).toBe(units[1])
  })
})
