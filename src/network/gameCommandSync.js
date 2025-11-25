/**
 * Game Command Synchronization Module
 * Handles broadcasting and receiving game commands (unit commands, build commands) between multiplayer sessions
 */

import { gameState } from '../gameState.js'
import { getActiveRemoteConnection } from './remoteConnection.js'
import { getActiveHostMonitor } from './webrtcSession.js'

// Command types for synchronization
export const COMMAND_TYPES = {
  UNIT_MOVE: 'unit-move',
  UNIT_ATTACK: 'unit-attack',
  UNIT_STOP: 'unit-stop',
  UNIT_GUARD: 'unit-guard',
  BUILDING_PLACE: 'building-place',
  BUILDING_SELL: 'building-sell',
  PRODUCTION_START: 'production-start',
  PRODUCTION_CANCEL: 'production-cancel',
  GAME_PAUSE: 'game-pause',
  GAME_RESUME: 'game-resume',
  GAME_STATE_SNAPSHOT: 'game-state-snapshot'
}

const GAME_COMMAND_MESSAGE_TYPE = 'game-command'

// Interval for game state snapshots (ms)
const GAME_STATE_SYNC_INTERVAL_MS = 500

// Queue for commands received from remote players (processed by host)
const pendingRemoteCommands = []

// Listeners for command reception
const commandListeners = new Set()

// Handle for periodic state sync
let stateSyncHandle = null

/**
 * Check if the current session is the host
 * @returns {boolean}
 */
function isHost() {
  return gameState.multiplayerSession?.localRole === 'host' || !gameState.multiplayerSession?.isRemote
}

/**
 * Check if a remote session is connected
 * @returns {boolean}
 */
function hasActiveRemoteSession() {
  return Boolean(gameState.multiplayerSession?.isRemote || getActiveConnection())
}

/**
 * Get the active connection (either as host or remote client)
 * @returns {Object|null}
 */
function getActiveConnection() {
  // Check for remote client connection
  const remoteConn = getActiveRemoteConnection()
  if (remoteConn && remoteConn.connectionState === 'connected') {
    return remoteConn
  }
  
  // For host, check if there's an active session monitor with connected peers
  // We don't return the monitor directly but indicate we should broadcast
  return null
}

/**
 * Broadcast a game command to all connected peers
 * Host broadcasts to all remote players
 * Remote players send to host for validation and re-broadcast
 * 
 * @param {string} commandType - Type of command from COMMAND_TYPES
 * @param {Object} payload - Command-specific data
 * @param {string} sourcePartyId - The party that issued the command
 */
export function broadcastGameCommand(commandType, payload, sourcePartyId) {
  if (!commandType || !payload) {
    return
  }
  
  const command = {
    type: GAME_COMMAND_MESSAGE_TYPE,
    commandType,
    payload,
    sourcePartyId: sourcePartyId || gameState.humanPlayer,
    timestamp: Date.now(),
    isHost: isHost()
  }
  
  if (isHost()) {
    // Host broadcasts to all connected peers
    broadcastToAllPeers(command)
  } else {
    // Remote client sends to host
    const remoteConn = getActiveRemoteConnection()
    if (remoteConn) {
      try {
        remoteConn.send(command)
      } catch (err) {
        console.warn('Failed to send game command to host:', err)
      }
    }
  }
}

/**
 * Broadcast a message to all connected peers (host only)
 * @param {Object} message - The message to broadcast
 */
function broadcastToAllPeers(message) {
  if (!isHost()) {
    return
  }
  
  // Get all party invite monitors and broadcast to their active sessions
  if (!Array.isArray(gameState.partyStates)) {
    return
  }
  
  gameState.partyStates.forEach(party => {
    if (party.partyId === gameState.humanPlayer) {
      return // Skip self
    }
    
    const monitor = getActiveHostMonitor(party.partyId)
    if (monitor && monitor.activeSession) {
      monitor.activeSession.sendHostStatus(message)
    }
  })
}

/**
 * Handle a received game command
 * @param {Object} command - The received command
 * @param {string} sourceId - Identifier of the message source
 */
