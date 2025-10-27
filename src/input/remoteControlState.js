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

function ensureRemoteControlSources() {
  if (!gameState.remoteControlSources) {
    gameState.remoteControlSources = {}
  }

  for (const action of REMOTE_CONTROL_ACTIONS) {
    if (!gameState.remoteControlSources[action]) {
      gameState.remoteControlSources[action] = {}
    }
    if (typeof gameState.remoteControl[action] !== 'boolean') {
      gameState.remoteControl[action] = false
    }
  }
}

function recomputeAction(action) {
  const sources = gameState.remoteControlSources[action]
  if (!sources) {
    gameState.remoteControl[action] = false
    return
  }
  const hasSource = Object.keys(sources).length > 0
  gameState.remoteControl[action] = hasSource
}

export function setRemoteControlAction(action, source, active) {
  if (!REMOTE_CONTROL_ACTIONS.includes(action)) {
    throw new Error(`Unsupported remote control action: ${action}`)
  }
  if (!source) {
    throw new Error('Remote control source identifier is required')
  }

  ensureRemoteControlSources()
  const sources = gameState.remoteControlSources[action]
  if (active) {
    sources[source] = true
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
  return !!gameState.remoteControl[action]
}

export function getRemoteControlActions() {
  return [...REMOTE_CONTROL_ACTIONS]
}
