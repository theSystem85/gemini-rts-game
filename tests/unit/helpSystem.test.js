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
    gameState.helpDialogOpen = false
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
    expect(helpOverlay.classList.contains('config-modal')).toBe(true)
    expect(helpOverlay.classList.contains('config-modal--open')).toBe(true)
    expect(helpOverlay.classList.contains('help-dialog-overlay')).toBe(true)
    expect(helpOverlay.innerHTML).toContain('Game Controls')
    expect(helpOverlay.innerHTML).toContain('Map Editor Controls')
    expect(helpOverlay.innerHTML).toContain('Press I again to close')
    expect(document.body.contains(helpOverlay)).toBe(true)
    expect(gameState.helpDialogOpen).toBe(true)
  })

  it('removes the overlay on close and recreates it on re-open', () => {
    helpSystem.showControlsHelp()
    expect(document.getElementById('helpOverlay')).not.toBeNull()

    helpSystem.showControlsHelp()
    expect(document.getElementById('helpOverlay')).toBeNull()

    helpSystem.showControlsHelp()
    expect(document.getElementById('helpOverlay')).not.toBeNull()
    expect(document.querySelectorAll('#helpOverlay').length).toBe(1)
  })

  it('toggles the helpDialogOpen state each time help is shown or hidden', () => {
    expect(gameState.helpDialogOpen).toBeFalsy()

    helpSystem.showControlsHelp()
    expect(gameState.helpDialogOpen).toBe(true)

    helpSystem.showControlsHelp()
    expect(gameState.helpDialogOpen).toBe(false)

    helpSystem.showControlsHelp()
    expect(gameState.helpDialogOpen).toBe(true)
  })
})