export function handleReceivedCommand(command, sourceId) {
  if (!command || command.type !== GAME_COMMAND_MESSAGE_TYPE) {
    return
  }
  
  // Validate the command comes from an authorized party
  const sourceParty = command.sourcePartyId
  if (!sourceParty) {
    console.warn('Received game command without source party')
    return
  }
  
  if (isHost()) {
    // Host validates and processes/re-broadcasts the command
    // Only accept commands from the party that the remote player controls
    const partyState = gameState.partyStates?.find(p => p.partyId === sourceParty)
    if (!partyState || partyState.aiActive) {
      console.warn('Received command from unauthorized party:', sourceParty)
      return
    }
    
    // Queue the command for processing
    pendingRemoteCommands.push({
      ...command,
      receivedAt: Date.now()
    })
    
    // Re-broadcast to other peers so they stay in sync
    broadcastToAllPeers(command)
  } else {
    // Remote client receives commands from host - apply them
    // Commands from host are authoritative
    if (command.isHost) {
      applyCommand(command)
    }
  }
  
  // Notify listeners
  commandListeners.forEach(listener => {
    try {
      listener(command)
    } catch (err) {
      console.warn('Command listener error:', err)
    }
  })
}

/**
 * Apply a received command to the local game state
 * @param {Object} command - The command to apply
 */
function applyCommand(command) {
  // Commands are applied based on type
  // This is called on remote clients to sync their state with the host
  // The actual implementation depends on how the game processes commands
  
  switch (command.commandType) {
    case COMMAND_TYPES.GAME_PAUSE:
      if (!isHost()) {
        gameState.gamePaused = true
      }
      break
      
    case COMMAND_TYPES.GAME_RESUME:
      if (!isHost()) {
        gameState.gamePaused = false
      }
      break
      
    case COMMAND_TYPES.GAME_STATE_SNAPSHOT:
      applyGameStateSnapshot(command.payload)
      break
      
    // Other command types are handled by the existing game logic
    // through the command listeners
    default:
      break
  }
}

/**
 * Process pending remote commands (called by host in game loop)
 * @returns {Array} List of commands to process
 */
export function processPendingRemoteCommands() {
  if (!isHost() || pendingRemoteCommands.length === 0) {
    return []
  }
  
  const commands = [...pendingRemoteCommands]
  pendingRemoteCommands.length = 0
  return commands
}

/**
 * Subscribe to game command events
 * @param {Function} handler - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGameCommands(handler) {
  if (typeof handler !== 'function') {
    return () => {}
  }
  
  commandListeners.add(handler)
  return () => commandListeners.delete(handler)
}

/**
 * Create a unit move command payload
 * @param {Array} unitIds - IDs of units to move
 * @param {number} targetX - Target X position
 * @param {number} targetY - Target Y position
 * @returns {Object}
 */
export function createMoveCommand(unitIds, targetX, targetY) {
  return {
    unitIds: Array.isArray(unitIds) ? unitIds : [unitIds],
    targetX,
    targetY
  }
}

/**
 * Create a unit attack command payload
 * @param {Array} unitIds - IDs of attacking units
 * @param {string} targetId - ID of the target
 * @param {string} targetType - 'unit' or 'building'
 * @returns {Object}
 */
export function createAttackCommand(unitIds, targetId, targetType) {
  return {
    unitIds: Array.isArray(unitIds) ? unitIds : [unitIds],
    targetId,
    targetType
  }
}

/**
 * Create a building placement command payload
 * @param {string} buildingType - Type of building
 * @param {number} x - Tile X position
 * @param {number} y - Tile Y position
 * @returns {Object}
 */
export function createBuildingPlaceCommand(buildingType, x, y) {
  return {
    buildingType,
    x,
    y
  }
}

/**
 * Create a production command payload
 * @param {string} productionType - 'unit' or 'building'
 * @param {string} itemType - Type of item to produce
 * @param {string} factoryId - ID of the producing factory
 * @returns {Object}
 */
