// waypointSounds.js - System for tracking waypoint addition and playing appropriate sounds
import { playSound } from '../sound.js'

// Track if any waypoints were added during the current Alt key press
let waypointsAddedDuringAltPress = false

/**
 * Mark that waypoints were added during Alt key press
 */
export function markWaypointsAdded() {
  waypointsAddedDuringAltPress = true
}

/**
 * Handle Alt key release - play sound if waypoints were added
 */
export function handleAltKeyRelease() {
  if (waypointsAddedDuringAltPress) {
    playSound('chainOfCommandsReceived', 1.0, 0, true) // Use stackable sound queue
    waypointsAddedDuringAltPress = false
  }
}

/**
 * Reset waypoint tracking (useful when Alt key is pressed)
 */
export function resetWaypointTracking() {
  waypointsAddedDuringAltPress = false
}
