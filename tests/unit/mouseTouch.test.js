import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../src/main.js', () => ({
  factories: [],
  units: [],
  bullets: [],
  mapGrid: [],
  getCurrentGame: vi.fn()
}))

vi.mock('../../src/inputHandler.js', () => ({
  selectedUnits: [],
  getSelectedUnits: vi.fn().mockReturnValue([]),
  setSelectedUnits: vi.fn()
}))

import { setupTouchEvents } from '../../src/input/mouseTouch.js'
import { gameState } from '../../src/gameState.js'
import { handleAltKeyRelease } from '../../src/game/waypointSounds.js'

vi.mock('../../src/game/remoteControl.js', () => ({
  suspendRemoteControlAutoFocus: vi.fn()
}))

vi.mock('../../src/game/waypointSounds.js', () => ({
  handleAltKeyRelease: vi.fn()
}))

const createPointerEvent = (type, { pointerId, clientX, clientY }) => {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerType: { value: 'touch' },
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY }
  })
  return event
}

describe('mouseTouch two-finger tap handling', () => {
  const originalPointerEvent = window.PointerEvent

  beforeEach(() => {
    vi.useFakeTimers()
    window.PointerEvent = function PointerEvent() {}

    gameState.scrollOffset = { x: 0, y: 0 }
    gameState.mapGrid = Array.from({ length: 20 }, () => Array(20).fill({}))
    gameState.buildingPlacementMode = false
    gameState.mobileBuildPaintMode = false
    gameState.selectionActive = false
    gameState.isRightDragging = false
    gameState.altKeyDown = false

    vi.clearAllMocks()
  })

  afterEach(() => {
    window.PointerEvent = originalPointerEvent
    vi.useRealTimers()
  })

  const createHarness = () => {
    const gameCanvas = document.createElement('canvas')
    gameCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
    document.body.appendChild(gameCanvas)

    const handler = {
      activeTouchPointers: new Map(),
      twoFingerPan: null,
      longPressDuration: 450,
      isSelecting: false,
      wasDragging: false,
      attackGroupHandler: { isAttackGroupSelecting: false },
      handleRightMouseDown: vi.fn(),
      handleRightDragScrolling: vi.fn(),
      handleRightMouseUp: vi.fn(),
      handleLeftMouseDown: vi.fn(),
      handleLeftMouseUp: vi.fn(),
      updateEnemyHover: vi.fn(),
      updateSelectionRectangle: vi.fn()
    }

    const selectionManager = {}
    const unitCommands = {}
    const cursorManager = { updateCustomCursor: vi.fn() }

    setupTouchEvents(handler, gameCanvas, [], [], gameState.mapGrid, [], selectionManager, unitCommands, cursorManager)

    return { gameCanvas, handler }
  }

  it('cancels mobile chain planning mode on two-finger tap', () => {
    const { gameCanvas } = createHarness()
    gameState.altKeyDown = true

    gameCanvas.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }))
    gameCanvas.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 20, clientY: 20 }))

    vi.advanceTimersByTime(120)

    gameCanvas.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1, clientX: 10, clientY: 10 }))

    expect(gameState.altKeyDown).toBe(false)
    expect(handleAltKeyRelease).toHaveBeenCalledTimes(1)
  })

  it('does not cancel planning mode during two-finger drag map movement', () => {
    const { gameCanvas } = createHarness()
    gameState.altKeyDown = true

    gameCanvas.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }))
    gameCanvas.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 20, clientY: 20 }))
    gameCanvas.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }))

    vi.advanceTimersByTime(120)

    gameCanvas.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 50 }))

    expect(gameState.altKeyDown).toBe(true)
    expect(handleAltKeyRelease).not.toHaveBeenCalled()
  })
})
