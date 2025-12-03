const DEFAULT_STUN_HOST = 'http://localhost:3333'
const detectStunHost = () => {
  // In production (Netlify), use relative URLs to hit the same origin
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '' // Relative URLs: /api/signalling/...
  }
  // Dev mode: check for environment variable first
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_STUN_HOST) {
    return import.meta.env.VITE_STUN_HOST
  }
  if (typeof window !== 'undefined' && window.STUN_HOST) {
    return window.STUN_HOST
  }
  return DEFAULT_STUN_HOST
}

export const STUN_HOST = detectStunHost()

async function postJson(endpoint, payload) {
  const url = STUN_HOST === '' ? `/api${endpoint}` : `${STUN_HOST}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Signalling ${endpoint} failed: ${response.status}`)
  }

  return response.json().catch(() => ({}))
}

export function postOffer(payload) {
  return postJson('/signalling/offer', payload)
}

export function postAnswer(payload) {
  return postJson('/signalling/answer', payload)
}

export function postCandidate(payload) {
  return postJson('/signalling/candidate', payload)
}

export function fetchPendingSessions(inviteToken) {
  if (!inviteToken) {
    throw new Error('Invite token is required to fetch pending sessions')
  }

  const url = STUN_HOST === '' 
    ? `/api/signalling/pending/${encodeURIComponent(inviteToken)}`
    : `${STUN_HOST}/signalling/pending/${encodeURIComponent(inviteToken)}`
  
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch pending sessions (${response.status})`)
    }
    return response.json().catch(() => [])
  })
}

export async function fetchSessionStatus(inviteToken, peerId) {
  if (!inviteToken || !peerId) {
    throw new Error('Invite token and peerId are required to fetch signalling session data')
  }

  const url = STUN_HOST === ''
    ? `/api/signalling/session/${encodeURIComponent(inviteToken)}/${encodeURIComponent(peerId)}`
    : `${STUN_HOST}/signalling/session/${encodeURIComponent(inviteToken)}/${encodeURIComponent(peerId)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to retrieve signalling session (${response.status})`)
  }

  return response.json().catch(() => ({}))
}

export function generateSessionKey(inviteToken, peerId) {
  return `${inviteToken}-${peerId}`
}
