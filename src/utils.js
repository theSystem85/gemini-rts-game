// utils.js
import { TILE_SIZE } from './config.js'

export function tileToPixel(tileX, tileY) {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
}

export function getUniqueId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5)
}

/**
 * Calculate speed modifier based on unit health
 * Units below 25% health move at 50% speed
 * @param {Object} unit - The unit to calculate speed modifier for
 * @returns {number} Speed modifier (0.5 for damaged units, 1.0 for healthy units)
 */
export function calculateHealthSpeedModifier(unit) {
  if (!unit || !unit.health || !unit.maxHealth) {
    return 1.0
  }
  
  const healthPercentage = unit.health / unit.maxHealth
  
  // If below 25% health, move at 50% speed
  if (healthPercentage < 0.25) {
    return 0.5
  }
  
  return 1.0
}

/**
 * Update unit speed modifier based on current health and other factors
 * This combines health-based speed reduction with other speed modifiers
 * @param {Object} unit - The unit to update speed modifier for
 */
export function updateUnitSpeedModifier(unit) {
  if (!unit) return
  
  // Calculate health-based speed modifier
  const healthSpeedModifier = calculateHealthSpeedModifier(unit)
  
  // Get any existing speed modifier (from Tesla coil effects, etc.)
  const existingModifier = unit.baseSpeedModifier || 1.0
  
  // Combine modifiers (multiplicative)
  unit.speedModifier = healthSpeedModifier * existingModifier
}

/**
 * Initialize leveling system for a unit
 * @param {Object} unit - The unit to initialize leveling for
 */
export function initializeUnitLeveling(unit) {
  if (!unit || unit.type === 'harvester') return // Harvesters don't level up
  
  unit.level = unit.level || 0
  unit.experience = unit.experience || 0
  unit.baseCost = unit.baseCost || getUnitCost(unit.type)
}

/**
 * Get the cost of a unit type
 * @param {string} unitType - The type of unit
 * @returns {number} The cost of the unit
 */
function getUnitCost(unitType) {
  // Import UNIT_COSTS dynamically to avoid circular imports
  const costs = {
    tank: 1000,
    rocketTank: 2000,
    harvester: 500,
    'tank-v2': 2000,
    'tank-v3': 3000,
    tank_v1: 1000
  }
  return costs[unitType] || 1000
}

/**
 * Calculate experience required for next level
 * @param {number} currentLevel - Current level (0-3)
 * @param {number} baseCost - Base cost of the unit
 * @returns {number} Experience required for next level
 */
export function getExperienceRequiredForLevel(currentLevel, baseCost) {
  const multipliers = {
    1: 2, // Level 1 requires 2x unit cost
    2: 4, // Level 2 requires 4x unit cost  
    3: 6  // Level 3 requires 6x unit cost
  }
  
  return multipliers[currentLevel + 1] ? multipliers[currentLevel + 1] * baseCost : null
}

/**
 * Award experience to a unit for killing an enemy
 * @param {Object} unit - The unit that got the kill
 * @param {Object} killedUnit - The unit that was killed
 */
export function awardExperience(unit, killedUnit) {
  if (!unit || !killedUnit || unit.type === 'harvester') return
  
  initializeUnitLeveling(unit)
  
  // Award experience equal to the cost of the killed unit
  const experienceGained = getUnitCost(killedUnit.type)
  unit.experience += experienceGained
  
  // Check for level up
  checkLevelUp(unit)
}

/**
 * Check if unit should level up and apply level up if needed
 * @param {Object} unit - The unit to check for level up
 */
export function checkLevelUp(unit) {
  if (!unit || unit.level >= 3) return
  
  const experienceRequired = getExperienceRequiredForLevel(unit.level, unit.baseCost)
  if (experienceRequired && unit.experience >= experienceRequired) {
    unit.level++
    unit.experience = 0 // Reset experience for next level
    
    // Apply level bonuses
    applyLevelBonuses(unit)
    
    // Play level up sound or effect here if desired
    console.log(`Unit ${unit.id} leveled up to level ${unit.level}!`)
  }
}

/**
 * Apply bonuses based on unit level
 * @param {Object} unit - The unit to apply bonuses to
 */
export function applyLevelBonuses(unit) {
  if (!unit) return
  
  // Level 1: 20% range increase
  if (unit.level >= 1) {
    unit.rangeMultiplier = (unit.rangeMultiplier || 1) * 1.2
  }
  
  // Level 2: 50% armor increase
  if (unit.level >= 2) {
    if (unit.armor) {
      unit.armor *= 1.5
    } else {
      unit.armor = 1.5 // Give armor to units that don't have it
    }
  }
  
  // Level 3: Self-repair and 33% fire rate increase
  if (unit.level >= 3) {
    unit.selfRepair = true
    unit.fireRateMultiplier = (unit.fireRateMultiplier || 1) * 1.33
  }
}

/**
 * Get experience progress percentage for current level
 * @param {Object} unit - The unit to get progress for
 * @returns {number} Progress percentage (0-1)
 */
export function getExperienceProgress(unit) {
  if (!unit || unit.level >= 3) return 0
  
  initializeUnitLeveling(unit)
  const experienceRequired = getExperienceRequiredForLevel(unit.level, unit.baseCost)
  if (!experienceRequired) return 0
  
  return Math.min(unit.experience / experienceRequired, 1)
}

/**
 * Handle level 3 self-repair for units
 * @param {Object} unit - The unit to potentially heal
 * @param {number} now - Current timestamp
 */
export function handleSelfRepair(unit, now) {
  if (!unit || unit.level < 3 || !unit.selfRepair) return
  if (unit.health >= unit.maxHealth) return
  
  // Only repair when not moving
  const isMoving = unit.path && unit.path.length > 0
  if (isMoving) return
  
  // Repair 1% every 3 seconds
  const repairInterval = 3000 // 3 seconds
  const repairAmount = unit.maxHealth * 0.01 // 1% of max health
  
  if (!unit.lastRepairTime) {
    unit.lastRepairTime = now
    return
  }
  
  if (now - unit.lastRepairTime >= repairInterval) {
    unit.health = Math.min(unit.health + repairAmount, unit.maxHealth)
    unit.lastRepairTime = now
    
    // Update speed modifier since health changed
    updateUnitSpeedModifier(unit)
  }
}
