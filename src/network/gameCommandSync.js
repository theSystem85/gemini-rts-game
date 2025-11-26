/**
 * Game Command Synchronization Module
 * Handles broadcasting and receiving game commands (unit commands, build commands) between multiplayer sessions
 */

import { gameState } from '../gameState.js'
import { getActiveRemoteConnection } from './remoteConnection.js'
import { getActiveHostMonitor } from './webrtcSession.js'
import { placeBuilding } from '../buildings.js'
import { units as mainUnits, bullets as mainBullets } from '../main.js'

// Command types for synchronization
export const COMMAND_TYPES = {
  UNIT_MOVE: 'unit-move',
  UNIT_ATTACK: 'unit-attack',
  UNIT_STOP: 'unit-stop',
  UNIT_GUARD: 'unit-guard',
  BUILDING_PLACE: 'building-place',
  BUILDING_SELL: 'building-sell',
  BUILDING_DAMAGE: 'building-damage',
  PRODUCTION_START: 'production-start',
  PRODUCTION_CANCEL: 'production-cancel',
  UNIT_SPAWN: 'unit-spawn',  // Client requests host to spawn a unit
  GAME_PAUSE: 'game-pause',
  GAME_RESUME: 'game-resume',
  GAME_STATE_SNAPSHOT: 'game-state-snapshot',
  GAME_STATE_DELTA: 'game-state-delta',  // Delta updates for efficiency (future use)
  CLIENT_STATE_UPDATE: 'client-state-update'
}

// Last snapshot hash for delta sync (future use)
let _lastSnapshotHash = null

const GAME_COMMAND_MESSAGE_TYPE = 'game-command'

// Interval for game state snapshots (ms) - 100ms for smoother movement sync
// Note: This is a tradeoff between network bandwidth and visual smoothness
const GAME_STATE_SYNC_INTERVAL_MS = 100

// Queue for commands received from remote players (processed by host)
const pendingRemoteCommands = []

// Listeners for command reception
const commandListeners = new Set()

// Handle for periodic state sync
let stateSyncHandle = null

// Track if client has been initialized (first snapshot received)
let clientInitialized = false

// Store the client's partyId (for remote clients)
let clientPartyId = null

// Track if tech tree needs to be synced (after first buildings sync)
let needsTechTreeSync = true

// Reference to production controller for tech tree sync
let productionControllerRef = null

// ============ INTERPOLATION STATE ============
// Track unit positions for smooth interpolation between snapshots
const unitInterpolationState = new Map() // unitId -> { prevX, prevY, targetX, targetY, prevDir, targetDir, startTime }
let lastSnapshotTime = 0
const INTERPOLATION_DURATION_MS = GAME_STATE_SYNC_INTERVAL_MS // Match the sync interval

/**
 * Set the production controller reference for tech tree syncing
 * @param {Object} controller - ProductionController instance
 */
export function setProductionControllerRef(controller) {
  productionControllerRef = controller
}

/**
 * Request tech tree sync after buildings are synced from host
 */
function requestTechTreeSync() {
  if (productionControllerRef && typeof productionControllerRef.syncTechTreeWithBuildings === 'function') {
    // Delay slightly to ensure all buildings are fully initialized
    setTimeout(() => {
      productionControllerRef.syncTechTreeWithBuildings()
      console.log('[GameCommandSync] Tech tree synced with existing buildings')
    }, 100)
  }
}

/**
 * Update unit interpolation for smooth movement between snapshots (client only)
 * Call this every frame from the game loop
 */