export function createProductionCommand(productionType, itemType, factoryId) {
  return {
    productionType,
    itemType,
    factoryId
  }
}

/**
 * Broadcast a unit move command
 * @param {Array} units - Units to move
 * @param {number} targetX - Target X
 * @param {number} targetY - Target Y
 */
export function broadcastUnitMove(units, targetX, targetY) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  const unitIds = units.map(u => u.id).filter(Boolean)
  if (unitIds.length === 0) {
    return
  }
  
  const partyId = units[0]?.owner || gameState.humanPlayer
  broadcastGameCommand(
    COMMAND_TYPES.UNIT_MOVE,
    createMoveCommand(unitIds, targetX, targetY),
    partyId
  )
}

/**
 * Broadcast a unit attack command
 * @param {Array} units - Attacking units
 * @param {Object} target - Target unit or building
 */
export function broadcastUnitAttack(units, target) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  const unitIds = units.map(u => u.id).filter(Boolean)
  if (unitIds.length === 0 || !target?.id) {
    return
  }
  
  const targetType = target.isBuilding ? 'building' : 'unit'
  const partyId = units[0]?.owner || gameState.humanPlayer
  
  broadcastGameCommand(
    COMMAND_TYPES.UNIT_ATTACK,
    createAttackCommand(unitIds, target.id, targetType),
    partyId
  )
}

/**
 * Broadcast a building placement command
 * @param {string} buildingType - Type of building
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @param {string} partyId - Owning party
 */
export function broadcastBuildingPlace(buildingType, x, y, partyId) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  broadcastGameCommand(
    COMMAND_TYPES.BUILDING_PLACE,
    createBuildingPlaceCommand(buildingType, x, y),
    partyId || gameState.humanPlayer
  )
}

/**
 * Broadcast a production start command
 * @param {string} productionType - 'unit' or 'building'
 * @param {string} itemType - Type of item
 * @param {string} factoryId - Factory ID
 * @param {string} partyId - Owning party
 */
export function broadcastProductionStart(productionType, itemType, factoryId, partyId) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  broadcastGameCommand(
    COMMAND_TYPES.PRODUCTION_START,
    createProductionCommand(productionType, itemType, factoryId),
    partyId || gameState.humanPlayer
  )
}

/**
 * Broadcast a game pause/resume command (host only)
 * @param {boolean} paused - Whether the game is paused
 */
export function broadcastGamePauseState(paused) {
  if (!isHost() || !hasActiveRemoteSession()) {
    return
  }
  
  broadcastGameCommand(
    paused ? COMMAND_TYPES.GAME_PAUSE : COMMAND_TYPES.GAME_RESUME,
    { paused },
    gameState.humanPlayer
  )
}

/**
 * Create a minimal game state snapshot for synchronization
 * Only includes essential data that needs to be synced
 * @returns {Object}
 */
function createGameStateSnapshot() {
  // Serialize units with essential properties only
  const units = (gameState.units || []).map(unit => ({
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    x: unit.x,
    y: unit.y,
    tileX: unit.tileX,
    tileY: unit.tileY,
    health: unit.health,
    maxHealth: unit.maxHealth,
    direction: unit.direction,
    turretDirection: unit.turretDirection,
    target: unit.target ? { id: unit.target.id } : null,
    moveTarget: unit.moveTarget,
    gas: unit.gas,
    maxGas: unit.maxGas,
    ammunition: unit.ammunition,
    maxAmmunition: unit.maxAmmunition,
    oreCarried: unit.oreCarried,
    crew: unit.crew
  }))
  
  // Serialize buildings with essential properties
  const buildings = (gameState.buildings || []).map(building => ({
    id: building.id,
    type: building.type,
    owner: building.owner,
    x: building.x,
    y: building.y,
    width: building.width,
    height: building.height,
    health: building.health,
    maxHealth: building.maxHealth,
    constructionProgress: building.constructionProgress,
    isBeingBuilt: building.isBeingBuilt,
    isBeingSold: building.isBeingSold,
    ammo: building.ammo,
    maxAmmo: building.maxAmmo
  }))
  
  // Serialize bullets/projectiles
  const bullets = (gameState.bullets || []).map(bullet => ({
    id: bullet.id,
    x: bullet.x,
    y: bullet.y,
    targetX: bullet.targetX,
    targetY: bullet.targetY,
    owner: bullet.owner,
    damage: bullet.damage,
    type: bullet.type
  }))
  
  return {
    units,
    buildings,
    bullets,
    money: gameState.money,
    gamePaused: gameState.gamePaused,
    gameStarted: gameState.gameStarted,
    partyStates: gameState.partyStates,
    timestamp: Date.now()
  }
}

