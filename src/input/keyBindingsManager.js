import { APP_VERSION } from '../version.js'
import versionInfo from '../version.json'

const STORAGE_KEY = 'rts-user-keybindings'
export const DOUBLE_TAP_THRESHOLD = 350

const defaultBindings = {
  contexts: {
    gameplay: {
      id: 'gameplay',
      label: 'Standard Gameplay',
      description: 'Active during normal play when the map editor is off.',
      keyboard: [
        { id: 'toggle-help', label: 'Toggle Controls Help', input: 'i', description: 'Show the quick control reference overlay.' },
        { id: 'toggle-cheats', label: 'Open Cheat Console', input: 'c', description: 'Opens the cheat console even while paused.' },
        { id: 'toggle-runtime-config', label: 'Open Runtime Config', input: 'k', description: 'Opens the runtime configuration dialog.' },
        { id: 'toggle-grid', label: 'Toggle Map Grid', input: 'g', description: 'Show or hide the terrain grid overlay.' },
        { id: 'toggle-occupancy', label: 'Toggle Occupancy Map', input: 'o', description: 'Show or hide occupancy heat overlay.' },
        { id: 'toggle-dzm', label: 'Toggle Danger Zone Map', input: 'z', description: 'Toggle danger zone or floodfill overlay.' },
        { id: 'toggle-tank-images', label: 'Toggle Tank Images', input: 't', description: 'Switch tank rendering layers on/off.' },
        { id: 'toggle-fps', label: 'Toggle FPS Overlay', input: 'p', description: 'Show or hide FPS counter overlay.' },
        { id: 'toggle-performance', label: 'Toggle Performance Dialog', input: 'm', description: 'Opens performance statistics dialog.' },
        { id: 'alert-mode', label: 'Toggle Alert Mode', input: 'a', description: 'Enable alert mode for selected combat units.' },
        { id: 'sell-mode', label: 'Sell / Stop', input: 's', description: 'Toggle sell mode or stop selected units.' },
        { id: 'repair-mode', label: 'Repair Mode', input: 'r', description: 'Toggle repair cursor mode.' },
        { id: 'workshop-repair', label: 'Send to Workshop', input: 'w', description: 'Send selected units to workshop (Alt queues).' },
        { id: 'dodge', label: 'Dodge / Retreat', input: 'x', description: 'Trigger dodge or retreat behavior.' },
        { id: 'focus-factory', label: 'Focus on Factory', input: 'h', description: 'Center camera on the main factory.' },
        { id: 'focus-selection', label: 'Focus on Selection', input: 'e', description: 'Center on selection; Shift toggles auto focus.' },
        { id: 'formation-mode', label: 'Toggle Formation Mode', input: 'f', description: 'Toggle formation mode for selected units.' },
        { id: 'logging-toggle', label: 'Toggle Unit Logging', input: 'l', description: 'Enable/disable logging on selected units.' },
        { id: 'control-group-assign', label: 'Assign Control Group', input: 'ctrl+[1-9]', description: 'Assign selected units to a numeric group.' },
        { id: 'control-group-select', label: 'Select Control Group', input: '[1-9]', description: 'Select or focus on a numeric group.' },
        { id: 'escape', label: 'Cancel / Escape', input: 'escape', description: 'Exit modes like attack-group or placement.' },
        { id: 'scroll-up', label: 'Scroll Up / Remote Forward', input: 'arrowup', description: 'Scroll camera or drive remote vehicle forward.' },
        { id: 'scroll-down', label: 'Scroll Down / Remote Reverse', input: 'arrowdown', description: 'Scroll camera or drive remote vehicle backward.' },
        { id: 'scroll-left', label: 'Scroll Left / Turn Left', input: 'arrowleft', description: 'Scroll camera or turn vehicle left.' },
        { id: 'scroll-right', label: 'Scroll Right / Turn Right', input: 'arrowright', description: 'Scroll camera or turn vehicle right.' },
        { id: 'remote-fire', label: 'Remote Fire', input: 'space', description: 'Fire weapon when remote controlling a vehicle.' },
        { id: 'remote-turret-left', label: 'Remote Turret Left', input: 'shift+arrowleft', description: 'Rotate turret left during remote control or with modifier.' },
        { id: 'remote-turret-right', label: 'Remote Turret Right', input: 'shift+arrowright', description: 'Rotate turret right during remote control or with modifier.' }
      ],
      mouse: [
        { id: 'select', label: 'Select Units/Buildings', input: 'left-click', description: 'Primary click selects or starts box selection.' },
        { id: 'command', label: 'Command / Move / Attack', input: 'right-click', description: 'Issue move/attack/order at cursor position.' },
        { id: 'force-attack', label: 'Force Attack', input: 'ctrl+left-click', description: 'Attack friendly targets when using force attack.' },
        { id: 'guard', label: 'Guard Click', input: 'meta+left-click', description: 'Issue guard command when meta key is held.' },
        { id: 'select-same', label: 'Select Same Type', input: 'double-left-click', description: 'Select all visible units of same type.' },
        { id: 'pan', label: 'Camera Pan', input: 'right-drag', description: 'Drag with right button to pan the camera.' }
      ],
      touch: [
        { id: 'tap-select', label: 'Tap to Select', input: 'tap', description: 'Tap to select units or buildings.' },
        { id: 'long-press', label: 'Long Press Command', input: 'long-press', description: 'Hold to open context / issue command.' },
        { id: 'double-tap', label: 'Double Tap', input: 'double-tap', description: 'Select similar units with a quick double tap.' },
        { id: 'two-finger-tap', label: 'Two Finger Tap', input: 'two-finger-tap', description: 'Alternate command/stop gesture.' }
      ]
    },
    mapEditor: {
      id: 'mapEditor',
      label: 'Map Edit Mode',
      description: 'Reserved for map editing tools.',
      keyboard: [
        { id: 'toggle-help', label: 'Toggle Controls Help', input: 'i', description: 'Show the quick control reference overlay.' },
        { id: 'toggle-grid', label: 'Toggle Map Grid', input: 'g', description: 'Show or hide the terrain grid overlay.' }
      ],
      mouse: [
        { id: 'paint-tile', label: 'Paint Tile', input: 'left-click', description: 'Paint terrain when map edit mode is enabled.' }
      ],
      touch: [
        { id: 'paint-tile', label: 'Paint Tile', input: 'tap', description: 'Paint terrain while map edit mode is enabled.' }
      ]
    }
  }
}

