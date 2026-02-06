import { selectedUnits, getKeyboardHandler } from '../inputHandler.js'
import { gameState } from '../gameState.js'
import { showNotification } from './notifications.js'

const LONG_PRESS_MS = 420

const controlGroupsState = {
  initialized: false,
  panel: null,
  button: null,
  assignToggle: null,
  hint: null,
  buttons: []
}

function ensureElements() {
  if (!controlGroupsState.panel || !controlGroupsState.panel.isConnected) {
    controlGroupsState.panel = document.getElementById('mobileControlGroupsPanel')
  }
  if (!controlGroupsState.button || !controlGroupsState.button.isConnected) {
    controlGroupsState.button = document.getElementById('controlGroupsBtn')
  }
  if (!controlGroupsState.assignToggle || !controlGroupsState.assignToggle.isConnected) {
    controlGroupsState.assignToggle = document.getElementById('mobileControlGroupsAssignToggle')
  }
  if (!controlGroupsState.hint || !controlGroupsState.hint.isConnected) {
    controlGroupsState.hint = controlGroupsState.panel?.querySelector('.mobile-control-groups__hint') || null
  }
  if (!controlGroupsState.buttons.length || !controlGroupsState.buttons.every(btn => btn.isConnected)) {
    controlGroupsState.buttons = Array.from(
      controlGroupsState.panel?.querySelectorAll('.mobile-control-groups__button') || []
    )
  }

  return Boolean(
    controlGroupsState.panel &&
    controlGroupsState.button &&
    controlGroupsState.assignToggle &&
    controlGroupsState.buttons.length
  )
}

function setPanelVisible(visible) {
  const { panel, button } = controlGroupsState
  if (!panel || !button) return
  panel.classList.toggle('visible', visible)
  panel.setAttribute('aria-hidden', visible ? 'false' : 'true')
  button.setAttribute('aria-expanded', visible ? 'true' : 'false')
  if (!visible) {
    setAssignMode(false)
  }
}

function setAssignMode(active) {
  const { panel, assignToggle, hint } = controlGroupsState
  if (!panel || !assignToggle) return
  panel.classList.toggle('assign-mode', active)
  assignToggle.setAttribute('aria-pressed', active ? 'true' : 'false')
  if (hint) {
    hint.textContent = active
      ? 'Tap a number to assign selected units.'
      : 'Tap a number to select. Hold to assign.'
  }
}

function ensureSelectionAvailable() {
  if (selectedUnits.length > 0) return true
  showNotification('Select units before assigning a group.', 2200)
  return false
}

function getGroupNumber(button) {
  return button?.dataset?.group || ''
}

function handleSelectGroup(groupNum) {
  const keyboardHandler = getKeyboardHandler()
  if (!keyboardHandler) return
  if (!gameState.mapGrid || !gameState.mapGrid.length) return
  keyboardHandler.handleControlGroupSelection(
    groupNum,
    gameState.units || [],
    selectedUnits,
    gameState.mapGrid
  )
}

function handleAssignGroup(groupNum) {
  const keyboardHandler = getKeyboardHandler()
  if (!keyboardHandler) return
  if (!ensureSelectionAvailable()) return
  keyboardHandler.handleControlGroupAssignment(groupNum, selectedUnits)
}

function handleGroupButtonPress(button, event) {
  let holdTimer = null
  let holdTriggered = false
  const groupNum = getGroupNumber(button)

  const clearHold = () => {
    if (holdTimer) {
      window.clearTimeout(holdTimer)
      holdTimer = null
    }
  }

  const startHold = () => {
    clearHold()
    holdTimer = window.setTimeout(() => {
      holdTriggered = true
      if (ensureSelectionAvailable()) {
        setAssignMode(true)
        handleAssignGroup(groupNum)
      } else {
        setAssignMode(false)
      }
    }, LONG_PRESS_MS)
  }

  const onPointerUp = () => {
    clearHold()
    if (!holdTriggered) {
      const isAssignMode = controlGroupsState.panel?.classList.contains('assign-mode')
      if (isAssignMode) {
        handleAssignGroup(groupNum)
      } else {
        handleSelectGroup(groupNum)
      }
    }
    button.removeEventListener('pointerup', onPointerUp)
    button.removeEventListener('pointercancel', onPointerUp)
    button.removeEventListener('pointerleave', onPointerUp)
  }

  if (event.pointerType === 'mouse' && event.button !== 0) return
  holdTriggered = false
  startHold()
  button.addEventListener('pointerup', onPointerUp)
  button.addEventListener('pointercancel', onPointerUp)
  button.addEventListener('pointerleave', onPointerUp)
}

function attachGroupButtonHandlers() {
  controlGroupsState.buttons.forEach(button => {
    if (button.dataset.controlGroupsAttached === 'true') return
    button.dataset.controlGroupsAttached = 'true'
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      handleGroupButtonPress(button, event)
    })
  })
}

function attachToggleHandlers() {
  const { button, assignToggle } = controlGroupsState
  if (!button || !assignToggle) return

  if (button.dataset.controlGroupsAttached !== 'true') {
    button.dataset.controlGroupsAttached = 'true'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const isVisible = controlGroupsState.panel?.classList.contains('visible')
      setPanelVisible(!isVisible)
    })
  }

  if (assignToggle.dataset.controlGroupsAttached !== 'true') {
    assignToggle.dataset.controlGroupsAttached = 'true'
    assignToggle.addEventListener('click', (event) => {
      event.preventDefault()
      const active = controlGroupsState.panel?.classList.contains('assign-mode')
      if (!active && !ensureSelectionAvailable()) return
      setAssignMode(!active)
    })
  }

  if (!controlGroupsState.panel?.dataset?.controlGroupsDismissAttached) {
    controlGroupsState.panel.dataset.controlGroupsDismissAttached = 'true'
    document.addEventListener('pointerdown', (event) => {
      if (!controlGroupsState.panel?.classList.contains('visible')) return
      const target = event.target
      if (controlGroupsState.panel.contains(target)) return
      if (controlGroupsState.button?.contains(target)) return
      setPanelVisible(false)
    })
  }
}

function initializeMobileControlGroups() {
  if (controlGroupsState.initialized || typeof document === 'undefined') return
  if (!ensureElements()) return
  attachGroupButtonHandlers()
  attachToggleHandlers()
  controlGroupsState.initialized = true
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMobileControlGroups)
  } else {
    initializeMobileControlGroups()
  }
}

export { initializeMobileControlGroups }
