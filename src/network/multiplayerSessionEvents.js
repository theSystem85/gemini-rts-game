import { gameState } from '../gameState.js'

export const MULTIPLAYER_SESSION_EVENT = 'multiplayerSessionChanged'

export function emitMultiplayerSessionChange() {
  if (typeof document === 'undefined') {
    return
  }
  const detail = {
    ...gameState.multiplayerSession
  }
  document.dispatchEvent(new CustomEvent(MULTIPLAYER_SESSION_EVENT, { detail }))
}

export function observeMultiplayerSession(handler) {
  if (typeof document === 'undefined' || typeof handler !== 'function') {
    return () => {}
  }
  document.addEventListener(MULTIPLAYER_SESSION_EVENT, handler)
  return () => document.removeEventListener(MULTIPLAYER_SESSION_EVENT, handler)
}