let userOverrides = loadOverrides()
let lastTap = 0
let lastTapType = null

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultBindings))
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && parsed.overrides) {
      return parsed.overrides
    }
  } catch (err) {
    window.logger?.warn?.('Failed to load key bindings from localStorage', err)
  }
  return {}
}

function persistOverrides() {
  try {
    const payload = {
      version: APP_VERSION,
      commit: versionInfo?.commit || 'unknown',
      updatedAt: new Date().toISOString(),
      overrides: userOverrides
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    window.logger?.warn?.('Failed to persist key bindings', err)
  }
}

export function resetAllBindings() {
  userOverrides = {}
  persistOverrides()
}

export function getContexts() {
  const defaults = cloneDefault().contexts
  const overrides = userOverrides.contexts || {}
  Object.keys(overrides || {}).forEach((contextId) => {
    const contextOverrides = overrides[contextId]
    if (!contextOverrides) return
    const context = defaults[contextId]
    if (!context) return
    ;['keyboard', 'mouse', 'touch'].forEach((device) => {
      if (!contextOverrides[device]) return
      contextOverrides[device].forEach((override) => {
        const entry = (context[device] || []).find(item => item.id === override.id)
        if (entry && override.input) {
          entry.input = override.input
          entry.isCustom = true
        }
      })
    })
  })
  return defaults
}

function ensureContextDevice(contextId, device) {
  if (!userOverrides.contexts) {
    userOverrides.contexts = {}
  }
  if (!userOverrides.contexts[contextId]) {
    userOverrides.contexts[contextId] = {}
  }
  if (!userOverrides.contexts[contextId][device]) {
    userOverrides.contexts[contextId][device] = []
  }
}

export function updateBinding(contextId, device, bindingId, input) {
  ensureContextDevice(contextId, device)
  const list = userOverrides.contexts[contextId][device]
  const existing = list.find(entry => entry.id === bindingId)
  if (existing) {
    existing.input = input
  } else {
    list.push({ id: bindingId, input })
  }
  persistOverrides()
}

export function resetBinding(contextId, device, bindingId) {
  if (userOverrides?.contexts?.[contextId]?.[device]) {
    userOverrides.contexts[contextId][device] = userOverrides.contexts[contextId][device].filter(entry => entry.id !== bindingId)
    persistOverrides()
  }
}

function normalizeInput(input) {
  if (!input) return ''
  return input.trim().toLowerCase()
}

function parsePattern(pattern) {
  return normalizeInput(pattern).split('+')
}

function eventMatchesPattern(event, patternParts) {
  const key = normalizeKey(event.key)
  const required = {
    ctrl: patternParts.includes('ctrl') || patternParts.includes('control'),
    shift: patternParts.includes('shift'),
    alt: patternParts.includes('alt') || patternParts.includes('option'),
    meta: patternParts.includes('meta') || patternParts.includes('cmd') || patternParts.includes('command')
  }

  if (required.ctrl !== (event.ctrlKey || event.metaKey && !required.meta)) return false
  if (required.shift !== event.shiftKey) return false
  if (required.alt !== event.altKey) return false
  if (required.meta !== event.metaKey) return false

  const mainKey = patternParts.find(part => !['ctrl', 'control', 'shift', 'alt', 'option', 'meta', 'cmd', 'command'].includes(part))
  if (!mainKey) return false

  if (mainKey === '[1-9]') {
    return /^[1-9]$/.test(key)
  }

  return key === mainKey
}

function normalizeKey(key) {
  if (!key) return ''
  const lower = key.toLowerCase()
  if (lower === ' ') return 'space'
  if (lower === 'arrowup' || lower === 'up') return 'arrowup'
  if (lower === 'arrowdown' || lower === 'down') return 'arrowdown'
  if (lower === 'arrowleft' || lower === 'left') return 'arrowleft'
  if (lower === 'arrowright' || lower === 'right') return 'arrowright'
  return lower
}

function buildKeyboardDescriptor(event) {
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('ctrl')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')
  if (event.metaKey && !event.ctrlKey) parts.push('meta')
  const key = normalizeKey(event.key)
  if (key && !['control', 'shift', 'alt', 'meta'].includes(key)) {
    parts.push(key)
  }
  return parts.join('+')
}

export function formatInputLabel(input) {
  return normalizeInput(input).replace(/\bmeta\b/g, 'Cmd').replace(/\bctrl\b/g, 'Ctrl').replace(/\balt\b/g, 'Alt').replace(/\boption\b/g, 'Option').replace(/\barrow/g, 'Arrow ').replace(/-/g, ' ')
}

function matchKeyboardBindings(event, contextId) {
  const contexts = getContexts()
  const context = contexts[contextId] || contexts.gameplay
  const matches = []
  if (!context?.keyboard) return matches
  const descriptor = buildKeyboardDescriptor(event)
  context.keyboard.forEach(binding => {
    const patternParts = parsePattern(binding.input)
    if (eventMatchesPattern(event, patternParts)) {
      const detail = {}
      if (patternParts.includes('[1-9]')) {
        detail.digit = normalizeKey(event.key)
      }
      matches.push({ actionId: binding.id, binding, detail })
    }
  })
  return matches
}

function matchMouseGesture(gesture, contextId) {
  const contexts = getContexts()
  const context = contexts[contextId] || contexts.gameplay
  const matches = []
  if (!context?.mouse) return matches
  context.mouse.forEach(binding => {
    if (normalizeInput(binding.input) === normalizeInput(gesture)) {
      matches.push({ actionId: binding.id, binding })
    }
  })
  return matches
}

function matchTouchGesture(gesture, contextId) {
  const contexts = getContexts()
  const context = contexts[contextId] || contexts.gameplay
  const matches = []
  if (!context?.touch) return matches
  context.touch.forEach(binding => {
    if (normalizeInput(binding.input) === normalizeInput(gesture)) {
      matches.push({ actionId: binding.id, binding })
    }
  })
  return matches
}

export function getActiveContextId(gameState) {
  if (gameState?.mapEditMode) return 'mapEditor'
  return 'gameplay'
}

export function getKeyboardMatches(event, gameState) {
  const contextId = getActiveContextId(gameState)
  return matchKeyboardBindings(event, contextId)
}

export function getMouseMatches(gesture, gameState) {
  const contextId = getActiveContextId(gameState)
  return matchMouseGesture(gesture, contextId)
}

export function getTouchMatches(gesture, gameState) {
  const contextId = getActiveContextId(gameState)
  return matchTouchGesture(gesture, contextId)
}

export function captureTouchGesture(event) {
  const now = performance.now()
  if (event.touches?.length >= 2) {
    lastTap = 0
    lastTapType = 'two-finger-tap'
    return 'two-finger-tap'
  }
  if (event.type === 'touchstart') {
    const delta = now - lastTap
    lastTap = now
    if (delta < DOUBLE_TAP_THRESHOLD && lastTapType === 'tap') {
      lastTapType = 'double-tap'
      return 'double-tap'
    }
    lastTapType = 'tap'
    return 'tap'
  }
  return null
}

export function captureMouseGesture(event) {
  if (event.detail === 2) {
    if (event.button === 0) return 'double-left-click'
  }
  if (event.button === 2 && event.type === 'mousedown') return 'right-click'
  if (event.button === 0 && event.type === 'mousedown') return 'left-click'
  if (event.button === 0 && event.type === 'pointerdown' && event.pointerType === 'touch') return 'tap'
  return null
}

export function getExportPayload() {
  return {
    version: APP_VERSION,
    commit: versionInfo?.commit || 'unknown',
    exportedAt: new Date().toISOString(),
    overrides: userOverrides
  }
}

export function importBindings(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (!payload.overrides) return false
  userOverrides = payload.overrides
  persistOverrides()
  return true
}

export function getDefaultBindings() {
  return cloneDefault()
}

export function isCustomBinding(contextId, device, bindingId) {
  const overrides = userOverrides?.contexts?.[contextId]?.[device] || []
  return overrides.some(entry => entry.id === bindingId)
}

export function formatKeyboardEventForDisplay(event) {
  return buildKeyboardDescriptor(event)
}