export function updateUnitInterpolation() {
  if (isHost()) {
    return // Host doesn't need interpolation - it has the authoritative state
  }
  
  const now = performance.now()
  const elapsed = now - lastSnapshotTime
  const t = Math.min(1, elapsed / INTERPOLATION_DURATION_MS) // Clamp to 0-1
  
  // Interpolate each unit's position
  mainUnits.forEach(unit => {
    const state = unitInterpolationState.get(unit.id)
    if (!state) {
      return // No interpolation state for this unit
    }
    
    // Linear interpolation for position
    unit.x = state.prevX + (state.targetX - state.prevX) * t
    unit.y = state.prevY + (state.targetY - state.prevY) * t
    
    // Update tile position based on interpolated position
    unit.tileX = Math.floor(unit.x / 32) // TILE_SIZE = 32
    unit.tileY = Math.floor(unit.y / 32)
    
    // Interpolate direction (handle wraparound for angles)
    if (state.targetDir !== undefined && state.prevDir !== undefined) {
      let diff = state.targetDir - state.prevDir
      // Handle wraparound (angles go from 0 to 2*PI)
      if (diff > Math.PI) diff -= Math.PI * 2
      if (diff < -Math.PI) diff += Math.PI * 2
      unit.direction = state.prevDir + diff * t
    }
    
    // Interpolate turret direction if present
    if (state.targetTurretDir !== undefined && state.prevTurretDir !== undefined) {
      let diff = state.targetTurretDir - state.prevTurretDir
      if (diff > Math.PI) diff -= Math.PI * 2
      if (diff < -Math.PI) diff += Math.PI * 2
      unit.turretDirection = state.prevTurretDir + diff * t
    }
  })
}

/**
 * Set the client's party ID (called when remote client connects)
 * @param {string} partyId - The partyId this client controls
 */
export function setClientPartyId(partyId) {
  clientPartyId = partyId
  clientInitialized = false // Reset initialization flag for new connection
  needsTechTreeSync = true // Reset tech tree sync flag for new connection
}

/**
 * Get the client's party ID
 * @returns {string|null}
 */
export function getClientPartyId() {
  return clientPartyId
}

/**
 * Reset client state (called on disconnect)
 */
export function resetClientState() {
  clientPartyId = null
  clientInitialized = false
  needsTechTreeSync = true
}

/**
 * Check if the current session is the host
 * @returns {boolean}
 */
export function isHost() {
  return gameState.multiplayerSession?.localRole === 'host' || !gameState.multiplayerSession?.isRemote
}

/**
 * Check if a remote session is connected
 * @returns {boolean}
 */
