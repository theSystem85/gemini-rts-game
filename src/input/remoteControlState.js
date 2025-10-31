import { gameState } from '../gameState.js'

const REMOTE_CONTROL_ACTIONS = [
  'forward',
  'backward',
  'turnLeft',
  'turnRight',
  'turretLeft',
  'turretRight',
  'strafeLeft',
  'strafeRight',
  'ascend',
  'descend',
  'fire'
]

const DEFAULT_ABSOLUTE_STATE = {
  wagonDirection: null,
  wagonSpeed: 0,
  turretDirection: null,
  turretTurnFactor: 0
}

function clampIntensity(value) {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value <= 0) {
    return 0
  }
  if (value >= 1) {
    return 1
  }
  return value
}

function ensureRemoteControlSources() {
  if (!gameState.remoteControlSources) {
    gameState.remoteControlSources = {}
  }

  for (const action of REMOTE_CONTROL_ACTIONS) {
    if (!gameState.remoteControlSources[action]) {
      gameState.remoteControlSources[action] = {}
    }
    if (typeof gameState.remoteControl[action] !== 'number') {
      gameState.remoteControl[action] = 0
    }
  }
}

function ensureRemoteControlAbsolute() {
  if (!gameState.remoteControlAbsolute || typeof gameState.remoteControlAbsolute !== 'object') {
    gameState.remoteControlAbsolute = { ...DEFAULT_ABSOLUTE_STATE }
  }
  if (!gameState.remoteControlAbsoluteSources || typeof gameState.remoteControlAbsoluteSources !== 'object') {
    gameState.remoteControlAbsoluteSources = {}
  }
}

function recomputeAbsolute() {
  ensureRemoteControlAbsolute()
  const sources = gameState.remoteControlAbsoluteSources || {}
  let bestWagon = null
  let bestTurret = null

  for (const value of Object.values(sources)) {
    if (!value || typeof value !== 'object') {
      continue
    }

    if (value.wagonDirection !== null && Number.isFinite(value.wagonDirection)) {
      const speed = clampIntensity(value.wagonSpeed)
      if (speed > 0 && (!bestWagon || speed > bestWagon.wagonSpeed)) {
        bestWagon = {
          wagonDirection: value.wagonDirection,
          wagonSpeed: speed
        }
      }
    }

    if (value.turretDirection !== null && Number.isFinite(value.turretDirection)) {
      const factor = clampIntensity(value.turretTurnFactor)
      if (factor > 0 && (!bestTurret || factor > bestTurret.turretTurnFactor)) {
        bestTurret = {
          turretDirection: value.turretDirection,
          turretTurnFactor: factor
        }
      }
    }
  }

  const absolute = gameState.remoteControlAbsolute
  if (bestWagon) {
    absolute.wagonDirection = bestWagon.wagonDirection
    absolute.wagonSpeed = bestWagon.wagonSpeed
  } else {
    absolute.wagonDirection = null
    absolute.wagonSpeed = 0
  }

  if (bestTurret) {
    absolute.turretDirection = bestTurret.turretDirection
    absolute.turretTurnFactor = bestTurret.turretTurnFactor
  } else {
    absolute.turretDirection = null
    absolute.turretTurnFactor = 0
  }
}

function recomputeAction(action) {
  const sources = gameState.remoteControlSources[action]
  if (!sources) {
    gameState.remoteControl[action] = 0
    return
  }
  let maxIntensity = 0
  for (const value of Object.values(sources)) {
    if (value > maxIntensity) {
      maxIntensity = value
    }
  }
  gameState.remoteControl[action] = maxIntensity
}

export function setRemoteControlAction(action, source, active, intensity = 1) {
  if (!REMOTE_CONTROL_ACTIONS.includes(action)) {
    throw new Error(`Unsupported remote control action: ${action}`)
  }
  if (!source) {
    throw new Error('Remote control source identifier is required')
  }

  ensureRemoteControlSources()
  const sources = gameState.remoteControlSources[action]
  if (active) {
    const clamped = clampIntensity(intensity)
    if (clamped > 0) {
      sources[source] = clamped
    } else {
      delete sources[source]
    }
  } else {
    delete sources[source]
  }
  recomputeAction(action)
}

export function clearRemoteControlSource(source) {
  if (!source) return
  ensureRemoteControlSources()
  for (const action of REMOTE_CONTROL_ACTIONS) {
    const sources = gameState.remoteControlSources[action]
    if (sources && sources[source]) {
      delete sources[source]
      recomputeAction(action)
    }
  }
  clearRemoteControlAbsoluteSource(source)
}

export function getRemoteControlActionState(action) {
  ensureRemoteControlSources()
  return gameState.remoteControl[action] || 0
}

export function getRemoteControlActions() {
  return [...REMOTE_CONTROL_ACTIONS]
}

export function setRemoteControlAbsolute(source, values = {}) {
  if (!source) {
    throw new Error('Remote control source identifier is required')
  }

  ensureRemoteControlAbsolute()

  const data = {
    wagonDirection: Number.isFinite(values.wagonDirection) ? values.wagonDirection : null,
    wagonSpeed: clampIntensity(values.wagonSpeed),
    turretDirection: Number.isFinite(values.turretDirection) ? values.turretDirection : null,
    turretTurnFactor: clampIntensity(values.turretTurnFactor)
  }

  if (
    (data.wagonDirection === null || data.wagonSpeed <= 0) &&
    (data.turretDirection === null || data.turretTurnFactor <= 0)
  ) {
    delete gameState.remoteControlAbsoluteSources[source]
  } else {
    gameState.remoteControlAbsoluteSources[source] = data
  }

  recomputeAbsolute()
}

export function clearRemoteControlAbsoluteSource(source) {
  if (!source) {
    return
  }
  ensureRemoteControlAbsolute()
  if (gameState.remoteControlAbsoluteSources[source]) {
    delete gameState.remoteControlAbsoluteSources[source]
    recomputeAbsolute()
  }
}

export function getRemoteControlAbsolute() {
  ensureRemoteControlAbsolute()
  return gameState.remoteControlAbsolute
}
