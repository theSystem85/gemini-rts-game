import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '../setup.js'

vi.mock('../../src/buildings.js', () => {
  const buildingData = {
    rocketTurret: { width: 2, height: 2 },
    concreteWall: { width: 1, height: 1 },
    powerPlant: { width: 2, height: 2 }
  }

  return {
    buildingData,
    createBuilding: vi.fn(),
    canPlaceBuilding: vi.fn(),
    placeBuilding: vi.fn(),
    isNearExistingBuilding: vi.fn(),
    isTileValid: vi.fn(),
    updatePowerSupply: vi.fn()
  }
})

vi.mock('../../src/gameState.js', () => ({
  gameState: { humanPlayer: 'player1' }
}))

vi.mock('../../src/ai/enemyUtils.js', () => ({
  isPartOfFactory: vi.fn()
}))

vi.mock('../../src/game/dangerZoneMap.js', () => ({
  updateDangerZoneMaps: vi.fn()
}))

vi.mock('../../src/utils/gameRandom.js', () => ({
  gameRandom: vi.fn(() => 0)
}))

import { findBuildingPosition } from '../../src/ai/enemyBuilding.js'
import { isNearExistingBuilding, isTileValid } from '../../src/buildings.js'
import { isPartOfFactory } from '../../src/ai/enemyUtils.js'
import { gameRandom } from '../../src/utils/gameRandom.js'

const createGrid = (width, height) => Array.from({ length: height }, () => (
  Array.from({ length: width }, () => ({
    type: 'land',
    ore: false,
    building: null,
    seedCrystal: false,
    noBuild: false
  }))
))

describe('enemyBuilding.findBuildingPosition', () => {
  const baseFactory = { id: 'enemy', x: 5, y: 5, width: 2, height: 2 }
  const humanFactory = { id: 'player1', x: 0, y: 0, width: 2, height: 2 }

  beforeEach(() => {
    vi.clearAllMocks()
    isTileValid.mockReturnValue(true)
    isNearExistingBuilding.mockReturnValue(true)
    isPartOfFactory.mockReturnValue(false)
    gameRandom.mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null and logs when buildingType is missing', () => {
    const mapGrid = createGrid(10, 10)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = findBuildingPosition(null, mapGrid, [], [], [baseFactory], 'enemy')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('returns null when mapGrid is empty', () => {
    const result = findBuildingPosition('powerPlant', [], [], [], [baseFactory], 'enemy')

    expect(result).toBeNull()
  })

  it('returns null and logs when buildingType is unknown', () => {
    const mapGrid = createGrid(10, 10)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = findBuildingPosition('unknown', mapGrid, [], [], [baseFactory], 'enemy')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('returns null when the AI factory cannot be found', () => {
    const mapGrid = createGrid(10, 10)

    const result = findBuildingPosition('powerPlant', mapGrid, [], [], [humanFactory], 'enemy')

    expect(result).toBeNull()
  })

  it('places defensive buildings toward nearby ore', () => {
    const mapGrid = createGrid(20, 20)
    mapGrid[6][10].ore = true

    const result = findBuildingPosition(
      'rocketTurret',
      mapGrid,
      [],
      [],
      [baseFactory, humanFactory],
      'enemy'
    )

    expect(result).toEqual({ x: 8, y: 5 })
    expect(isTileValid).toHaveBeenCalled()
  })

  it('allows wall placement next to existing walls when spacing is enforced', () => {
    const mapGrid = createGrid(20, 20)
    mapGrid[6][10].ore = true
    mapGrid[5][7].building = { type: 'concreteWall' }

    const result = findBuildingPosition(
      'concreteWall',
      mapGrid,
      [],
      [],
      [baseFactory, humanFactory],
      'enemy'
    )

    expect(result).toEqual({ x: 8, y: 5 })
  })
})
