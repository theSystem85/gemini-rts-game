import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    money: 12000,
    humanPlayer: 'player1',
    mapTilesX: 100,
    mapTilesY: 100,
    units: [],
    buildings: [],
    factories: [],
    refineryRevenue: {},
    selectedWreckId: null
  }
}))

vi.mock('../../src/inputHandler.js', () => ({
  selectedUnits: []
}))

vi.mock('../../src/config.js', () => ({
  TILE_SIZE: 32
}))

vi.mock('../../src/ui/tutorialSystem/helpers.js', () => ({
  focusCameraOnPoint: vi.fn()
}))

import { gameState } from '../../src/gameState.js'
import { addMoneyIndicator, updateMoneyBar } from '../../src/ui/moneyBar.js'

describe('moneyBar battle intensity indicator', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="moneyBarContainer"></div>'
    gameState.money = 12000
    gameState.units = []
    gameState.buildings = []
    gameState.factories = []
  })

  it('renders calm threat when no nearby hostiles exist', () => {
    addMoneyIndicator()
    updateMoneyBar()

    const indicator = document.getElementById('battleIntensityIndicator')
    expect(indicator).not.toBeNull()
    expect(indicator?.dataset.level).toBe('calm')
    expect(indicator?.textContent).toContain('Threat CALM')
  })

  it('raises threat level when heavy enemy force is close to base', () => {
    gameState.buildings = [
      { owner: 'player1', type: 'constructionYard', x: 5, y: 5, width: 2, height: 2, health: 1000 }
    ]

    gameState.units = Array.from({ length: 7 }, (_, index) => ({
      id: `enemy_${index}`,
      owner: 'player2',
      type: 'apache',
      x: 6 * 32 + index,
      y: 6 * 32 + index,
      health: 100
    }))

    addMoneyIndicator()
    updateMoneyBar()

    const indicator = document.getElementById('battleIntensityIndicator')
    expect(indicator?.dataset.level).toBe('critical')
    expect(indicator?.textContent).toContain('Threat CRITICAL')
  })
})
