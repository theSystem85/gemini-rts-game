import { selectedUnits } from '../inputHandler.js'
import { gameState } from '../gameState.js'
import { getMobileJoystickMapping, isTurretTankUnitType } from '../config.js'
import {
  setRemoteControlAction,
  clearRemoteControlSource
} from '../input/remoteControlState.js'

const JOYSTICK_SIDES = ['left', 'right']
const TAP_SOURCES = {
  left: 'leftJoystickTap',
  right: 'rightJoystickTap'
}
const HOLD_SOURCES = {
  left: 'leftJoystick',
  right: 'rightJoystick'
}
const TAP_PULSE_DURATION = 150

const AXES = ['up', 'down', 'left', 'right']
const MOVEMENT_DEADZONE = 0.25

function createAxisState() {
  return {
    up: 0,
    down: 0,
    left: 0,
    right: 0
  }
}

const joystickState = {
  left: {
    element: null,
    base: null,
    thumb: null,
    pointerId: null,
    startTime: 0,
    moved: false,
    axisIntensities: createAxisState(),
    activeActions: new Map()
  },
  right: {
    element: null,
    base: null,
    thumb: null,
    pointerId: null,
    startTime: 0,
    moved: false,
    axisIntensities: createAxisState(),
    activeActions: new Map()
  }
}

const tapState = {
  left: null,
  right: null
}

let container = null
let initialized = false
let profileWatcherHandle = null
let lastProfile = null

function isFriendlyUnit(unit) {
  if (!unit) {
    return false
  }

  const humanPlayer = gameState.humanPlayer || 'player1'
  if (!unit.owner) {
    return false
  }

  if (unit.owner === humanPlayer) {
    return true
  }

  if (humanPlayer === 'player1' && unit.owner === 'player') {
    return true
  }

  return false
}

function determineCurrentProfile() {
  if (!selectedUnits || selectedUnits.length !== 1) {
    return null
  }

  const [unit] = selectedUnits
  if (!unit || !unit.movement || !isFriendlyUnit(unit)) {
    return null
  }

  return isTurretTankUnitType(unit.type) ? 'tank' : 'vehicle'
}

function isContainerActive() {
  return !!(container && container.getAttribute('aria-hidden') !== 'true')
}

function isJoystickEnabled() {
  if (!isContainerActive()) {
    return false
  }

  return container.getAttribute('data-selection-active') === 'true'
}

