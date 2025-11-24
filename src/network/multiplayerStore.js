import { gameState } from '../gameState.js'
import {
  PARTY_COLORS,
  MULTIPLAYER_PARTY_IDS,
  MAX_MULTIPLAYER_PARTIES,
  INVITE_TOKEN_TTL_MS
} from '../config.js'
import { composeInviteToken, buildInviteUrl, humanReadablePartyLabel } from './invites.js'
import { showHostNotification } from './hostNotifications.js'

const inviteRecords = new Map()

function generateRandomId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function ensurePartyStates() {
  if (!Array.isArray(gameState.partyStates) || gameState.partyStates.length === 0) {
    const partyCount = Math.max(2, Math.min(gameState.playerCount || 2, MAX_MULTIPLAYER_PARTIES))
    gameState.partyStates = MULTIPLAYER_PARTY_IDS.slice(0, partyCount).map((partyId) => {
      const isHost = partyId === gameState.humanPlayer
      return {
        partyId,
        color: PARTY_COLORS[partyId] || PARTY_COLORS.player1,
        owner: isHost ? 'Human (Host)' : 'AI',
        inviteToken: null,
        aiActive: !isHost,
        lastConnectedAt: null
      }
    })
  }
  return gameState.partyStates
}

function ensureGameInstanceId() {
  if (!gameState.gameInstanceId) {
    gameState.gameInstanceId = generateRandomId('game-instance')
  }
  return gameState.gameInstanceId
}

function ensureHostId() {
  if (!gameState.hostId) {
    gameState.hostId = generateRandomId('host')
  }
  return gameState.hostId
}

function purgeExpiredInvites() {
  const now = Date.now()
  inviteRecords.forEach((record, token) => {
    if (record.expiresAt && record.expiresAt <= now) {
      inviteRecords.delete(token)
    }
  })
}

export function ensureMultiplayerState() {
  ensureGameInstanceId()
  ensureHostId()
  ensurePartyStates()
  return gameState.partyStates
}

export function getGameInstanceId() {
  return ensureGameInstanceId()
}

export function getHostId() {
  return ensureHostId()
}

export function getPartyState(partyId) {
  ensureMultiplayerState()
  return gameState.partyStates.find((state) => state.partyId === partyId) || null
}

export function listPartyStates() {
  return ensurePartyStates()
}

export function generateInviteForParty(partyId) {
  ensureMultiplayerState()
  const party = getPartyState(partyId)
  if (!party) {
    throw new Error(`Unknown party: ${partyId}`)
  }

  const token = composeInviteToken(gameState.gameInstanceId, partyId)
  const expiresAt = Date.now() + INVITE_TOKEN_TTL_MS
  inviteRecords.set(token, {
    token,
    partyId,
    gameInstanceId: gameState.gameInstanceId,
    expiresAt,
    createdAt: Date.now(),
    hostId: gameState.hostId
  })

  party.inviteToken = token
  showHostNotification(`Invite ready for ${humanReadablePartyLabel(party.color, party.owner)}`)

  return {
    token,
    url: buildInviteUrl(token),
    expiresAt
  }
}

export function regenerateInviteToken(partyId) {
  return generateInviteForParty(partyId)
}

export function validateInviteToken(token) {
  purgeExpiredInvites()
  return inviteRecords.get(token) || null
}

export function markPartyControlledByHuman(partyId, alias) {
  const party = getPartyState(partyId)
  if (!party) {
    return null
  }

  party.owner = alias || 'Human'
  party.aiActive = false
  party.lastConnectedAt = Date.now()
  showHostNotification(`Party ${partyId} taken over by ${party.owner}`)
  return party
}

export function markPartyControlledByAi(partyId) {
  const party = getPartyState(partyId)
  if (!party) {
    return null
  }

  party.owner = 'AI'
  party.aiActive = true
  party.lastConnectedAt = null
  showHostNotification(`Party ${partyId} returned to AI control`)
  return party
}

export function getInviteRecords() {
  purgeExpiredInvites()
  return Array.from(inviteRecords.values())
}
