import { gameState } from '../gameState.js'

const REMOTE_CONTROL_ACTIONS = [
  'forward',
  'backward',
  'turnLeft',
  'turnRight',
  'turretLeft',
  'turretRight',
  'fire'
]

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
}

export function getRemoteControlActionState(action) {
  ensureRemoteControlSources()
  return gameState.remoteControl[action] || 0
}

export function getRemoteControlActions() {
  return [...REMOTE_CONTROL_ACTIONS]
}
