import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGameState, createTestMapGrid } from '../testUtils.js'

vi.mock('../../src/units.js', () => ({
  findPathForOwner: vi.fn()
}))

vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn(),
  playPositionalSound: vi.fn()
}))

vi.mock('../../src/input/helpSystem.js', () => ({
  HelpSystem: class {
    showControlsHelp() {}
  }
}))

vi.mock('../../src/input/cheatSystem.js', () => ({
  CheatSystem: class {
    setSelectedUnitsRef() {}
    updateNewUnit() {}
    cleanupDestroyedUnit() {}
    openDialog() {}
  }
}))

vi.mock('../../src/utils/inputUtils.js', () => ({
  isInputFieldFocused: () => false
}))

vi.mock('../../src/utils/logger.js', () => ({
  toggleUnitLogging: vi.fn()
}))

vi.mock('../../src/game/unifiedMovement.js', () => ({
  cancelUnitMovement: vi.fn()
}))

vi.mock('../../src/game/waypointSounds.js', () => ({
  handleAltKeyRelease: vi.fn(),
  resetWaypointTracking: vi.fn()
}))

vi.mock('../../src/ui/performanceDialog.js', () => ({
  performanceDialog: {
    isOpen: () => false,
    toggleDialog: vi.fn()
  }
}))

vi.mock('../../src/ui/runtimeConfigDialog.js', () => ({
  runtimeConfigDialog: {
    openDialog: vi.fn(),
    isOpen: () => false,
    toggleDialog: vi.fn()
  }
}))

vi.mock('../../src/input/cursorStyles.js', () => ({
  GAME_DEFAULT_CURSOR: 'default'
}))

vi.mock('../../src/input/remoteControlState.js', () => ({
  setRemoteControlAction: vi.fn(),
  getRemoteControlActionState: vi.fn(() => ({}))
}))

vi.mock('../../src/network/gameCommandSync.js', () => ({
  broadcastUnitStop: vi.fn()
}))

vi.mock('../../src/input/keybindings.js', () => ({
  keybindingManager: {
    matchesKeyboardAction: vi.fn(() => false),
    matchesMouseAction: vi.fn(() => false)
  },
  KEYBINDING_CONTEXTS: {
    DEFAULT: 'gameplay',
    MAP_EDIT_ON: 'map-edit-on',
    MAP_EDIT_OFF: 'map-edit-off'
  }
}))

vi.mock('../../src/utils/layoutMetrics.js', () => ({
  getPlayableViewportHeight: vi.fn(() => 200),
  getPlayableViewportWidth: vi.fn(() => 300)
}))

vi.mock('../../src/benchmark/benchmarkTracker.js', () => ({
  notifyBenchmarkManualCameraControl: vi.fn()
}))

vi.mock('../../src/utils/gameRandom.js', () => ({
  gameRandom: {
    random: vi.fn(() => 0.5)
  }
}))

import { KeyboardHandler } from '../../src/input/keyboardHandler.js'
import { gameState } from '../../src/gameState.js'
import { playSound } from '../../src/sound.js'

const createUnit = (overrides = {}) => ({
  id: 'unit',
  x: 0,
  y: 0,
  health: 100,
  owner: gameState.humanPlayer,
  selected: false,
  ...overrides
})