/**
 * Apply a game state snapshot received from the host
 * @param {Object} snapshot - The game state snapshot
 */
function applyGameStateSnapshot(snapshot) {
  if (!snapshot || isHost()) {
    return
  }
  
  // Update money for the local player's party
  if (typeof snapshot.money === 'number') {
    gameState.money = snapshot.money
  }
  
  // Sync game pause state
  if (typeof snapshot.gamePaused === 'boolean') {
    gameState.gamePaused = snapshot.gamePaused
  }
  
  // Sync game started state
  if (typeof snapshot.gameStarted === 'boolean') {
    gameState.gameStarted = snapshot.gameStarted
  }
  
  // Sync party states
  if (Array.isArray(snapshot.partyStates)) {
    gameState.partyStates = snapshot.partyStates
  }
  
  // Sync units - update existing units or add new ones
  if (Array.isArray(snapshot.units)) {
    const existingUnits = gameState.units || []
    const snapshotUnitIds = new Set(snapshot.units.map(u => u.id))
    
    // Remove units that no longer exist
    gameState.units = existingUnits.filter(u => snapshotUnitIds.has(u.id))
    
    // Update or add units
    snapshot.units.forEach(snapshotUnit => {
      const existing = gameState.units.find(u => u.id === snapshotUnit.id)
      if (existing) {
        // Update existing unit properties
        Object.assign(existing, snapshotUnit)
      } else {
        // Add new unit
        gameState.units.push(snapshotUnit)
      }
    })
  }
  
  // Sync buildings - update existing or add new ones
  if (Array.isArray(snapshot.buildings)) {
    const existingBuildings = gameState.buildings || []
    const snapshotBuildingIds = new Set(snapshot.buildings.map(b => b.id))
    
    // Remove buildings that no longer exist
    gameState.buildings = existingBuildings.filter(b => snapshotBuildingIds.has(b.id))
    
    // Update or add buildings
    snapshot.buildings.forEach(snapshotBuilding => {
      const existing = gameState.buildings.find(b => b.id === snapshotBuilding.id)
      if (existing) {
        // Update existing building properties
        Object.assign(existing, snapshotBuilding)
      } else {
        // Add new building
        gameState.buildings.push(snapshotBuilding)
      }
    })
  }
  
  // Sync bullets
  if (Array.isArray(snapshot.bullets)) {
    gameState.bullets = snapshot.bullets
  }
}

/**
 * Broadcast game state snapshot to all connected peers (host only)
 */
function broadcastGameStateSnapshot() {
  if (!isHost()) {
    return
  }
  
  const snapshot = createGameStateSnapshot()
  broadcastGameCommand(
    COMMAND_TYPES.GAME_STATE_SNAPSHOT,
    snapshot,
    gameState.humanPlayer
  )
}

/**
 * Start periodic game state synchronization (host only)
 */
export function startGameStateSync() {
  if (!isHost() || stateSyncHandle) {
    return
  }
  
  stateSyncHandle = setInterval(() => {
    if (hasActiveRemoteSession()) {
      broadcastGameStateSnapshot()
    }
  }, GAME_STATE_SYNC_INTERVAL_MS)
}

/**
 * Stop game state synchronization
 */
export function stopGameStateSync() {
  if (stateSyncHandle) {
    clearInterval(stateSyncHandle)
    stateSyncHandle = null
  }
}
