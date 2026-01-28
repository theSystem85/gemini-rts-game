/**
 * Tests for HelpSystem
 *
 * Focused on DOM overlay creation, visibility toggling,
 * and game pause state interactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import '../setup.js'
import { HelpSystem } from '../../src/input/helpSystem.js'
import { gameState } from '../../src/gameState.js'
import { resetGameState } from '../testUtils.js'

describe('helpSystem.js', () => {
  let helpSystem

  beforeEach(() => {
    resetGameState()
    gameState.paused = false
    helpSystem = new HelpSystem()

    const existingOverlay = document.getElementById('helpOverlay')
    if (existingOverlay) {
      existingOverlay.remove()
    }
  })

  afterEach(() => {
    const existingOverlay = document.getElementById('helpOverlay')
    if (existingOverlay) {
      existingOverlay.remove()
    }
  })

  it('creates the help overlay with expected content and styles', () => {
    helpSystem.showControlsHelp()

    const helpOverlay = document.getElementById('helpOverlay')

    expect(helpOverlay).not.toBeNull()
    expect(helpOverlay.style.position).toBe('absolute')
    expect(helpOverlay.style.background).toContain('linear-gradient')
    expect(helpOverlay.style.zIndex).toBe('1000')
    expect(helpOverlay.innerHTML).toContain('Game Controls')
    expect(helpOverlay.innerHTML).toContain('Map Editor Controls')
    expect(helpOverlay.innerHTML).toContain('Press I again to close')
    expect(document.body.contains(helpOverlay)).toBe(true)
    expect(gameState.paused).toBe(true)
  })

  it('toggles overlay visibility without recreating the element', () => {
    helpSystem.showControlsHelp()

    const firstOverlay = document.getElementById('helpOverlay')
    expect(firstOverlay).not.toBeNull()

    helpSystem.showControlsHelp()
    expect(firstOverlay.style.display).toBe('none')
    expect(document.querySelectorAll('#helpOverlay').length).toBe(1)

    helpSystem.showControlsHelp()
    expect(firstOverlay.style.display).toBe('block')
    expect(document.querySelectorAll('#helpOverlay').length).toBe(1)
  })

  it('toggles the paused state each time help is shown or hidden', () => {
    expect(gameState.paused).toBe(false)

    helpSystem.showControlsHelp()
    expect(gameState.paused).toBe(true)

    helpSystem.showControlsHelp()
    expect(gameState.paused).toBe(false)

    helpSystem.showControlsHelp()
    expect(gameState.paused).toBe(true)
  })
})
