// attackNotifications.js - System for playing attack notification sounds with throttling
import { playSound } from '../sound.js'
import { gameState } from '../gameState.js'

// Track last notification times to implement throttling (only once per minute)
const NOTIFICATION_COOLDOWN = 60000 // 60 seconds

let lastBaseAttackNotification = 0
let lastHarvesterAttackNotification = 0

/**
 * Check if a unit/building belongs to the human player
 */
function isPlayerOwned(entity) {
  const humanPlayer = gameState.humanPlayer || 'player1'
  return entity.owner === humanPlayer || (humanPlayer === 'player1' && entity.owner === 'player')
}

/**
 * Check if a unit/building is a player base structure
 */
function isPlayerBase(entity) {
  if (!isPlayerOwned(entity)) return false

  // Check for construction yard (factory)
  if (entity.id && entity.id === gameState.humanPlayer) return true

  // Check for base buildings
  if (entity.type) {
    const baseBuildings = [
      'constructionYard',
      'powerPlant',
      'oreRefinery',
      'vehicleFactory',
      'barracks',
      'warFactory',
      'techCenter',
      'communications',
      'radar'
    ]
    return baseBuildings.includes(entity.type)
  }

  return false
}

/**
 * Check if a unit is a player harvester
 */
function isPlayerHarvester(unit) {
  return isPlayerOwned(unit) && unit.type === 'harvester'
}

/**
 * Handle attack notifications when units/buildings take damage
 * Should be called from the bullet system when damage is dealt
 */
export function handleAttackNotification(target, attacker, now) {
  // Only trigger notifications if attacker is an enemy
  if (!attacker || isPlayerOwned(attacker)) return

  // Check for base under attack
  if (isPlayerBase(target)) {
    if (now - lastBaseAttackNotification >= NOTIFICATION_COOLDOWN) {
      playSound('ourBaseIsUnderAttack', 1.0, 0, true) // Use stackable sound queue
      lastBaseAttackNotification = now
    }
  }

  // Check for harvester under attack
  if (isPlayerHarvester(target)) {
    if (now - lastHarvesterAttackNotification >= NOTIFICATION_COOLDOWN) {
      playSound('ourHarvestersAreUnderAttack', 1.0, 0, true) // Use stackable sound queue
      lastHarvesterAttackNotification = now
    }
  }
}

/**
 * Reset notification cooldowns (useful for testing or game restart)
 */
export function resetAttackNotifications() {
  lastBaseAttackNotification = 0
  lastHarvesterAttackNotification = 0
}
