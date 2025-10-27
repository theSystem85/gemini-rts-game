import { selectedUnits } from '../inputHandler.js'
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

const joystickState = {
  left: {
    element: null,
    base: null,
    thumb: null,
    pointerId: null,
    direction: 'neutral',
    startTime: 0,
    moved: false,
    activeActions: new Set()
  },
  right: {
    element: null,
    base: null,
    thumb: null,
    pointerId: null,
    direction: 'neutral',
    startTime: 0,
    moved: false,
    activeActions: new Set()
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

function determineCurrentProfile() {
  if (!selectedUnits || selectedUnits.length === 0) {
    return null
  }

  const movableUnits = selectedUnits.filter(unit => unit && unit.movement)
  if (movableUnits.length === 0) {
    return null
  }

  const allTurretTanks = movableUnits.every(unit => isTurretTankUnitType(unit.type))
  return allTurretTanks ? 'tank' : 'vehicle'
}

function isJoystickEnabled() {
  return !!(container && container.getAttribute('aria-hidden') !== 'true')
}

function updateThumbPosition(side, dx = 0, dy = 0, radius = 0, direction = 'neutral') {
  const state = joystickState[side]
  const thumb = state.thumb
  if (!thumb) {
    return
  }

  if (direction === 'neutral') {
    thumb.style.transform = 'translate(-50%, -50%)'
    thumb.classList.remove('active')
    return
  }

  const maxRadius = radius > 0 ? radius * 0.6 : (state.base ? state.base.getBoundingClientRect().width * 0.3 : 0)
  const distance = Math.hypot(dx, dy) || 1
  const scale = distance > 0 ? Math.min(maxRadius / distance, 1) : 0
  const finalX = dx * scale
  const finalY = dy * scale
  thumb.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`
  thumb.classList.add('active')
}

function applyMappingForSide(side, mapping) {
  const state = joystickState[side]
  const previousActions = state.activeActions
  const nextActions = new Set()
  const source = HOLD_SOURCES[side]

  if (mapping && state.direction !== 'neutral') {
    const actions = mapping[side] && mapping[side][state.direction]
    if (Array.isArray(actions)) {
      actions.forEach(action => nextActions.add(action))
    }
  }

  nextActions.forEach(action => {
    setRemoteControlAction(action, source, true)
  })

  previousActions.forEach(action => {
    if (!nextActions.has(action)) {
      setRemoteControlAction(action, source, false)
    }
  })

  state.activeActions = nextActions
}

function applyJoystickMappings(force = false, profileOverride = null) {
  const profile = profileOverride !== null ? profileOverride : determineCurrentProfile()
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
  actions.forEach(action => setRemoteControlAction(action, source, true))

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
  state.direction = 'neutral'
  state.startTime = 0
  state.moved = false
  state.activeActions = new Set()
  updateThumbPosition(side, 0, 0, 0, 'neutral')
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
    if (profile !== lastProfile) {
      applyJoystickMappings(true, profile)
    }
    if (isJoystickEnabled()) {
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
  const threshold = radius * 0.3
  const distance = Math.hypot(dx, dy)

  let newDirection = 'neutral'
  if (distance > threshold) {
    newDirection = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up')
    state.moved = true
  }

  updateThumbPosition(side, dx, dy, radius, newDirection)
  if (newDirection !== state.direction || fromDown) {
    state.direction = newDirection
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

  JOYSTICK_SIDES.forEach((side) => {
    const state = joystickState[side]
    state.element = container.querySelector(`[data-joystick="${side}"]`)
    state.base = state.element ? state.element.querySelector('.joystick-base') : null
    state.thumb = state.element ? state.element.querySelector('.joystick-thumb') : null
    state.pointerId = null
    state.direction = 'neutral'
    state.activeActions = new Set()
    updateThumbPosition(side, 0, 0, 0, 'neutral')
    attachJoystickEvents(side)
  })

  initialized = true

  if (isJoystickEnabled()) {
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
      lastProfile = null
    } else {
      startProfileWatcher()
      applyJoystickMappings(true)
    }
  })
}
