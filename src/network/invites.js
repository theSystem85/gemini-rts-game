const INVITE_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'

export function composeInviteToken(gameInstanceId, partyId) {
  return `${gameInstanceId}-${partyId}-${Date.now()}`
}

export function buildInviteUrl(token) {
  return `${INVITE_BASE_URL}?invite=${token}`
}

export function humanReadablePartyLabel(color, owner) {
  return `${color}: ${owner}`
}