describe('control group handling (keyboardHandler)', () => {
  beforeEach(() => {
    resetGameState()
    gameState.humanPlayer = 'player1'
    document.body.innerHTML = ''

    const canvas = document.createElement('canvas')
    canvas.id = 'gameCanvas'
    document.body.appendChild(canvas)

    vi.clearAllMocks()
  })

  it('assigns control groups to player-owned units and skips factories', () => {
    const handler = new KeyboardHandler()
    handler.showNotification = vi.fn()

    const playerUnit = createUnit({ id: 'u1', type: 'tank' })
    const factoryUnit = createUnit({ id: 'u2', type: 'factory' })
    const enemyUnit = createUnit({ id: 'u3', type: 'tank', owner: 'enemy' })
    const selectedUnits = [playerUnit, factoryUnit, enemyUnit]

    handler.handleControlGroupAssignment(1, selectedUnits)

    expect(handler.controlGroups[1]).toEqual([playerUnit])
    expect(playerUnit.groupNumber).toBe(1)
    expect(factoryUnit.groupNumber).toBeUndefined()
    expect(enemyUnit.groupNumber).toBeUndefined()
    expect(playSound).toHaveBeenCalledWith('unitSelection')
    expect(handler.showNotification).toHaveBeenCalledWith('Group 1 assigned', 2000)
  })

  it('selects only alive units in a control group and clears existing selection', () => {
    const handler = new KeyboardHandler()
    const mapGrid = createTestMapGrid(8, 8)

    const aliveUnit = createUnit({ id: 'u1', x: 50, y: 60, selected: true })
    const deadUnit = createUnit({ id: 'u2', health: 0, selected: true })
    const missingUnit = createUnit({ id: 'u3' })
    const units = [aliveUnit, deadUnit]
    const selectedUnits = [aliveUnit, deadUnit]

    gameState.factories = [{ id: 'f1', selected: true }]
    handler.controlGroups[2] = [aliveUnit, deadUnit, missingUnit]

    handler.handleControlGroupSelection(2, units, selectedUnits, mapGrid)

    expect(handler.controlGroups[2]).toEqual([aliveUnit])
    expect(selectedUnits).toEqual([aliveUnit])
    expect(aliveUnit.selected).toBe(true)
    expect(deadUnit.selected).toBe(false)
    expect(gameState.factories[0].selected).toBe(false)
    expect(playSound).toHaveBeenCalledWith('unitSelection')
    expect(handler.lastGroupKeyPressed).toBe(2)
    expect(handler.lastGroupKeyPressTime).toBeGreaterThan(0)
  })

  it('centers the camera when the same control group is double-pressed', () => {
    const handler = new KeyboardHandler()
    handler.requestRenderFrame = vi.fn()

    const unitA = createUnit({ id: 'u1', x: 50, y: 60 })
    const unitB = createUnit({ id: 'u2', x: 200, y: 220 })
    const unitC = createUnit({ id: 'u3', x: 300, y: 350 })
    const units = [unitA, unitB, unitC]
    const selectedUnits = []
    const mapGrid = createTestMapGrid(10, 10)

    handler.controlGroups[3] = [unitA, unitB, unitC]
    handler.lastGroupKeyPressed = 3
    handler.lastGroupKeyPressTime = 1000

    vi.spyOn(performance, 'now').mockReturnValue(1200)

    handler.handleControlGroupSelection(3, units, selectedUnits, mapGrid)

    expect(gameState.scrollOffset.x).toBe(20)
    expect(gameState.scrollOffset.y).toBe(120)
    expect(playSound).toHaveBeenCalledWith('confirmed')
    expect(handler.requestRenderFrame).toHaveBeenCalled()
    expect(handler.lastGroupKeyPressed).toBe(3)
    expect(handler.lastGroupKeyPressTime).toBe(1200)
  })

  it('rebuilds control groups from unit group numbers', () => {
    const handler = new KeyboardHandler()

    const units = [
      createUnit({ id: 'u1', groupNumber: 1 }),
      createUnit({ id: 'u2', groupNumber: 2 }),
      null,
      createUnit({ id: 'u3' })
    ]

    handler.rebuildControlGroupsFromUnits(units)

    expect(handler.controlGroups).toEqual({
      1: [units[0]],
      2: [units[1]]
    })
  })

  it('handles invalid unit lists when rebuilding control groups', () => {
    const handler = new KeyboardHandler()

    handler.controlGroups = { 1: [createUnit({ id: 'old' })] }
    handler.rebuildControlGroupsFromUnits(null)

    expect(handler.controlGroups).toEqual({})
  })
})
