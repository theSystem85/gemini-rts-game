import { gameState } from '../gameState.js'

function ensureSets() {
  if (!(gameState.humanPlayers instanceof Set)) {
    const existing = Array.isArray(gameState.humanPlayers)
      ? gameState.humanPlayers
      : gameState.humanPlayers ? [...gameState.humanPlayers] : []
    gameState.humanPlayers = new Set(existing.length ? existing : ['player1'])
  }
  if (!gameState.multiplayer) {
    gameState.multiplayer = {
      isHost: true,
      sessionId: null,
      hostPlayerId: 'player1',
      invites: {},
      partyAliases: {},
      partyAssignments: {},
      connections: {}
    }
  } else {
    gameState.multiplayer.invites = gameState.multiplayer.invites || {}
    gameState.multiplayer.partyAliases = gameState.multiplayer.partyAliases || {}
    gameState.multiplayer.partyAssignments = gameState.multiplayer.partyAssignments || {}
    gameState.multiplayer.connections = gameState.multiplayer.connections || {}
  }
}

export function normalizePartyId(partyId) {
  if (!partyId) return null
  if (partyId === 'player') return 'player1'
  if (partyId.startsWith('player')) return partyId
  return `player${partyId}`
}

export function listPartyIds() {
  ensureSets()
  const count = Math.max(2, Math.min(4, gameState.playerCount || 2))
  const parties = []
  for (let i = 1; i <= count; i++) {
    parties.push(`player${i}`)
  }
  return parties
}

export function isHumanParty(partyId) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  if (!normalized) return false
  if (normalized === 'player1' && gameState.humanPlayer === 'player') return true
  return gameState.humanPlayers.has(normalized)
}

export function markPartyAsHuman(partyId, alias, connectionId) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  if (!normalized) return
  gameState.humanPlayers.add(normalized)
  if (alias) {
    gameState.multiplayer.partyAliases[normalized] = alias
  }
  gameState.multiplayer.partyAssignments[normalized] = {
    alias: alias || null,
    connectionId: connectionId || null,
    controlledByHuman: true,
    lastHeartbeat: performance.now()
  }
}

export function markPartyAsAI(partyId) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  if (!normalized) return
  if (normalized !== normalizePartyId(gameState.multiplayer.hostPlayerId || 'player1')) {
    gameState.humanPlayers.delete(normalized)
  }
  if (gameState.multiplayer.partyAssignments[normalized]) {
    gameState.multiplayer.partyAssignments[normalized].controlledByHuman = false
    gameState.multiplayer.partyAssignments[normalized].connectionId = null
  }
}

export function getPartyAlias(partyId) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  return gameState.multiplayer.partyAliases[normalized] || null
}

export function updatePartyAlias(partyId, alias) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  if (!normalized) return
  if (alias) {
    gameState.multiplayer.partyAliases[normalized] = alias
  } else {
    delete gameState.multiplayer.partyAliases[normalized]
  }
  const assignment = gameState.multiplayer.partyAssignments[normalized]
  if (assignment) {
    assignment.alias = alias || null
  }
}

export function getPartyDisplayName(partyId) {
  const normalized = normalizePartyId(partyId)
  const alias = getPartyAlias(normalized)
  return alias ? `${alias}` : normalized.replace('player', 'Player ')
}

export function ensureHostParty(hostPartyId = 'player1', alias) {
  ensureSets()
  const normalized = normalizePartyId(hostPartyId)
  gameState.multiplayer.hostPlayerId = normalized
  gameState.multiplayer.isHost = true
  markPartyAsHuman(normalized, alias || 'Host', 'host')
  gameState.multiplayer.connections.host = {
    id: 'host',
    partyId: normalized,
    alias: alias || 'Host',
    isHost: true
  }
}

export function clearConnection(connectionId) {
  ensureSets()
  Object.entries(gameState.multiplayer.partyAssignments).forEach(([party, assignment]) => {
    if (assignment.connectionId === connectionId) {
      markPartyAsAI(party)
    }
  })
  if (connectionId && gameState.multiplayer.connections[connectionId]) {
    delete gameState.multiplayer.connections[connectionId]
  }
}

export function registerConnection(connectionId, details) {
  ensureSets()
  gameState.multiplayer.connections[connectionId] = {
    id: connectionId,
    ...details
  }
}

export function updateConnectionHeartbeat(connectionId) {
  ensureSets()
  const assignment = Object.values(gameState.multiplayer.partyAssignments).find(
    entry => entry.connectionId === connectionId
  )
  if (assignment) {
    assignment.lastHeartbeat = performance.now()
  }
}

export function getPartyAssignment(partyId) {
  ensureSets()
  const normalized = normalizePartyId(partyId)
  return gameState.multiplayer.partyAssignments[normalized] || null
}

export function getHostPartyId() {
  ensureSets()
  return normalizePartyId(gameState.multiplayer.hostPlayerId || 'player1')
}

export function isHost() {
  ensureSets()
  return !!gameState.multiplayer?.isHost
}
