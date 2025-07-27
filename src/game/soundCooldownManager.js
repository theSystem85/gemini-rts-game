// soundCooldownManager.js - Manages sound cooldowns to prevent spamming
import { CRITICAL_DAMAGE_SOUND_COOLDOWN } from '../config.js'

// Map to track last critical damage sound time per unit ID
const lastCriticalDamageSoundTime = new Map()

/**
 * Check if critical damage sound can be played for a unit
 * @param {Object} unit - The unit that would play the sound
 * @param {number} currentTime - Current timestamp
 * @returns {boolean} True if sound can be played
 */
export function canPlayCriticalDamageSound(unit, currentTime) {
  if (!unit || !unit.id) return false

  const lastSoundTime = lastCriticalDamageSoundTime.get(unit.id)

  if (!lastSoundTime) {
    return true // Never played before
  }

  return (currentTime - lastSoundTime) >= CRITICAL_DAMAGE_SOUND_COOLDOWN
}

/**
 * Record that critical damage sound was played for a unit
 * @param {Object} unit - The unit that played the sound
 * @param {number} currentTime - Current timestamp
 */
export function recordCriticalDamageSoundPlayed(unit, currentTime) {
  if (!unit || !unit.id) return

  lastCriticalDamageSoundTime.set(unit.id, currentTime)
}

/**
 * Clean up sound cooldown tracking for destroyed units
 * @param {Array} units - Current array of units
 */
export function cleanupSoundCooldowns(units) {
  if (!units || units.length === 0) {
    lastCriticalDamageSoundTime.clear()
    return
  }

  const activeUnitIds = new Set(units.map(unit => unit.id).filter(id => id))

  // Remove entries for units that no longer exist
  for (const unitId of lastCriticalDamageSoundTime.keys()) {
    if (!activeUnitIds.has(unitId)) {
      lastCriticalDamageSoundTime.delete(unitId)
    }
  }
}