function updateThumbPosition(side, dx = 0, dy = 0, radius = 0, active = false) {
  const state = joystickState[side]
  const thumb = state.thumb
  if (!thumb) {
    return
  }

  if (!active || !radius) {
    thumb.style.transform = 'translate(-50%, -50%)'
    thumb.classList.remove('active')
    return
  }

  const distance = Math.hypot(dx, dy) || 1
  const maxRadius = radius * 0.85
  const clampedDistance = Math.min(distance, maxRadius)
  const scale = clampedDistance / distance
  const finalX = dx * scale
  const finalY = dy * scale
  thumb.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`
  thumb.classList.add('active')
}

function applyMappingForSide(side, mapping) {
  const state = joystickState[side]
  const previousActions = state.activeActions
  const nextActions = new Map()
  const source = HOLD_SOURCES[side]

  if (mapping) {
    const sideMapping = mapping[side] || {}
    AXES.forEach((axis) => {
      const intensity = state.axisIntensities[axis] || 0
      if (!intensity) {
        return
      }
      const actions = sideMapping[axis]
      if (!Array.isArray(actions) || actions.length === 0) {
        return
      }
      actions.forEach((action) => {
        const existing = nextActions.get(action) || 0
        if (intensity > existing) {
          nextActions.set(action, intensity)
        }
      })
    })
  }

  nextActions.forEach((intensity, action) => {
    const previousIntensity = previousActions.get(action) || 0
    if (Math.abs(previousIntensity - intensity) > 0.001) {
      setRemoteControlAction(action, source, true, intensity)
    }
  })

  previousActions.forEach((previousIntensity, action) => {
    if (!nextActions.has(action)) {
      setRemoteControlAction(action, source, false, 0)
    }
  })

  state.activeActions = nextActions
}

function updateContainerSelectionVisibility(profile) {
  if (!container) {
    return
  }

  const shouldDisplay = !!profile
  const currentlyDisplayed = container.getAttribute('data-selection-active') === 'true'

  if (shouldDisplay !== currentlyDisplayed) {
    container.setAttribute('data-selection-active', shouldDisplay ? 'true' : 'false')
    if (!shouldDisplay) {
      JOYSTICK_SIDES.forEach((side) => {
        resetJoystick(side)
      })
    }
  }
}

function applyJoystickMappings(force = false, profileOverride = null) {
  const profile = profileOverride !== null ? profileOverride : determineCurrentProfile()
  updateContainerSelectionVisibility(profile)
  if (!force && profile === lastProfile) {
    return
  }

  lastProfile = profile
  const mapping = profile ? getMobileJoystickMapping(profile) : null
  applyMappingForSide('left', mapping)
  applyMappingForSide('right', mapping)
}

function clearTapState(side) {
  const state = tapState[side]
  if (!state) {
    return
  }

  clearTimeout(state.timeoutId)
  state.actions.forEach(action => {
    setRemoteControlAction(action, TAP_SOURCES[side], false)
  })
  tapState[side] = null
}

function triggerTapActions(side) {
  const profile = determineCurrentProfile()
  if (!profile) {
    return
  }

  const mapping = getMobileJoystickMapping(profile)
  if (!mapping || !mapping[side]) {
    return
  }

  const actions = mapping[side].tap || []
  if (!actions.length) {
    return
  }

  clearTapState(side)
  const source = TAP_SOURCES[side]
  actions.forEach(action => setRemoteControlAction(action, source, true, 1))

  const timeoutId = window.setTimeout(() => {
    actions.forEach(action => setRemoteControlAction(action, source, false))
    tapState[side] = null
  }, TAP_PULSE_DURATION)

  tapState[side] = { timeoutId, actions }
}

function resetJoystick(side) {
  const state = joystickState[side]
  if (state.pointerId !== null && state.base) {
    try {
      state.base.releasePointerCapture(state.pointerId)
    } catch {
      // ignore release errors
    }
  }
  state.pointerId = null
  state.startTime = 0
  state.moved = false
  state.axisIntensities = createAxisState()
  state.activeActions = new Map()
  updateThumbPosition(side, 0, 0, 0, false)
  clearRemoteControlSource(HOLD_SOURCES[side])
  clearTapState(side)
  clearRemoteControlSource(TAP_SOURCES[side])
}

function startProfileWatcher() {
  if (profileWatcherHandle !== null || typeof window === 'undefined') {
    return
  }

  const tick = () => {
    profileWatcherHandle = null
    const profile = determineCurrentProfile()
    applyJoystickMappings(false, profile)
    if (isContainerActive()) {
      profileWatcherHandle = window.setTimeout(tick, 150)
    } else {
      lastProfile = null
    }
  }

  profileWatcherHandle = window.setTimeout(tick, 150)
}

function stopProfileWatcher() {
  if (profileWatcherHandle !== null && typeof window !== 'undefined') {
    window.clearTimeout(profileWatcherHandle)
    profileWatcherHandle = null
  }
}

function handlePointerDown(side, event) {
  if (!isJoystickEnabled()) {
    return
  }

  const state = joystickState[side]
  if (!state.base || state.pointerId !== null) {
    return
  }

  event.preventDefault()
  state.pointerId = event.pointerId
  state.startTime = performance.now()
  state.moved = false

  try {
    state.base.setPointerCapture(event.pointerId)
  } catch {
    // Ignore pointer capture failures
  }

  handlePointerMove(side, event, true)
  startProfileWatcher()
}

function handlePointerMove(side, event, fromDown = false) {
  const state = joystickState[side]
  if (state.pointerId !== event.pointerId) {
    return
  }

  event.preventDefault()
  if (!state.base) {
    return
  }

  const rect = state.base.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const dx = event.clientX - centerX
  const dy = event.clientY - centerY
  const radius = rect.width / 2
  const normalizedX = radius ? Math.max(-1, Math.min(dx / radius, 1)) : 0
  const normalizedY = radius ? Math.max(-1, Math.min(dy / radius, 1)) : 0
  const distance = Math.min(Math.hypot(normalizedX, normalizedY), 1)

  const axisIntensities = createAxisState()
  const computeDirectionalIntensity = (value) => {
    if (value <= 0) {
      return 0
    }
    if (value <= MOVEMENT_DEADZONE) {
      return 0
    }
    const scaled = (value - MOVEMENT_DEADZONE) / (1 - MOVEMENT_DEADZONE)
    return Math.max(0, Math.min(scaled, 1))
  }

  axisIntensities.up = computeDirectionalIntensity(Math.max(0, -normalizedY))
  axisIntensities.down = computeDirectionalIntensity(Math.max(0, normalizedY))
  axisIntensities.left = computeDirectionalIntensity(Math.max(0, -normalizedX))
  axisIntensities.right = computeDirectionalIntensity(Math.max(0, normalizedX))

  state.axisIntensities = axisIntensities
  if (distance > MOVEMENT_DEADZONE + 0.02) {
    state.moved = true
  }

  const isActive = axisIntensities.up || axisIntensities.down || axisIntensities.left || axisIntensities.right
  updateThumbPosition(side, dx, dy, radius, !!isActive)
  if (isActive || state.activeActions.size || fromDown) {
    applyJoystickMappings(true)
  }
}

function handlePointerEnd(side, event) {
  const state = joystickState[side]
  if (state.pointerId !== event.pointerId) {
    return
  }

  event.preventDefault()
  const isTap = !state.moved && performance.now() - state.startTime < 250

  resetJoystick(side)
  applyJoystickMappings(true)

  if (isTap) {
    triggerTapActions(side)
  }
}

function attachJoystickEvents(side) {
  const state = joystickState[side]
  if (!state.base) {
    return
  }

  const handleMove = (event) => handlePointerMove(side, event)
  const handleEnd = (event) => handlePointerEnd(side, event)

  state.base.addEventListener('pointerdown', (event) => handlePointerDown(side, event))
  state.base.addEventListener('pointermove', handleMove)
  state.base.addEventListener('pointerup', handleEnd)
  state.base.addEventListener('pointercancel', handleEnd)
}

function initializeJoysticks() {
  if (initialized || typeof document === 'undefined') {
    return
  }

  container = document.getElementById('mobileJoystickContainer')
  if (!container) {
    return
  }

  if (!container.hasAttribute('data-selection-active')) {
    container.setAttribute('data-selection-active', 'false')
  }

  JOYSTICK_SIDES.forEach((side) => {
    const state = joystickState[side]
    state.element = container.querySelector(`[data-joystick="${side}"]`)
    state.base = state.element ? state.element.querySelector('.joystick-base') : null
    state.thumb = state.element ? state.element.querySelector('.joystick-thumb') : null
    state.pointerId = null
    state.startTime = 0
    state.moved = false
    state.axisIntensities = createAxisState()
    state.activeActions = new Map()
    updateThumbPosition(side, 0, 0, 0, false)
    attachJoystickEvents(side)
  })

  initialized = true

  if (isContainerActive()) {
    startProfileWatcher()
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeJoysticks())
  } else {
    initializeJoysticks()
  }

  document.addEventListener('mobile-landscape-layout-changed', (event) => {
    const enabled = !!(event && event.detail && event.detail.enabled)
    if (!enabled) {
      stopProfileWatcher()
      JOYSTICK_SIDES.forEach((side) => {
        resetJoystick(side)
      })
      if (container) {
        container.setAttribute('data-selection-active', 'false')
      }
      lastProfile = null
    } else {
      startProfileWatcher()
      applyJoystickMappings(true)
    }
  })
}
