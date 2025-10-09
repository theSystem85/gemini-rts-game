/* global BroadcastChannel */

const channels = new Map()

function getChannelName(sessionId) {
  return `gemini-rts-signal-${sessionId}`
}

export function createSignalingChannel(sessionId, handler) {
  if (!sessionId) throw new Error('sessionId required for signaling channel')
  const name = getChannelName(sessionId)
  let channel = channels.get(name)
  if (!channel) {
    channel = new BroadcastChannel(name)
    channels.set(name, channel)
  }
  if (handler) {
    channel.addEventListener('message', handler)
  }
  return channel
}

export function closeSignalingChannel(sessionId, handler) {
  const name = getChannelName(sessionId)
  const channel = channels.get(name)
  if (!channel) return
  if (handler) {
    channel.removeEventListener('message', handler)
  }
}

export function postSignal(sessionId, payload) {
  const channel = createSignalingChannel(sessionId)
  channel.postMessage(payload)
}
