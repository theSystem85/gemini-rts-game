/**
 * aiDebug.js
 * 
 * Centralized debugging utilities for AI behavior. 
 * This helps in diagnosing complex AI state issues without cluttering the main logic files.
 */

import { TILE_SIZE } from '../config.js'
import { calculateDistance } from '../utils.js'

/**
 * Provides a detailed, color-coded snapshot of an AI unit's current state,
 * focusing on combat-related properties.
 * 
 * @param {object} unit The AI unit to inspect.
 * @param {string} context A message describing the context of the debug call (e.g., "Before Firing Check").
 */
export function debugAIState(unit, context) {
  if (!unit) {
    console.warn('debugAIState called with a null unit.')
    return
  }

  const now = performance.now()
  const target = unit.target

  // --- Styling for console output ---
  const styles = {
    header: 'color: white; background-color: #007bff; padding: 2px 5px; border-radius: 3px;',
    subheader: 'color: #ffc107; font-weight: bold;',
    label: 'font-weight: bold; color: #17a2b8;',
    value: 'color: #28a745;',
    error: 'color: red; font-weight: bold;',
    warn: 'color: orange;',
    neutral: 'color: #6c757d;'
  }

  console.group(`%cAI State Snapshot: ${unit.id} (${unit.type}) - ${context}`, styles.header)

  // --- General State ---
  console.log('%cGeneral', styles.subheader)
  console.log(`%cHealth:%c ${unit.health}/${unit.maxHealth}`, styles.label, styles.value)
  console.log(`%cOwner:%c ${unit.owner}`, styles.label, styles.value)
  console.log(`%cPosition:%c x: ${unit.x.toFixed(1)}, y: ${unit.y.toFixed(1)}`, styles.label, styles.value)

  // --- Combat State ---
  console.log('%cCombat', styles.subheader)
  const fireRate = unit.fireRate || 1000
  const lastShot = unit.lastShotTime ? `${(now - unit.lastShotTime).toFixed(0)}ms ago` : 'Never'
  const cooldownReady = !unit.lastShotTime || (now - unit.lastShotTime >= fireRate)
  console.log(`%cRange:%c ${unit.range * TILE_SIZE}px (${unit.range} tiles)`, styles.label, styles.value)
  console.log(`%cDamage:%c ${unit.damage}`, styles.label, styles.value)
  console.log(`%cFire Rate:%c ${fireRate}ms`, styles.label, styles.value)
  console.log(`%cLast Shot:%c ${lastShot}`, styles.label, cooldownReady ? styles.value : styles.warn)
  console.log(`%cCooldown Ready:%c ${cooldownReady}`, styles.label, cooldownReady ? styles.value : styles.error)

  // --- Defensive State ---
  console.log('%cDefense', styles.subheader)
  const isAttacked = unit.isBeingAttacked
  const lastAttacker = unit.lastAttacker
  console.log(`%cIs Being Attacked?:%c ${isAttacked}`, styles.label, isAttacked ? styles.error : styles.value)
  if (lastAttacker) {
    console.log(`%cLast Attacker:%c ${lastAttacker.id} (${lastAttacker.type})`, styles.label, styles.value)
  } else {
    console.log('%cLast Attacker:%c None', styles.label, styles.neutral)
  }

  // --- Target Info ---
  console.log('%cTarget', styles.subheader)
  if (target) {
    const distance = calculateDistance(unit.x, unit.y, target.x, target.y)
    const inRange = distance <= (unit.range * TILE_SIZE)
    console.log(`%cID:%c ${target.id} (${target.type})`, styles.label, styles.value)
    console.log(`%cHealth:%c ${target.health}/${target.maxHealth}`, styles.label, target.health > 0 ? styles.value : styles.error)
    console.log(`%cPosition:%c x: ${target.x.toFixed(1)}, y: ${target.y.toFixed(1)}`, styles.label, styles.value)
    console.log(`%cDistance:%c ${distance.toFixed(1)}px`, styles.label, styles.value)
    console.log(`%cIn Firing Range?:%c ${inRange}`, styles.label, inRange ? styles.value : styles.error)
  } else {
    console.log('%cNo Target Assigned', styles.error)
  }

  console.groupEnd()
}