function hasActiveRemoteSession() {
  const isRemote = Boolean(gameState.multiplayerSession?.isRemote)
  const activeConn = getActiveConnection()
  const result = isRemote || Boolean(activeConn)
  // Debug log to understand session state
  if (!result) {
    console.log('[hasActiveRemoteSession] No active session - isRemote:', isRemote, 'activeConn:', activeConn)
  }
  return result
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
  
  console.log('[GameCommandSync] Broadcasting command:', commandType, 'from party:', command.sourcePartyId, 'isHost:', command.isHost)
  
  if (isHost()) {
    // Host broadcasts to all connected peers
    broadcastToAllPeers(command)
  } else {
    // Remote client sends to host
    const remoteConn = getActiveRemoteConnection()
    console.log('[GameCommandSync] Client sending to host, connection:', remoteConn ? 'active' : 'null')
    if (remoteConn) {
      try {
        remoteConn.send(command)
        console.log('[GameCommandSync] Command sent successfully')
      } catch (err) {
        console.warn('Failed to send game command to host:', err)
      }
    } else {
      console.warn('[GameCommandSync] No active remote connection to send command')
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
 * @param {string} _sourceId - Identifier of the message source (unused but kept for API compatibility)
 */
export function handleReceivedCommand(command, _sourceId) {
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
    // Only accept commands from the party that the remote player controls (aiActive === false)
    const partyState = gameState.partyStates?.find(p => p.partyId === sourceParty)
    
    console.log('[Host] Received command from party:', sourceParty, 'type:', command.commandType)
    console.log('[Host] PartyState found:', partyState ? { partyId: partyState.partyId, aiActive: partyState.aiActive, owner: partyState.owner } : 'NOT FOUND')
    console.log('[Host] All partyStates:', gameState.partyStates?.map(p => ({ partyId: p.partyId, aiActive: p.aiActive })))
    
    if (!partyState) {
      console.warn('Received command from unknown party:', sourceParty)
      return
    }
    
    // Only reject if aiActive is explicitly true (AI controlled)
    // Accept if aiActive is false or undefined (human controlled)
    if (partyState.aiActive === true) {
      console.warn('Received command from AI-controlled party:', sourceParty)
      return
    }
    
    // Queue the command for processing
    pendingRemoteCommands.push({
      ...command,
      receivedAt: Date.now()
    })
    console.log('[Host] Command queued for processing, queue length:', pendingRemoteCommands.length)
    
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
    
    case COMMAND_TYPES.BUILDING_SELL:
      // Apply building sell command from remote player
      if (command.payload) {
        const { buildingId, sellStartTime } = command.payload
        const building = gameState.buildings.find(b => b.id === buildingId)
        if (building && !building.isBeingSold) {
          building.isBeingSold = true
          building.sellStartTime = sellStartTime
          // Note: Money is handled by the selling party, we just sync the visual state
        }
      }
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
 * Broadcast building damage from client to host
 * @param {string} buildingId - ID of damaged building
 * @param {number} damage - Amount of damage dealt
 * @param {number} newHealth - New health value after damage
 */
export function broadcastBuildingDamage(buildingId, damage, newHealth) {
  if (!hasActiveRemoteSession() || isHost()) {
    return // Only clients need to report damage to host
  }
  
  broadcastGameCommand(
    COMMAND_TYPES.BUILDING_DAMAGE,
    { buildingId, damage, newHealth },
    gameState.humanPlayer
  )
}

/**
 * Broadcast building sell action to other players
 * @param {string} buildingId - ID of the building being sold
 * @param {number} sellValue - Money received from selling
 * @param {number} sellStartTime - Time when sell animation started
 */
export function broadcastBuildingSell(buildingId, sellValue, sellStartTime) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  broadcastGameCommand(
    COMMAND_TYPES.BUILDING_SELL,
    { buildingId, sellValue, sellStartTime },
    gameState.humanPlayer
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
 * Broadcast a unit spawn request (client to host)
 * @param {string} unitType - Type of unit to spawn
 * @param {string} factoryId - ID of the factory to spawn from
 * @param {Object} rallyPoint - Optional rally point {x, y}
 */
export function broadcastUnitSpawn(unitType, factoryId, rallyPoint) {
  if (!hasActiveRemoteSession()) {
    return
  }
  
  broadcastGameCommand(
    COMMAND_TYPES.UNIT_SPAWN,
    { unitType, factoryId, rallyPoint },
    gameState.humanPlayer
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
  // Serialize units with essential properties - use mainUnits from main.js as that's the authoritative array
  const units = (mainUnits || []).map(unit => ({
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
    target: unit.target ? { id: unit.target.id, x: unit.target.x, y: unit.target.y } : null,
    moveTarget: unit.moveTarget,
    gas: unit.gas,
    maxGas: unit.maxGas,
    ammunition: unit.ammunition,
    maxAmmunition: unit.maxAmmunition,
    oreCarried: unit.oreCarried,
    crew: unit.crew,
    // Animation/firing state
    muzzleFlashStartTime: unit.muzzleFlashStartTime,
    recoilStartTime: unit.recoilStartTime,
    lastShotTime: unit.lastShotTime,
    // Movement state
    path: unit.path,
    pathIndex: unit.pathIndex,
    vx: unit.vx,
    vy: unit.vy,
    speed: unit.speed,
    // Combat state
    attackTarget: unit.attackTarget ? { id: unit.attackTarget.id } : null,
    guardPosition: unit.guardPosition,
    // Status effects
    isMoving: unit.isMoving,
    isAttacking: unit.isAttacking,
    remainingMines: unit.remainingMines,
    sweeping: unit.sweeping
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
    constructionStartTime: building.constructionStartTime,
    constructionFinished: building.constructionFinished,
    isBeingBuilt: building.isBeingBuilt,
    isBeingSold: building.isBeingSold,
    sellStartTime: building.sellStartTime,
    ammo: building.ammo,
    maxAmmo: building.maxAmmo,
    turretDirection: building.turretDirection,
    muzzleFlashStartTime: building.muzzleFlashStartTime
  }))
  
  // Serialize bullets/projectiles with full properties - use mainBullets from main.js as that's the authoritative array
  const bullets = (mainBullets || []).map(bullet => ({
    id: bullet.id,
    x: bullet.x,
    y: bullet.y,
    startX: bullet.startX,
    startY: bullet.startY,
    targetX: bullet.targetX,
    targetY: bullet.targetY,
    vx: bullet.vx,
    vy: bullet.vy,
    owner: bullet.owner,
    damage: bullet.damage,
    type: bullet.type,
    projectileType: bullet.projectileType,
    originType: bullet.originType,
    speed: bullet.speed,
    startTime: bullet.startTime,
    ballistic: bullet.ballistic,
    homing: bullet.homing,
    dx: bullet.dx,
    dy: bullet.dy,
    distance: bullet.distance,
    flightDuration: bullet.flightDuration,
    ballisticDuration: bullet.ballisticDuration,
    arcHeight: bullet.arcHeight
  }))
  
  // Serialize factories (construction yards) with essential properties
  const factories = (gameState.factories || []).map(factory => ({
    id: factory.id,
    type: factory.type,
    owner: factory.owner,
    x: factory.x,
    y: factory.y,
    width: factory.width,
    height: factory.height,
    health: factory.health,
    maxHealth: factory.maxHealth,
    budget: factory.budget,
    rallyPoint: factory.rallyPoint,
    productionCountdown: factory.productionCountdown
  }))
  
  // Serialize explosions
  const explosions = (gameState.explosions || []).map(exp => ({
    x: exp.x,
    y: exp.y,
    startTime: exp.startTime,
    duration: exp.duration,
    maxRadius: exp.maxRadius
  }))
  
  // Serialize unit wrecks
  const unitWrecks = (gameState.unitWrecks || []).map(wreck => ({
    id: wreck.id,
    sourceUnitId: wreck.sourceUnitId,
    type: wreck.type,
    x: wreck.x,
    y: wreck.y,
    tileX: wreck.tileX,
    tileY: wreck.tileY,
    direction: wreck.direction,
    turretDirection: wreck.turretDirection,
    createdAt: wreck.createdAt,
    owner: wreck.owner,
    health: wreck.health,
    maxHealth: wreck.maxHealth
  }))
  
  return {
    units,
    buildings,
    bullets,
    factories,
    explosions,
    unitWrecks,
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
  
  // On first snapshot, initialize client with their partyId
  if (!clientInitialized && clientPartyId) {
    gameState.humanPlayer = clientPartyId
    console.log('[GameCommandSync] Client initialized as party:', clientPartyId)
    
    // Mark as initialized so we only do this once
    clientInitialized = true
  }
  
  // Note: Money is NOT synced from host to client because each player has their own money!
  // The client manages their own gameState.money based on their actions.
  // If in the future we want to display other players' money, we'd use per-party tracking.
  
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
  
  // Sync units - update the mainUnits array from main.js (which is what rendering uses)
  // This ensures all units from all parties are visible
  // Use interpolation for smooth movement between snapshots
  if (Array.isArray(snapshot.units)) {
    const now = performance.now()
    
    // Create a map of existing units by ID for merging non-serialized properties
    const existingById = new Map()
    mainUnits.forEach(u => {
      if (u.id) existingById.set(u.id, u)
    })
    
    // Track which unit IDs are in this snapshot (to clean up removed units from interpolation state)
    const snapshotUnitIds = new Set()
    
    // Build the updated units array, preserving local-only properties (like cached sprites)
    const updatedUnits = snapshot.units.map(snapshotUnit => {
      snapshotUnitIds.add(snapshotUnit.id)
      const existing = existingById.get(snapshotUnit.id)
      
      if (existing) {
        // Set up interpolation: store current position as prev, snapshot as target
        unitInterpolationState.set(snapshotUnit.id, {
          prevX: existing.x,
          prevY: existing.y,
          targetX: snapshotUnit.x,
          targetY: snapshotUnit.y,
          prevDir: existing.direction,
          targetDir: snapshotUnit.direction,
          prevTurretDir: existing.turretDirection,
          targetTurretDir: snapshotUnit.turretDirection
        })
        
        // Merge all snapshot data EXCEPT position (which we'll interpolate)
        const { x, y, tileX, tileY, direction, turretDirection, ...nonPositionData } = snapshotUnit
        Object.assign(existing, nonPositionData)
        // Store target position for when interpolation completes
        existing._targetX = x
        existing._targetY = y
        existing._targetTileX = tileX
        existing._targetTileY = tileY
        existing._targetDirection = direction
        existing._targetTurretDirection = turretDirection
        return existing
      } else {
        // New unit from host - no interpolation, just place it
        unitInterpolationState.set(snapshotUnit.id, {
          prevX: snapshotUnit.x,
          prevY: snapshotUnit.y,
          targetX: snapshotUnit.x,
          targetY: snapshotUnit.y,
          prevDir: snapshotUnit.direction,
          targetDir: snapshotUnit.direction,
          prevTurretDir: snapshotUnit.turretDirection,
          targetTurretDir: snapshotUnit.turretDirection
        })
        return { ...snapshotUnit }
      }
    })
    
    // Clean up interpolation state for units that no longer exist
    for (const unitId of unitInterpolationState.keys()) {
      if (!snapshotUnitIds.has(unitId)) {
        unitInterpolationState.delete(unitId)
      }
    }
    
    // Update snapshot time for interpolation
    lastSnapshotTime = now
    
    // Replace contents of mainUnits array in-place (so GameLoop reference stays valid)
    mainUnits.length = 0
    mainUnits.push(...updatedUnits)
    
    // Also keep gameState.units in sync
    gameState.units = mainUnits
  }
  
  // Sync buildings - replace entire array from host snapshot
  // This ensures all buildings (including new ones) are properly synced
  if (Array.isArray(snapshot.buildings)) {
    // Create a map of existing buildings by ID and position for merging non-serialized properties
    const existingByIdOrPos = new Map()
    ;(gameState.buildings || []).forEach(b => {
      const key = b.id || `${b.type}_${b.x}_${b.y}`
      existingByIdOrPos.set(key, b)
    })
    
    // Track new buildings for occupancy map update
    const newBuildings = []
    
    // Replace buildings array with snapshot data, preserving any local-only properties
    gameState.buildings = snapshot.buildings.map(snapshotBuilding => {
      const key = snapshotBuilding.id || `${snapshotBuilding.type}_${snapshotBuilding.x}_${snapshotBuilding.y}`
      const existing = existingByIdOrPos.get(key)
      
      if (existing) {
        // Merge snapshot data into existing building to preserve non-synced properties
        // But respect construction animation state from snapshot
        Object.assign(existing, snapshotBuilding)
        return existing
      } else {
        // New building from host - use snapshot's construction state if available
        // Otherwise start construction animation
        const now = performance.now()
        const newBuilding = {
          ...snapshotBuilding,
          isBuilding: true,
          constructionFinished: snapshotBuilding.constructionFinished === true,
          constructionStartTime: snapshotBuilding.constructionStartTime || now
        }
        newBuildings.push(newBuilding)
        return newBuilding
      }
    })
    
    // Place new buildings in the map grid and occupancy map
    if (newBuildings.length > 0 && gameState.mapGrid) {
      newBuildings.forEach(building => {
        placeBuilding(building, gameState.mapGrid, gameState.occupancyMap)
      })
      
      // Trigger tech tree sync after buildings are added
      if (needsTechTreeSync) {
        needsTechTreeSync = false
        requestTechTreeSync()
      }
    }
  }
  
  // Sync factories
  if (Array.isArray(snapshot.factories)) {
    const existingFactories = gameState.factories || []
    const snapshotFactoryIds = new Set(snapshot.factories.map(f => f.id))
    
    // Remove factories that no longer exist
    gameState.factories = existingFactories.filter(f => snapshotFactoryIds.has(f.id))
    
    // Update or add factories
    snapshot.factories.forEach(snapshotFactory => {
      const existing = gameState.factories.find(f => f.id === snapshotFactory.id)
      if (existing) {
        // Update existing factory properties
        Object.assign(existing, snapshotFactory)
      } else {
        // Add new factory
        gameState.factories.push(snapshotFactory)
      }
    })
  }
  
  // Sync bullets - update the mainBullets array from main.js
  if (Array.isArray(snapshot.bullets)) {
    // Replace contents of mainBullets array in-place
    mainBullets.length = 0
    mainBullets.push(...snapshot.bullets)
    
    // Also keep gameState.bullets in sync
    gameState.bullets = mainBullets
  }
  
  // Sync explosions
  if (Array.isArray(snapshot.explosions)) {
    // Merge explosions - add new ones that don't exist locally
    const existingExplosions = gameState.explosions || []
    const existingKeys = new Set(existingExplosions.map(e => `${e.x}_${e.y}_${e.startTime}`))
    
    snapshot.explosions.forEach(exp => {
      const key = `${exp.x}_${exp.y}_${exp.startTime}`
      if (!existingKeys.has(key)) {
        existingExplosions.push(exp)
      }
    })
    gameState.explosions = existingExplosions
  }
  
  // Sync unit wrecks
  if (Array.isArray(snapshot.unitWrecks)) {
    // Initialize if needed
    if (!gameState.unitWrecks) {
      gameState.unitWrecks = []
    }
    
    // Create a map of existing wrecks by ID
    const existingById = new Map()
    gameState.unitWrecks.forEach(w => {
      if (w.id) existingById.set(w.id, w)
    })
    
    // Sync wrecks from snapshot
    const updatedWrecks = snapshot.unitWrecks.map(snapshotWreck => {
      const existing = existingById.get(snapshotWreck.id)
      if (existing) {
        // Update existing wreck
        Object.assign(existing, snapshotWreck)
        return existing
      } else {
        // New wreck from host
        return { ...snapshotWreck }
      }
    })
    
    // Replace wrecks array
    gameState.unitWrecks = updatedWrecks
  }
}

/**
 * Create a client state update for the host
 * Only includes units and buildings owned by this client
 * @returns {Object}
 */
function createClientStateUpdate() {
  const partyId = gameState.humanPlayer
  
  // Only include units owned by this client - use mainUnits as that's authoritative
  const units = mainUnits
    .filter(u => u.owner === partyId)
    .map(unit => ({
      id: unit.id,
      x: unit.x,
      y: unit.y,
      health: unit.health,
      direction: unit.direction,
      turretDirection: unit.turretDirection,
      gas: unit.gas,
      ammunition: unit.ammunition,
      crew: unit.crew,
      muzzleFlashStartTime: unit.muzzleFlashStartTime,
      recoilStartTime: unit.recoilStartTime,
      target: unit.target ? { id: unit.target.id } : null,
      moveTarget: unit.moveTarget,
      path: unit.path,
      remainingMines: unit.remainingMines,
      sweeping: unit.sweeping
    }))
  
  // Only include buildings owned by this client
  const buildings = (gameState.buildings || [])
    .filter(b => b.owner === partyId)
    .map(building => ({
      id: building.id,
      health: building.health,
      constructionStartTime: building.constructionStartTime,
      constructionFinished: building.constructionFinished,
      ammo: building.ammo,
      turretDirection: building.turretDirection,
      muzzleFlashStartTime: building.muzzleFlashStartTime
    }))
  
  // Include explosions created by this client's units
  const explosions = (gameState.explosions || []).map(exp => ({
    x: exp.x,
    y: exp.y,
    startTime: exp.startTime,
    duration: exp.duration,
    maxRadius: exp.maxRadius
  }))
  
  return {
    partyId,
    units,
    buildings,
    explosions,
    timestamp: Date.now()
  }
}

/**
 * Send client state update to host (client only)
 */
function sendClientStateUpdate() {
  if (isHost() || !hasActiveRemoteSession()) {
    return
  }
  
  const update = createClientStateUpdate()
  broadcastGameCommand(
    COMMAND_TYPES.CLIENT_STATE_UPDATE,
    update,
    gameState.humanPlayer
  )
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

// Handle for client state sync
let clientSyncHandle = null

/**
 * Start periodic game state synchronization
 * Host broadcasts full snapshots to clients
 * Clients do NOT send state updates - they only send user commands
 */
export function startGameStateSync() {
  if (isHost()) {
    // Host: broadcast full snapshots
    if (stateSyncHandle) return
    
    stateSyncHandle = setInterval(() => {
      if (hasActiveRemoteSession()) {
        broadcastGameStateSnapshot()
      }
    }, GAME_STATE_SYNC_INTERVAL_MS)
  }
  // Note: Client no longer sends periodic state updates
  // Client only sends user commands (move, attack, build, etc.)
}

/**
 * Stop game state synchronization
 */
export function stopGameStateSync() {
  if (stateSyncHandle) {
    clearInterval(stateSyncHandle)
    stateSyncHandle = null
  }
  if (clientSyncHandle) {
    clearInterval(clientSyncHandle)
    clientSyncHandle = null
  }
}

// Note: Interpolation removed - using faster sync interval (100ms) for smooth movement

/**
 * Check if this client is in a multiplayer session as a remote player
 * @returns {boolean}
 */
export function isRemoteClient() {
  return !isHost() && gameState.multiplayerSession?.isRemote === true
}
