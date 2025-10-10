/* global crypto */

const channels = new Map()

function generateClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getEnvOverride(key) {
  if (typeof window !== 'undefined' && window[key]) {
    return window[key]
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, key)) {
    return import.meta.env[key]
  }
  return null
}

const READY_STATE_OPEN = (typeof window !== 'undefined' && window.WebSocket)
  ? window.WebSocket.OPEN
  : 1
const READY_STATE_CONNECTING = (typeof window !== 'undefined' && window.WebSocket)
  ? window.WebSocket.CONNECTING
  : 0

function getDefaultPort(protocol) {
  return protocol === 'https:' ? 443 : 80
}

function resolveServiceBase() {
  if (typeof window === 'undefined') {
    return { http: '', ws: '' }
  }
  const httpOverride = getEnvOverride('VITE_SIGNAL_HTTP_URL') || getEnvOverride('__GEMINI_SIGNAL_HTTP_URL')
  const wsOverride = getEnvOverride('VITE_SIGNAL_WS_URL') || getEnvOverride('__GEMINI_SIGNAL_WS_URL')
  if (httpOverride || wsOverride) {
    const httpBase = (httpOverride || '').replace(/\/$/, '')
    const wsBase = (wsOverride || httpBase).replace(/^http/, 'ws').replace(/\/$/, '')
    return {
      http: httpBase || window.location.origin,
      ws: wsBase || window.location.origin.replace(/^http/, 'ws')
    }
  }
  const { protocol, hostname, port } = window.location
  const defaultPort = getDefaultPort(protocol)
  const numericPort = port ? Number(port) : defaultPort
  const servicePort = numericPort === 3001 ? numericPort : (numericPort === defaultPort ? defaultPort : 3001)
  const effectivePort = servicePort === defaultPort ? '' : `:${servicePort}`
  const http = `${protocol}//${hostname}${effectivePort}`
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = `${wsProtocol}//${hostname}${effectivePort}`
  return { http, ws }
}

export const signalService = resolveServiceBase()

function connect(entry) {
  if (typeof window === 'undefined') return null
  const { sessionId } = entry
  const clientId = entry.clientId || generateClientId()
  entry.clientId = clientId
  const wsUrl = `${signalService.ws}/signal?sessionId=${encodeURIComponent(sessionId)}&clientId=${encodeURIComponent(clientId)}`
  const socket = new window.WebSocket(wsUrl)
  entry.socket = socket
  socket.addEventListener('open', () => {
    entry.ready = true
    entry.retryDelay = 250
    if (entry.queue.length) {
      entry.queue.splice(0).forEach(message => {
        try {
          socket.send(message)
        } catch (err) {
          console.warn('Failed to flush signaling message', err)
        }
      })
    }
  })
  socket.addEventListener('message', (event) => {
    let payload
    try {
      payload = JSON.parse(event.data)
    } catch (err) {
      console.warn('Invalid signaling payload', err)
      return
    }
    entry.handlers.forEach(handler => {
      try {
        handler({ data: payload })
      } catch (err) {
        console.error('Error in signaling handler', err)
      }
    })
  })
  socket.addEventListener('close', () => {
    entry.ready = false
    entry.socket = null
    if (!entry.shouldReconnect || entry.handlers.size === 0) {
      channels.delete(sessionId)
      return
    }
    const delay = Math.min(entry.retryDelay * 2, 10000)
    entry.retryDelay = delay
    setTimeout(() => connect(entry), delay)
  })
  socket.addEventListener('error', () => {
    if (socket.readyState === READY_STATE_OPEN || socket.readyState === READY_STATE_CONNECTING) {
      socket.close()
    }
  })
  return socket
}

export function createSignalingChannel(sessionId, handler) {
  if (!sessionId) throw new Error('sessionId required for signaling channel')
  let entry = channels.get(sessionId)
  if (!entry) {
    entry = {
      sessionId,
      handlers: new Set(),
      queue: [],
      ready: false,
      retryDelay: 250,
      shouldReconnect: true,
      socket: null,
      clientId: null
    }
    channels.set(sessionId, entry)
    if (typeof window !== 'undefined') {
      connect(entry)
    }
  } else if (!entry.socket && typeof window !== 'undefined') {
    connect(entry)
  }
  if (handler) {
    entry.handlers.add(handler)
  }
  return entry
}

export function closeSignalingChannel(sessionId, handler) {
  const entry = channels.get(sessionId)
  if (!entry) return
  if (handler && entry.handlers.has(handler)) {
    entry.handlers.delete(handler)
  }
  if (entry.handlers.size === 0) {
    entry.shouldReconnect = false
    if (entry.socket && entry.socket.readyState === READY_STATE_OPEN) {
      entry.socket.close()
    }
    channels.delete(sessionId)
  }
}

export function postSignal(sessionId, payload) {
  const entry = channels.get(sessionId)
  if (!entry) {
    throw new Error('Signaling channel not initialized for session')
  }
  const message = JSON.stringify(payload)
  if (entry.socket && entry.ready && entry.socket.readyState === READY_STATE_OPEN) {
    entry.socket.send(message)
  } else {
    entry.queue.push(message)
  }
}
