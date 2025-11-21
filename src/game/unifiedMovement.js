// unifiedMovement.js - Unified movement system for all ground units
import {
  TILE_SIZE,
  STUCK_CHECK_INTERVAL,
  STUCK_THRESHOLD,
  STUCK_HANDLING_COOLDOWN,
  DODGE_ATTEMPT_COOLDOWN,
  STREET_SPEED_MULTIPLIER,
  TILE_LENGTH_METERS,
  COLLISION_BOUNCE_REMOTE_BOOST,
  COLLISION_BOUNCE_SPEED_FACTOR,
  COLLISION_BOUNCE_OVERLAP_FACTOR,
  COLLISION_BOUNCE_MIN,
  COLLISION_BOUNCE_MAX,
  COLLISION_RECOIL_FACTOR_FAST,
  COLLISION_RECOIL_MAX_FAST,
  COLLISION_RECOIL_PUSH_OTHER_FACTOR,
  COLLISION_RECOIL_PUSH_OTHER_MAX,
  COLLISION_SEPARATION_SCALE,
  COLLISION_SEPARATION_MAX,
  COLLISION_SEPARATION_MIN,
  COLLISION_NORMAL_DAMPING_MULT,
  COLLISION_NORMAL_DAMPING_MAX,
  WRECK_COLLISION_REMOTE_BOOST,
  WRECK_COLLISION_SPEED_FACTOR,
  WRECK_COLLISION_OVERLAP_FACTOR,
  WRECK_COLLISION_MIN,
  WRECK_COLLISION_MAX,
  WRECK_COLLISION_RECOIL_FACTOR_UNIT,
  WRECK_COLLISION_RECOIL_MAX_UNIT,
  STATIC_COLLISION_BOUNCE_MULT,
  STATIC_COLLISION_BOUNCE_OVERLAP,
  STATIC_COLLISION_BOUNCE_MIN,
  STATIC_COLLISION_BOUNCE_MAX
} from '../config.js'
import { clearStuckHarvesterOreField, handleStuckHarvester } from './harvesterLogic.js'
import { updateUnitOccupancy, findPath, removeUnitOccupancy } from '../units.js'
import { playPositionalSound, playSound, audioContext, getMasterVolume } from '../sound.js'
import { gameState } from '../gameState.js'
import { detonateTankerTruck } from './tankerTruckUtils.js'
import { smoothRotateTowardsAngle as smoothRotate } from '../logic.js'

const BASE_FRAME_SECONDS = 1 / 60
const ROTOR_AIRBORNE_SPEED = 0.35
const ROTOR_GROUNDED_SPEED = 0
const ROTOR_SPINUP_RESPONSE = 4
const ROTOR_SPINDOWN_RESPONSE = 1.5
const ROTOR_STOP_EPSILON = 0.002
const APACHE_ROTOR_LOOP_VOLUME = 0.25
const APACHE_ROTOR_ALTITUDE_GAIN_MIN = 0.6
const APACHE_ROTOR_ALTITUDE_GAIN_MAX = 1.0

const STATIC_COLLISION_SEPARATION_SCALE = 0.3
const STATIC_COLLISION_SEPARATION_MIN = 0.25
const STATIC_COLLISION_SEPARATION_MAX = 6
const STATIC_COLLISION_GRACE_PERIOD = 650

function calculatePositionalAudio(x, y) {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) {
    return { pan: 0, volumeFactor: 1 }
  }
  const centerX = gameState.scrollOffset.x + canvas.width / 2
  const centerY = gameState.scrollOffset.y + canvas.height / 2
  const dx = x - centerX
  const dy = y - centerY
  const distance = Math.hypot(dx, dy)
  const maxDistance = Math.max(canvas.width, canvas.height) * 0.75
  const volumeFactor = Math.max(0, 1 - distance / maxDistance)
  const pan = Math.max(-1, Math.min(1, dx / maxDistance))
  return { pan, volumeFactor }
}

export function hasFriendlyUnitOnTile(unit, tileX, tileY, units = []) {
  if (!unit || !Number.isFinite(tileX) || !Number.isFinite(tileY) || !Array.isArray(units)) {
    return false
  }

  for (const otherUnit of units) {
    if (!otherUnit || otherUnit.id === unit.id || otherUnit.health <= 0) continue
    if (!isGroundUnit(otherUnit)) continue

    const otherTileX = Math.floor((otherUnit.x + TILE_SIZE / 2) / TILE_SIZE)
    const otherTileY = Math.floor((otherUnit.y + TILE_SIZE / 2) / TILE_SIZE)

    if (otherTileX === tileX && otherTileY === tileY) {
      if (!ownersAreEnemies(unit.owner, otherUnit.owner)) {
        return true
      }
    }
  }

  return false
}

function addUnitOccupancyDirect(unit, occupancyMap) {
  if (!occupancyMap) return
  const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  if (
    tileX >= 0 &&
    tileY >= 0 &&
    tileY < occupancyMap.length &&
    tileX < occupancyMap[0].length
  ) {
    occupancyMap[tileY][tileX] = (occupancyMap[tileY][tileX] || 0) + 1
  }
}

function consumeUnitGas(unit, amount) {
  if (!unit || typeof unit.gas !== 'number') {
    return
  }
  if (amount <= 0) {
    return
  }

  const prevGas = unit.gas
  unit.gas = Math.max(0, unit.gas - amount)

  if (prevGas > 0 && unit.gas <= 0 && !unit.outOfGasPlayed) {
    playSound('outOfGas')
    unit.outOfGasPlayed = true
    unit.needsEmergencyFuel = true
    unit.emergencyFuelRequestTime = performance.now()
  }
}

function updateApacheFlightState(unit, movement, occupancyMap, now) {
  const rotor = unit.rotor || { angle: 0, speed: 0, targetSpeed: 0 }
  unit.rotor = rotor
  const shadow = unit.shadow || { offset: 0, scale: 1 }
  unit.shadow = shadow

  const deltaMs = Math.max(16, now - (unit.lastFlightUpdate || now))
  unit.lastFlightUpdate = now
  const deltaSeconds = deltaMs / 1000

  let manualState = unit.manualFlightState || 'auto'
  let landingBlocked = false

  if (manualState === 'land' && occupancyMap) {
    const centerTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const centerTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

    const row =
      centerTileY >= 0 && centerTileY < occupancyMap.length
        ? occupancyMap[centerTileY]
        : null

    if (row && centerTileX >= 0 && centerTileX < row.length) {
      const occupancy = row[centerTileX] || 0
      const helipadLandingActive = Boolean(unit.helipadLandingRequested || unit.landedHelipadId)

      landingBlocked = occupancy > 0 && !helipadLandingActive
      if (landingBlocked) {
        manualState = 'hover'
        unit.manualFlightState = 'hover'
        unit.autoHoldAltitude = true
      }
    }
  }

  if (!landingBlocked && unit.blockedFromLanding) {
    unit.blockedFromLanding = false
  } else if (landingBlocked) {
    unit.blockedFromLanding = true
  }
  const holdAltitude = Boolean(unit.autoHoldAltitude) || Boolean(unit.flightPlan) || Boolean(unit.remoteControlActive)
  const isInMotion = Boolean(movement?.isMoving) || (unit.path && unit.path.length > 0) || Boolean(unit.moveTarget)

  let desiredAltitude = 0
  if (manualState === 'takeoff') {
    desiredAltitude = unit.maxAltitude
  } else if (manualState === 'land') {
    desiredAltitude = 0
  } else if (manualState === 'hover') {
    desiredAltitude = unit.maxAltitude * 0.75
  } else {
    desiredAltitude = (holdAltitude || isInMotion) ? unit.maxAltitude : 0
  }

  if (landingBlocked) {
    const safeHoverAltitude = Math.max(unit.altitude, unit.maxAltitude * 0.35)
    desiredAltitude = safeHoverAltitude
  }

  unit.targetAltitude = desiredAltitude

  const altitudeDiff = desiredAltitude - unit.altitude
  const climbRate = unit.maxAltitude * (manualState === 'land' ? 2.5 : 3)
  const maxStep = climbRate * deltaSeconds
  const altitudeStep = Math.max(-maxStep, Math.min(maxStep, altitudeDiff))
  unit.altitude = Math.max(0, unit.altitude + altitudeStep)

  let newFlightState = unit.flightState
  if (unit.altitude > 2 && altitudeDiff > 0.5) {
    newFlightState = 'takeoff'
  } else if (unit.altitude > 2 && Math.abs(altitudeDiff) <= 1) {
    newFlightState = 'airborne'
  } else if (unit.altitude <= 2 && altitudeDiff < -0.5) {
    newFlightState = 'landing'
  } else if (unit.altitude <= 2) {
    newFlightState = 'grounded'
  }

  const previouslyGrounded = unit.flightState === 'grounded' || unit.flightState === undefined
  const hadGroundOccupancy =
    unit.groundedOccupancyApplied !== undefined
      ? Boolean(unit.groundedOccupancyApplied)
      : !unit.occupancyRemoved
  unit.flightState = newFlightState

  const isGroundedNow = unit.flightState === 'grounded'
  const onHelipadNow = isGroundedNow && Boolean(unit.landedHelipadId)

  if (!isGroundedNow) {
    if (previouslyGrounded && hadGroundOccupancy) {
      removeUnitOccupancy(unit, occupancyMap, { ignoreFlightState: true })
    }
    unit.groundedOccupancyApplied = false
    unit.occupancyRemoved = true
    unit.lastGroundedOnHelipad = false
  } else {
    if (onHelipadNow) {
      if (hadGroundOccupancy) {
        removeUnitOccupancy(unit, occupancyMap, { ignoreFlightState: true })
      }
      unit.groundedOccupancyApplied = false
      unit.occupancyRemoved = true
    } else if (!hadGroundOccupancy) {
      addUnitOccupancyDirect(unit, occupancyMap)
      unit.groundedOccupancyApplied = true
      unit.occupancyRemoved = false
    }
    if (!onHelipadNow && hadGroundOccupancy) {
      unit.occupancyRemoved = false
    }
    unit.lastGroundedOnHelipad = onHelipadNow
  }

  const rotorTargetSpeed = unit.flightState === 'grounded'
    ? ROTOR_GROUNDED_SPEED
    : ROTOR_AIRBORNE_SPEED
  const rotorResponse = unit.flightState === 'grounded'
    ? ROTOR_SPINDOWN_RESPONSE
    : ROTOR_SPINUP_RESPONSE
  rotor.speed += (rotorTargetSpeed - rotor.speed) * Math.min(1, deltaSeconds * rotorResponse)
  if (unit.flightState === 'grounded' && Math.abs(rotor.speed - ROTOR_GROUNDED_SPEED) < ROTOR_STOP_EPSILON) {
    rotor.speed = ROTOR_GROUNDED_SPEED
  }
  rotor.angle = (rotor.angle + rotor.speed * deltaMs) % (Math.PI * 2)
  rotor.targetSpeed = rotorTargetSpeed

  const altitudeRatio = Math.min(1, unit.maxAltitude > 0 ? unit.altitude / unit.maxAltitude : 0)
  shadow.offset = altitudeRatio * TILE_SIZE * 1.8
  shadow.scale = 1 + altitudeRatio * 0.5

  if (manualState === 'takeoff' && unit.altitude >= unit.maxAltitude * 0.95) {
    unit.manualFlightState = 'auto'
  } else if (manualState === 'land' && unit.altitude <= 1) {
    unit.manualFlightState = 'auto'
  }

  if (unit.dodgeVelocity) {
    if (now < unit.dodgeVelocity.endTime) {
      unit.x += unit.dodgeVelocity.vx * deltaSeconds
      unit.y += unit.dodgeVelocity.vy * deltaSeconds
    } else {
      unit.dodgeVelocity = null
    }
  }

  const isHovering = unit.flightState === 'airborne' && (!movement || movement.currentSpeed < 0.1)
  unit.hovering = isHovering

  if (typeof unit.gas === 'number' && unit.gas > 0) {
    const shouldConsumeHoverFuel = isHovering && !unit.helipadLandingRequested && manualState !== 'land'
    if (shouldConsumeHoverFuel) {
      const frameScale = Math.max(0, Math.min(deltaSeconds / BASE_FRAME_SECONDS, 6))
      const airSpeed = unit.airCruiseSpeed || unit.speed || MOVEMENT_CONFIG.MAX_SPEED
      const hoverEquivalentPixels = airSpeed * frameScale
      const metersPerPixel = TILE_LENGTH_METERS / TILE_SIZE
      const hoverMeters = hoverEquivalentPixels * metersPerPixel
      const hoverUsage = (unit.gasConsumption || 0) * hoverMeters / 100000 * (unit.hoverFuelMultiplier || 0.2)
      consumeUnitGas(unit, hoverUsage)
    }
  }

  const shouldPlayRotorSound =
    unit.health > 0 &&
    !unit.destroyed &&
    unit.flightState &&
    unit.flightState !== 'grounded'

  if (shouldPlayRotorSound) {
    const altitudeRatio = unit.maxAltitude > 0 ? Math.min(1, unit.altitude / unit.maxAltitude) : 0
    const altitudeGain =
      APACHE_ROTOR_ALTITUDE_GAIN_MIN +
      altitudeRatio * (APACHE_ROTOR_ALTITUDE_GAIN_MAX - APACHE_ROTOR_ALTITUDE_GAIN_MIN)

    if (!unit.rotorSound && !unit.rotorSoundLoading) {
      unit.rotorSoundLoading = true
      playPositionalSound('apache_fly', unit.x, unit.y, APACHE_ROTOR_LOOP_VOLUME, 0, false, { playLoop: true })
        .then(handle => {
          unit.rotorSoundLoading = false
          if (!handle) {
            return
          }

          const stillAirborne =
            unit.health > 0 &&
            !unit.destroyed &&
            unit.flightState &&
            unit.flightState !== 'grounded'

          if (!stillAirborne) {
            try {
              handle.source.stop()
            } catch (e) {
              console.error('Failed to stop apache rotor sound after landing:', e)
            }
            return
          }

          const altitudeRatioNow = unit.maxAltitude > 0 ? Math.min(1, unit.altitude / unit.maxAltitude) : 0
          const altitudeGainNow =
            APACHE_ROTOR_ALTITUDE_GAIN_MIN +
            altitudeRatioNow * (APACHE_ROTOR_ALTITUDE_GAIN_MAX - APACHE_ROTOR_ALTITUDE_GAIN_MIN)

          const { pan, volumeFactor } = calculatePositionalAudio(unit.x, unit.y)
          const targetGain =
            APACHE_ROTOR_LOOP_VOLUME *
            volumeFactor *
            altitudeGainNow *
            getMasterVolume()

          if (handle.gainNode) {
            handle.gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            handle.gainNode.gain.linearRampToValueAtTime(targetGain, audioContext.currentTime + 0.4)
          }
          if (handle.panner) {
            handle.panner.pan.value = pan
          }

          handle.baseVolume = APACHE_ROTOR_LOOP_VOLUME
          unit.rotorSound = handle
        })
        .catch(error => {
          unit.rotorSoundLoading = false
          console.error('Error playing apache rotor loop:', error)
        })
    } else if (unit.rotorSound) {
      const { pan, volumeFactor } = calculatePositionalAudio(unit.x, unit.y)
      const targetGain =
        (unit.rotorSound.baseVolume || APACHE_ROTOR_LOOP_VOLUME) *
        volumeFactor *
        altitudeGain *
        getMasterVolume()

      if (unit.rotorSound.panner) {
        unit.rotorSound.panner.pan.value = pan
      }
      if (unit.rotorSound.gainNode) {
        unit.rotorSound.gainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.05)
      }
    }
  } else {
    if (unit.rotorSound) {
      const { source, gainNode } = unit.rotorSound
      if (gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime)
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3)
      }
      if (source) {
        try {
          source.stop(audioContext.currentTime + 0.3)
        } catch (e) {
          console.error('Failed to schedule apache rotor sound stop:', e)
        }
      }
      unit.rotorSound = null
    }
    unit.rotorSoundLoading = false
  }
}

/**
 * Unified movement configuration
 */
const MOVEMENT_CONFIG = {
  ACCELERATION: 0.15,      // How quickly units accelerate (increased for more visible effect)
  DECELERATION: 0.20,      // How quickly units decelerate (faster than acceleration)
  ROTATION_SPEED: 0.12,    // How fast units rotate (radians per frame)
  MAX_SPEED: 0.9,          // Maximum movement speed (50% slower: 1.8 * 0.5 = 0.9)
  MIN_SPEED: 0.05,         // Minimum speed before stopping
  COLLISION_BUFFER: 8,     // Buffer distance for collision avoidance
  MIN_UNIT_DISTANCE: 24,   // Minimum distance between unit centers (increased from implicit 16)
  AVOIDANCE_FORCE: 0.3,    // Strength of collision avoidance force
  BACKWARD_MOVE_THRESHOLD: 0.5  // When to allow backward movement when stuck
}

const LOCAL_LOOKAHEAD_STEPS = [0.35, 0.7] // In tiles, short-range probes to deflect before collisions
const LOCAL_LOOKAHEAD_STRENGTH = 0.55     // Multiplier for obstacle lookahead avoidance

export const UNIT_COLLISION_MIN_DISTANCE = MOVEMENT_CONFIG.MIN_UNIT_DISTANCE

/**
 * Initialize movement properties for a unit
 */
export function initializeUnitMovement(unit) {
  if (!unit.movement) {
    unit.movement = {
      velocity: { x: 0, y: 0 },
      targetVelocity: { x: 0, y: 0 },
      rotation: unit.rotation || 0,
      targetRotation: unit.rotation || 0,
      isMoving: false,
      currentSpeed: 0
    }
  }
}

/**
 * Update unit position using natural movement physics
 */
export function updateUnitPosition(unit, mapGrid, occupancyMap, now, units = [], gameState = null, factories = null) {
  initializeUnitMovement(unit)

  const hasRestorationOverride = Boolean(unit.restorationMoveOverride)

  if (!hasRestorationOverride && typeof unit.gas === 'number' && unit.gas <= 0) {
    if (!unit.outOfGasPlayed) {
      playSound('outOfGas')
      unit.outOfGasPlayed = true
    }
    unit.path = []
    unit.moveTarget = null
    unit.movement.velocity = { x: 0, y: 0 }
    unit.movement.targetVelocity = { x: 0, y: 0 }
    unit.movement.isMoving = false
    unit.movement.currentSpeed = 0
    if (unit.type === 'apache') {
      unit.flightPlan = null
      unit.autoHoldAltitude = false
      unit.helipadLandingRequested = false
      if (unit.flightState !== 'grounded') {
        unit.manualFlightState = 'land'
      }
    }
    return
  } else if (unit.gas > 0 && unit.needsEmergencyFuel) {
    // Clear emergency fuel flag if unit has gas again
    unit.needsEmergencyFuel = false
    unit.emergencyFuelRequestTime = null
  }

  // **HARVESTER MOVEMENT RESTRICTIONS** - Prevent movement during critical operations
  if (unit.type === 'harvester') {
    // Harvester cannot move while harvesting ore
    if (unit.harvesting) {
      unit.path = [] // Clear any pending movement
      unit.moveTarget = null
      unit.movement.velocity = { x: 0, y: 0 }
      unit.movement.targetVelocity = { x: 0, y: 0 }
      unit.movement.isMoving = false
      unit.movement.currentSpeed = 0
      return // Exit early - no movement allowed
    }

    // Harvester cannot move while unloading at refinery
    if (unit.unloadingAtRefinery) {
      unit.path = [] // Clear any pending movement
      unit.moveTarget = null
      unit.movement.velocity = { x: 0, y: 0 }
      unit.movement.targetVelocity = { x: 0, y: 0 }
      unit.movement.isMoving = false
      unit.movement.currentSpeed = 0
      return // Exit early - no movement allowed
    }
  }

  // **CREW MOVEMENT RESTRICTIONS** - Check crew status (exclude ambulance for AI)
  if (!hasRestorationOverride && unit.crew && typeof unit.crew === 'object' && !unit.crew.driver && unit.type !== 'ambulance') {
    // Tank cannot move without driver
    unit.path = [] // Clear any pending movement
    unit.moveTarget = null
    unit.movement.velocity = { x: 0, y: 0 }
    unit.movement.targetVelocity = { x: 0, y: 0 }
    unit.movement.isMoving = false
    unit.movement.currentSpeed = 0
    return // Exit early - no movement allowed
  }

  // Units undergoing repair should not move
  if (unit.repairingAtWorkshop) {
    unit.path = []
    unit.moveTarget = null
    unit.movement.velocity = { x: 0, y: 0 }
    unit.movement.targetVelocity = { x: 0, y: 0 }
    unit.movement.isMoving = false
    unit.movement.currentSpeed = 0
    return
  }

  const movement = unit.movement
  const speedModifier = unit.speedModifier || 1
  const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  const onStreet = mapGrid[tileY] && mapGrid[tileY][tileX] && mapGrid[tileY][tileX].type === 'street'

  // Special handling for ambulance speed on streets
  let terrainMultiplier = onStreet ? STREET_SPEED_MULTIPLIER : 1
  if (unit.type === 'ambulance' && onStreet) {
    // Use ambulance-specific street speed multiplier from config
    const ambulanceProps = unit.ambulanceProps || { streetSpeedMultiplier: 6.0 }
    terrainMultiplier = ambulanceProps.streetSpeedMultiplier || 6.0
  }

  const effectiveMaxSpeed = MOVEMENT_CONFIG.MAX_SPEED * speedModifier * terrainMultiplier

  const isApache = unit.type === 'apache'
  let activeFlightPlan = null
  let hadFlightPlanAtStart = false
  if (isApache) {
    if (unit.remoteControlActive) {
      unit.flightPlan = null
    } else {
      activeFlightPlan = unit.flightPlan
      hadFlightPlanAtStart = Boolean(activeFlightPlan)
    }

    if (activeFlightPlan) {
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      const dx = activeFlightPlan.x - unitCenterX
      const dy = activeFlightPlan.y - unitCenterY
      const distance = Math.hypot(dx, dy)
      const stopRadius = Math.max(6, activeFlightPlan.stopRadius || TILE_SIZE * 0.4)

      if (distance <= stopRadius) {
        unit.flightPlan = null
        activeFlightPlan = null
        movement.targetVelocity.x = 0
        movement.targetVelocity.y = 0
        movement.isMoving = false
        movement.targetRotation = movement.rotation
        unit.hovering = unit.flightState === 'airborne'
        if (!unit.helipadLandingRequested) {
          unit.autoHoldAltitude = true
        }
      } else {
        const airSpeed = (unit.airCruiseSpeed || unit.speed || MOVEMENT_CONFIG.MAX_SPEED) * (unit.speedModifier || 1)
        const dirX = dx / distance
        const dirY = dy / distance
        movement.targetVelocity.x = dirX * airSpeed
        movement.targetVelocity.y = dirY * airSpeed
        movement.isMoving = true
        const desiredRotation = normalizeAngle(Math.atan2(dirY, dirX))
        movement.targetRotation = desiredRotation
        // Smooth rotation towards target instead of instant snap
        const apacheRotationSpeed = unit.rotationSpeed || 0.18
        const currentRotation = unit.direction || movement.rotation || 0
        const smoothedRotation = smoothRotate(currentRotation, desiredRotation, apacheRotationSpeed)
        movement.rotation = smoothedRotation
        unit.direction = smoothedRotation
        unit.rotation = smoothedRotation
        unit.hovering = false
      }
      unit.path = []
    } else if (!unit.remoteControlActive) {
      movement.targetVelocity.x = 0
      movement.targetVelocity.y = 0
      movement.targetRotation = movement.rotation
      if (movement.isMoving) {
        movement.isMoving = false
      }
      if (movement.currentSpeed < MOVEMENT_CONFIG.MIN_SPEED) {
        unit.hovering = unit.flightState === 'airborne'
      }
    }
  }

  // Handle path following
  const skipPathHandlingForApache = isApache && !unit.remoteControlActive && hadFlightPlanAtStart
  if (!skipPathHandlingForApache && unit.path && unit.path.length > 0) {
    const nextTile = unit.path[0]
    const targetX = nextTile.x * TILE_SIZE
    const targetY = nextTile.y * TILE_SIZE

    const dx = targetX - unit.x
    const dy = targetY - unit.y
    const distance = Math.hypot(dx, dy)

    // Check if we've reached the current waypoint
    const baseReachDistance = TILE_SIZE / 3
    let waypointReachDistance = baseReachDistance

    if (distance >= baseReachDistance && hasFriendlyUnitOnTile(unit, nextTile.x, nextTile.y, units)) {
      const friendlyAllowance = Math.min(TILE_SIZE * 0.95, MOVEMENT_CONFIG.MIN_UNIT_DISTANCE * 1.25)
      waypointReachDistance = Math.max(baseReachDistance, friendlyAllowance)
    }

    if (distance < waypointReachDistance) {
      unit.path.shift() // Remove reached waypoint

      // Play waypoint sound for player units when they reach a new waypoint (but not the final destination)
      // ONLY when using Path Planning Feature (PPF) - i.e., when unit has a command queue
      const humanPlayer = gameState.humanPlayer || 'player1'
      const isPlayerUnit = unit.owner === humanPlayer || (humanPlayer === 'player1' && unit.owner === 'player')
      const isUsingPathPlanning = unit.commandQueue && unit.commandQueue.length > 0
      if (isPlayerUnit && unit.path.length > 0 && isUsingPathPlanning) { // Only play if there are more waypoints ahead AND using PPF
        playPositionalSound('movingAlongThePath', unit.x, unit.y, 0.6, 2) // 2 second throttle to avoid spam
      }

      // Update tile position
      unit.tileX = nextTile.x
      unit.tileY = nextTile.y

      // If no more waypoints, start deceleration
      if (unit.path.length === 0) {
        movement.targetVelocity.x = 0
        movement.targetVelocity.y = 0
        movement.isMoving = false
      }
    } else {
      // Calculate desired direction and speed
      const dirX = dx / distance
      const dirY = dy / distance

      // Handle retreat movement differently to prevent sliding while still following path
      if (unit.isRetreating) {
        const currentDirection = unit.direction || 0

        if (unit.isMovingBackwards) {
          // Moving backwards: Calculate if we need to go forward or backward along tank axis
          // to get closer to the next waypoint
          const forwardX = Math.cos(currentDirection)
          const forwardY = Math.sin(currentDirection)

          // Dot product to determine if we should go forward or backward along tank axis
          const dotProduct = (dirX * forwardX) + (dirY * forwardY)

          if (dotProduct > 0) {
            // Path direction aligns with tank forward direction - move forward
            movement.targetVelocity.x = forwardX * effectiveMaxSpeed
            movement.targetVelocity.y = forwardY * effectiveMaxSpeed
          } else {
            // Path direction opposes tank forward direction - move backward
            movement.targetVelocity.x = -forwardX * effectiveMaxSpeed
            movement.targetVelocity.y = -forwardY * effectiveMaxSpeed
          }

          movement.isMoving = true
          // Don't change rotation during backward movement strategy
          movement.targetRotation = currentDirection
        } else {
          // Moving forwards during retreat: normal pathfinding but along tank axis
          const targetDirection = unit.retreatTargetDirection || Math.atan2(dy, dx)
          const rotationDiff = Math.abs(normalizeAngle(targetDirection - currentDirection))

          if (rotationDiff < 0.1) {
            // Oriented correctly, move forward along tank's axis towards path
            const forwardX = Math.cos(currentDirection)
            const forwardY = Math.sin(currentDirection)

            movement.targetVelocity.x = forwardX * effectiveMaxSpeed
            movement.targetVelocity.y = forwardY * effectiveMaxSpeed
            movement.isMoving = true
          } else {
            // Still rotating, don't move yet
            movement.targetVelocity.x = 0
            movement.targetVelocity.y = 0
            movement.isMoving = false
          }

          movement.targetRotation = targetDirection
        }
      } else {
        // Normal movement (not retreating)
        movement.targetVelocity.x = dirX * effectiveMaxSpeed
        movement.targetVelocity.y = dirY * effectiveMaxSpeed
        movement.isMoving = true

        // Calculate target rotation based on movement direction
        movement.targetRotation = Math.atan2(dy, dx)
      }
    }
  } else if (!skipPathHandlingForApache) {
    // No path - decelerate to stop unless unit is under manual remote control
    if (!unit.remoteControlActive) {
      movement.targetVelocity.x = 0
      movement.targetVelocity.y = 0
      movement.isMoving = false
    }
  }

  // Handle rotation before movement (tanks should rotate towards target before moving)
  // Skip unified rotation for tanks and Apache as they have their own rotation systems
  // Apache uses instant rotation in flight plan system
  if (!(unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank' || unit.type === 'howitzer' || unit.type === 'apache')) {
    updateUnitRotation(unit)
  }

  // For tanks, handle acceleration/deceleration based on rotation state
  // For other units (except Apache), allow movement when rotation is close to target
  // Apache can move while rotating since it's a helicopter
  let canAccelerate = true
  let shouldDecelerate = false

  if (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank' || unit.type === 'howitzer') {
    if (unit.isRetreating) {
      // During retreat, movement is controlled by retreat behavior's canAccelerate flag
      canAccelerate = unit.canAccelerate !== false
      shouldDecelerate = !canAccelerate
    } else {
      // For normal tank movement:
      // - If can't accelerate (rotating), start decelerating
      // - If can accelerate (facing right direction), start accelerating
      canAccelerate = unit.canAccelerate !== false
      shouldDecelerate = !canAccelerate && movement.isMoving
    }
  } else if (unit.type !== 'apache') {
    // Non-tank, non-Apache units need to be mostly facing the right direction
    const rotationDiff = Math.abs(normalizeAngle(movement.targetRotation - movement.rotation))
    canAccelerate = rotationDiff < Math.PI / 4 // Allow movement if within 45 degrees
    shouldDecelerate = !canAccelerate && movement.isMoving
  }
  // Apache can always accelerate while moving (helicopters can fly in any direction while rotating)

  // Apply acceleration/deceleration with collision avoidance
  let avoidanceForce = { x: 0, y: 0 }
  if (movement.isMoving && canAccelerate) {
    const skipAvoidance = unit.type === 'apache' && unit.flightState !== 'grounded'
    avoidanceForce = skipAvoidance
      ? { x: 0, y: 0 }
      : calculateCollisionAvoidance(unit, units, mapGrid, occupancyMap)
  }

  // Determine acceleration rate based on whether we should accelerate or decelerate
  let accelRate
  if (shouldDecelerate || !movement.isMoving) {
    accelRate = MOVEMENT_CONFIG.DECELERATION
  } else if (canAccelerate && movement.isMoving) {
    // Special case for ambulances - they accelerate at a quarter speed
    if (unit.type === 'ambulance') {
      accelRate = MOVEMENT_CONFIG.ACCELERATION * 0.25
    } else {
      accelRate = MOVEMENT_CONFIG.ACCELERATION
      if (unit.accelerationMultiplier) {
        accelRate *= unit.accelerationMultiplier
      }
    }
  } else {
    accelRate = MOVEMENT_CONFIG.DECELERATION // Default to deceleration when unsure
  }

  // Apply target velocity with avoidance force
  let targetVelX, targetVelY

  if (shouldDecelerate) {
    // When decelerating (like when rotating), reduce velocity towards zero
    targetVelX = 0
    targetVelY = 0
  } else {
    // Normal acceleration towards target velocity
    targetVelX = movement.targetVelocity.x + avoidanceForce.x
    targetVelY = movement.targetVelocity.y + avoidanceForce.y
  }

  movement.velocity.x += (targetVelX - movement.velocity.x) * accelRate
  movement.velocity.y += (targetVelY - movement.velocity.y) * accelRate

  // Apply minimum speed threshold
  const currentSpeed = Math.hypot(movement.velocity.x, movement.velocity.y)
  if (currentSpeed < MOVEMENT_CONFIG.MIN_SPEED && !movement.isMoving) {
    movement.velocity.x = 0
    movement.velocity.y = 0
    movement.currentSpeed = 0
  } else {
    movement.currentSpeed = currentSpeed
  }

  // Store previous position for collision detection
  const prevX = unit.x
  const prevY = unit.y
  const prevTileX = Math.floor((prevX + TILE_SIZE / 2) / TILE_SIZE)
  const prevTileY = Math.floor((prevY + TILE_SIZE / 2) / TILE_SIZE)

  // Always apply velocity to position - tanks should move even when decelerating
  unit.x += movement.velocity.x
  unit.y += movement.velocity.y

  const attemptedX = unit.x
  const attemptedY = unit.y

  if (typeof unit.gas === 'number') {
    const distTiles = Math.hypot(unit.x - prevX, unit.y - prevY) / TILE_SIZE
    const distMeters = distTiles * TILE_LENGTH_METERS
    const usage = (unit.gasConsumption || 0) * distMeters / 100000
    consumeUnitGas(unit, usage)
  }

  if (
    unit.type === 'tankerTruck' &&
    unit.kamikazeMode &&
    unit.kamikazeTargetType === 'building' &&
    unit.kamikazeTargetPoint
  ) {
    const tankerCenterX = unit.x + TILE_SIZE / 2
    const tankerCenterY = unit.y + TILE_SIZE / 2
    const distanceToTarget = Math.hypot(
      unit.kamikazeTargetPoint.x - tankerCenterX,
      unit.kamikazeTargetPoint.y - tankerCenterY
    )

    if (distanceToTarget <= TILE_SIZE * 0.75) {
      const detonated = detonateTankerTruck(unit, units, factories || [], gameState)
      if (detonated) {
        movement.velocity.x = 0
        movement.velocity.y = 0
        if (movement.targetVelocity) {
          movement.targetVelocity.x = 0
          movement.targetVelocity.y = 0
        }
        movement.currentSpeed = 0
        return
      }
    }
  }

  const wrecks = Array.isArray(gameState?.unitWrecks) ? gameState.unitWrecks : []

  // Handle collisions
  const skipCollisionChecks = unit.type === 'apache' && (unit.flightState !== 'grounded' || unit.flightPlan || unit.manualFlightState === 'takeoff')
  const collisionResult = skipCollisionChecks
    ? { collided: false }
    : checkUnitCollision(unit, mapGrid, occupancyMap, units, wrecks)

  if (collisionResult.collided) {
    // Revert position if collision detected
    unit.x = prevX
    unit.y = prevY

    if (collisionResult.type === 'wreck') {
      applyWreckCollisionResponse(unit, movement, collisionResult)
    } else if (collisionResult.type === 'unit') {
      const detonated = applyUnitCollisionResponse(
        unit,
        movement,
        collisionResult,
        units,
        factories || [],
        gameState,
        mapGrid,
        occupancyMap,
        wrecks
      )
      if (detonated) {
        movement.velocity.x = 0
        movement.velocity.y = 0
        if (movement.targetVelocity) {
          movement.targetVelocity.x = 0
          movement.targetVelocity.y = 0
        }
        movement.currentSpeed = 0
      }
    } else if (collisionResult.type === 'building') {
      const detonated = applyBuildingCollisionResponse(unit, movement, collisionResult, units, factories || [], gameState)
      if (detonated) {
        movement.velocity.x = 0
        movement.velocity.y = 0
        if (movement.targetVelocity) {
          movement.targetVelocity.x = 0
          movement.targetVelocity.y = 0
        }
        movement.currentSpeed = 0
      } else {
        applyStaticObstacleCollisionResponse(
          unit,
          movement,
          collisionResult,
          attemptedX,
          attemptedY,
          mapGrid,
          occupancyMap,
          units,
          wrecks
        )
      }
    } else if (collisionResult.type === 'terrain' || collisionResult.type === 'bounds') {
      applyStaticObstacleCollisionResponse(
        unit,
        movement,
        collisionResult,
        attemptedX,
        attemptedY,
        mapGrid,
        occupancyMap,
        units,
        wrecks
      )
    } else {
      // Try alternative movement (slide along obstacles)
      trySlideMovement(unit, movement, mapGrid, occupancyMap, units, wrecks)
    }
  }

  // Update tile position based on actual position (for compatibility with existing code)
  unit.tileX = Math.floor(unit.x / TILE_SIZE)
  unit.tileY = Math.floor(unit.y / TILE_SIZE)

  // Clamp to map bounds
  unit.tileX = Math.max(0, Math.min(unit.tileX, mapGrid[0].length - 1))
  unit.tileY = Math.max(0, Math.min(unit.tileY, mapGrid.length - 1))
  unit.x = Math.max(0, Math.min(unit.x, (mapGrid[0].length - 1) * TILE_SIZE))
  unit.y = Math.max(0, Math.min(unit.y, (mapGrid.length - 1) * TILE_SIZE))

  if (unit.type === 'apache') {
    updateApacheFlightState(unit, movement, occupancyMap, now)
  }

  // Update occupancy map using center-based coordinates
  const currentTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const currentTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

  if ((prevTileX !== currentTileX || prevTileY !== currentTileY) && occupancyMap) {
    updateUnitOccupancy(unit, prevTileX, prevTileY, occupancyMap)
  }

  if (unit.restorationMoveOverride) {
    const target = unit.restorationMoveTarget || unit.moveTarget
    const noPathRemaining = !unit.path || unit.path.length === 0
    let reachedTarget = false

    if (!target) {
      reachedTarget = noPathRemaining
    } else {
      const targetCenterX = (target.x + 0.5) * TILE_SIZE
      const targetCenterY = (target.y + 0.5) * TILE_SIZE
      const distanceToTarget = Math.hypot((unit.x + TILE_SIZE / 2) - targetCenterX, (unit.y + TILE_SIZE / 2) - targetCenterY)
      const tileDistance = Math.max(Math.abs(currentTileX - target.x), Math.abs(currentTileY - target.y))
      reachedTarget = noPathRemaining && (tileDistance === 0 || distanceToTarget <= TILE_SIZE / 2)
    }

    if (reachedTarget) {
      unit.restorationMoveOverride = false
      unit.restorationMoveTarget = null
      unit.restorationProtectedFromRecovery = false
      if (target && unit.moveTarget && unit.moveTarget.x === target.x && unit.moveTarget.y === target.y) {
        unit.moveTarget = null
      }
      unit.path = []
      unit.movement.velocity = { x: 0, y: 0 }
      unit.movement.targetVelocity = { x: 0, y: 0 }
      unit.movement.isMoving = false
      unit.movement.currentSpeed = 0
    }
  } else if (unit.restorationProtectedFromRecovery) {
    unit.restorationProtectedFromRecovery = false
  }

  // Handle stuck unit detection and recovery for all units (as requested)
  handleStuckUnit(unit, mapGrid, occupancyMap, units, gameState, factories)

  if (unit.returningFromWorkshop && (!unit.path || unit.path.length === 0) && !unit.moveTarget) {
    unit.returningFromWorkshop = false
    unit.returnTile = null
  }

  // --- Engine sound handling ---
  const isTank = unit.type && unit.type.includes('tank')
  if (isTank) {
    const moving = movement.currentSpeed > MOVEMENT_CONFIG.MIN_SPEED
    if (moving) {
      if (!unit.engineSound) {
        playPositionalSound('tankDriveLoop', unit.x, unit.y, 0.2, 0, false, { playLoop: true })
          .then(handle => {
            if (!handle) return
            // If unit was destroyed before the sound loaded, stop immediately
            if (unit.health <= 0 || unit.destroyed) {
              try {
                handle.source.stop()
              } catch (e) {
                console.error('Error stopping pending engine sound:', e)
              }
              return
            }
            const { pan, volumeFactor } = calculatePositionalAudio(unit.x, unit.y)
            const targetGain = 0.2 * volumeFactor * getMasterVolume()
            handle.gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            handle.gainNode.gain.linearRampToValueAtTime(targetGain, audioContext.currentTime + 0.5)
            if (handle.panner) handle.panner.pan.value = pan
            unit.engineSound = handle
          })
      } else {
        const { pan, volumeFactor } = calculatePositionalAudio(unit.x, unit.y)
        const targetGain = 0.2 * volumeFactor * getMasterVolume()
        if (unit.engineSound.panner) unit.engineSound.panner.pan.value = pan
        unit.engineSound.gainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.05)
      }
    } else if (unit.engineSound) {
      const { source, gainNode } = unit.engineSound
      gainNode.gain.cancelScheduledValues(audioContext.currentTime)
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5)
      source.stop(audioContext.currentTime + 0.5)
      unit.engineSound = null
    }
  }
}

/**
 * Update unit rotation with smooth turning
 */
function updateUnitRotation(unit) {
  const movement = unit.movement

  // Only rotate if moving or if there's a significant rotation difference
  const rotationDiff = normalizeAngle(movement.targetRotation - movement.rotation)

  if (Math.abs(rotationDiff) > 0.1) {
    const rotationStep = MOVEMENT_CONFIG.ROTATION_SPEED

    if (rotationDiff > 0) {
      movement.rotation += Math.min(rotationStep, rotationDiff)
    } else {
      movement.rotation -= Math.min(rotationStep, Math.abs(rotationDiff))
    }

    movement.rotation = normalizeAngle(movement.rotation)
  }

  // Update unit's rotation property
  unit.rotation = movement.rotation
}

/**
 * Normalize angle to [-π, π] range
 */
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

/**
 * Check for unit collisions with map obstacles, other units, and wrecks
 */
function checkUnitCollision(unit, mapGrid, occupancyMap, units, wrecks = []) {
  const tileX = Math.floor(unit.x / TILE_SIZE)
  const tileY = Math.floor(unit.y / TILE_SIZE)

  const tileRow = Array.isArray(mapGrid) ? mapGrid[tileY] : undefined
  const tile = tileRow ? tileRow[tileX] : undefined

  if (unit.type === 'apache' && (unit.flightState !== 'grounded' || unit.flightPlan || unit.manualFlightState === 'takeoff')) {
    if (!tileRow || tile === undefined) {
      return { collided: true, type: 'bounds' }
    }
    return { collided: false }
  }

  const unitAirborneApache = unit.type === 'apache' && unit.flightState !== 'grounded'

  // Check map bounds
  if (!tileRow || tile === undefined) {
    return { collided: true, type: 'bounds', tileX, tileY }
  }

  if (typeof tile === 'number') {
    if (tile === 1) {
      return { collided: true, type: 'terrain', tileX, tileY }
    }
  } else {
    if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal) {
      return { collided: true, type: 'terrain', tileX, tileY }
    }

    if (tile.building) {
      if (unit.type === 'apache' && tile.building.type === 'helipad') {
        return { collided: false }
      }
      return {
        collided: true,
        type: 'building',
        building: tile.building,
        tileX,
        tileY
      }
    }
  }

  // Check for other units using improved distance-based collision detection
  if (units) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    for (const otherUnit of units) {
      if (otherUnit.id === unit.id || otherUnit.health <= 0) continue

      const otherAirborneApache = otherUnit.type === 'apache' && otherUnit.flightState !== 'grounded'
      if ((unitAirborneApache && !otherAirborneApache) || (!unitAirborneApache && otherAirborneApache)) {
        continue
      }

      const otherCenterX = otherUnit.x + TILE_SIZE / 2
      const otherCenterY = otherUnit.y + TILE_SIZE / 2
      const distance = Math.hypot(unitCenterX - otherCenterX, unitCenterY - otherCenterY)

      // Use improved minimum distance to prevent getting stuck
      if (distance < MOVEMENT_CONFIG.MIN_UNIT_DISTANCE) {
        // Allow movement if units are moving away from each other
        const dx = unitCenterX - otherCenterX
        const dy = unitCenterY - otherCenterY
        const unitVelX = unit.movement?.velocity?.x || 0
        const unitVelY = unit.movement?.velocity?.y || 0

        // Check if this unit's movement increases distance (moving away)
        const dotProduct = dx * unitVelX + dy * unitVelY
        if (dotProduct > 0) {
          return { collided: false }
        }
        // Compute collision normal (from unit to other)
        const normalX = (otherCenterX - unitCenterX) / (distance || 1)
        const normalY = (otherCenterY - unitCenterY) / (distance || 1)
        const overlap = MOVEMENT_CONFIG.MIN_UNIT_DISTANCE - distance

        // Speeds
        const otherVelX = otherUnit.movement?.velocity?.x || 0
        const otherVelY = otherUnit.movement?.velocity?.y || 0
        const unitSpeed = Math.hypot(unitVelX, unitVelY)
        const otherSpeed = Math.hypot(otherVelX, otherVelY)

        // Decide who gets the "bounce" impulse: the slower one
        const remoteBoost = unit.remoteControlActive ? COLLISION_BOUNCE_REMOTE_BOOST : 1
        const baseImpulse = unitSpeed * COLLISION_BOUNCE_SPEED_FACTOR + overlap * COLLISION_BOUNCE_OVERLAP_FACTOR
        const impulse = Math.max(COLLISION_BOUNCE_MIN, Math.min(COLLISION_BOUNCE_MAX, baseImpulse * remoteBoost))

        if (otherSpeed <= unitSpeed) {
          // Push the other (slower) unit away from this unit
          if (!otherUnit.movement) initializeUnitMovement(otherUnit)
          otherUnit.movement.velocity.x = (otherUnit.movement.velocity.x || 0) + normalX * impulse
          otherUnit.movement.velocity.y = (otherUnit.movement.velocity.y || 0) + normalY * impulse
          // Slight recoil to the faster unit to visibly separate
          unit.movement.velocity.x -= normalX * Math.min(impulse * COLLISION_RECOIL_FACTOR_FAST, COLLISION_RECOIL_MAX_FAST)
          unit.movement.velocity.y -= normalY * Math.min(impulse * COLLISION_RECOIL_FACTOR_FAST, COLLISION_RECOIL_MAX_FAST)
        } else {
          // Our unit is slower: bounce our unit back away from the other
          unit.movement.velocity.x -= normalX * impulse
          unit.movement.velocity.y -= normalY * impulse
          // Nudge the other slightly for separation
          if (!otherUnit.movement) initializeUnitMovement(otherUnit)
          otherUnit.movement.velocity.x += normalX * Math.min(impulse * COLLISION_RECOIL_PUSH_OTHER_FACTOR, COLLISION_RECOIL_PUSH_OTHER_MAX)
          otherUnit.movement.velocity.y += normalY * Math.min(impulse * COLLISION_RECOIL_PUSH_OTHER_FACTOR, COLLISION_RECOIL_PUSH_OTHER_MAX)
        }

        const relativeSpeed = Math.max(0, -((unitVelX * normalX) + (unitVelY * normalY)))

        return {
          collided: true,
          type: 'unit',
          other: otherUnit,
          data: {
            normalX,
            normalY,
            overlap,
            unitSpeed,
            otherSpeed,
            impulse,
            relativeSpeed
          }
        }
      }
    }
  }

  if (wrecks && wrecks.length > 0) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    const unitVelX = unit.movement?.velocity?.x || 0
    const unitVelY = unit.movement?.velocity?.y || 0

    for (const wreck of wrecks) {
      if (!wreck || wreck.health <= 0) continue
      if (wreck.towedBy === unit.id) continue

      const wreckCenterX = wreck.x + TILE_SIZE / 2
      const wreckCenterY = wreck.y + TILE_SIZE / 2
      const distance = Math.hypot(unitCenterX - wreckCenterX, unitCenterY - wreckCenterY)

      if (distance >= UNIT_COLLISION_MIN_DISTANCE) {
        continue
      }

      const dx = unitCenterX - wreckCenterX
      const dy = unitCenterY - wreckCenterY
      const dotProduct = dx * unitVelX + dy * unitVelY

      if (dotProduct > 0) {
        // Moving away from wreck - allow
        continue
      }

      const normalX = (wreckCenterX - unitCenterX) / (distance || 1)
      const normalY = (wreckCenterY - unitCenterY) / (distance || 1)
      const overlap = UNIT_COLLISION_MIN_DISTANCE - distance
      const unitSpeed = Math.hypot(unitVelX, unitVelY)

      // Compare speeds to decide who bounces more
      const wreckSpeed = Math.hypot(wreck.velocityX || 0, wreck.velocityY || 0)

      // Boost impulse for remote-controlled units actively driving
      const remoteControlBoost = unit.remoteControlActive ? WRECK_COLLISION_REMOTE_BOOST : 1.0
      const baseImpulse = unitSpeed * WRECK_COLLISION_SPEED_FACTOR + overlap * WRECK_COLLISION_OVERLAP_FACTOR
      const impulseStrength = Math.max(WRECK_COLLISION_MIN, Math.min(WRECK_COLLISION_MAX, baseImpulse * remoteControlBoost))

      if (wreckSpeed <= unitSpeed) {
        // Wreck is slower: push wreck away from the unit
        wreck.velocityX = (wreck.velocityX || 0) + normalX * impulseStrength
        wreck.velocityY = (wreck.velocityY || 0) + normalY * impulseStrength
        // Apply a tiny recoil to unit as well
        unit.movement.velocity.x -= normalX * Math.min(impulseStrength * WRECK_COLLISION_RECOIL_FACTOR_UNIT, WRECK_COLLISION_RECOIL_MAX_UNIT)
        unit.movement.velocity.y -= normalY * Math.min(impulseStrength * WRECK_COLLISION_RECOIL_FACTOR_UNIT, WRECK_COLLISION_RECOIL_MAX_UNIT)
      } else {
        // Unit is slower: bounce the unit away from wreck
        unit.movement.velocity.x -= normalX * impulseStrength
        unit.movement.velocity.y -= normalY * impulseStrength
      }

      const relativeSpeed = Math.max(0, -((unitVelX * normalX) + (unitVelY * normalY)))

      return {
        collided: true,
        type: 'wreck',
        wreck,
        data: {
          normalX,
          normalY,
          overlap,
          unitSpeed,
          impulseStrength,
          relativeSpeed
        }
      }
    }
  }

  return { collided: false }
}

function applyWreckCollisionResponse(unit, movement, collisionResult) {
  if (!unit || !movement || !collisionResult || collisionResult.type !== 'wreck' || !collisionResult.data) {
    return
  }

  const { normalX, normalY, overlap, relativeSpeed } = collisionResult.data
  const remoteMultiplier = unit.remoteControlActive ? 0.6 : 1
  const separationDistance = Math.min(4, Math.max(0, (relativeSpeed * 2 + overlap * 0.5) * remoteMultiplier))

  if (separationDistance > 0.001) {
    unit.x -= normalX * separationDistance
    unit.y -= normalY * separationDistance
  }

  const recoilFactor = unit.remoteControlActive ? 0.45 : 0.75
  const velocityReduction = Math.min(1.5, Math.max(0, relativeSpeed * recoilFactor + overlap * 0.25))

  if (velocityReduction > 0.001) {
    movement.velocity.x -= normalX * velocityReduction
    movement.velocity.y -= normalY * velocityReduction

    if (!unit.remoteControlActive && movement.targetVelocity) {
      const targetReduction = velocityReduction * 0.35
      movement.targetVelocity.x -= normalX * targetReduction
      movement.targetVelocity.y -= normalY * targetReduction
    }
  }

  movement.currentSpeed = Math.hypot(movement.velocity.x, movement.velocity.y)
}

function getStaticObstacleCollisionInfo(unit, collisionResult, attemptedX, attemptedY, mapGrid) {
  if (!unit || !collisionResult) {
    return null
  }

  const attemptedCenterX = attemptedX + TILE_SIZE / 2
  const attemptedCenterY = attemptedY + TILE_SIZE / 2
  const velocityX = unit.movement?.velocity?.x || 0
  const velocityY = unit.movement?.velocity?.y || 0

  let normalX = 0
  let normalY = 0
  let overlap = MOVEMENT_CONFIG.MIN_UNIT_DISTANCE * 0.5

  if (collisionResult.type === 'terrain' || collisionResult.type === 'building') {
    let tileX = Number.isFinite(collisionResult.tileX) ? collisionResult.tileX : null
    let tileY = Number.isFinite(collisionResult.tileY) ? collisionResult.tileY : null

    if (tileX === null) {
      tileX = Math.floor(attemptedCenterX / TILE_SIZE)
    }
    if (tileY === null) {
      tileY = Math.floor(attemptedCenterY / TILE_SIZE)
    }

    const tileCenterX = (tileX + 0.5) * TILE_SIZE
    const tileCenterY = (tileY + 0.5) * TILE_SIZE
    normalX = tileCenterX - attemptedCenterX
    normalY = tileCenterY - attemptedCenterY

    const tileMinX = tileX * TILE_SIZE
    const tileMaxX = tileMinX + TILE_SIZE
    const tileMinY = tileY * TILE_SIZE
    const tileMaxY = tileMinY + TILE_SIZE
    const distLeft = attemptedCenterX - tileMinX
    const distRight = tileMaxX - attemptedCenterX
    const distTop = attemptedCenterY - tileMinY
    const distBottom = tileMaxY - attemptedCenterY
    const minEdgeDistance = Math.min(distLeft, distRight, distTop, distBottom)
    const halfTile = TILE_SIZE / 2
    overlap += Math.max(0, halfTile - minEdgeDistance)
  } else if (collisionResult.type === 'bounds') {
    const mapWidth = (mapGrid && mapGrid[0] ? mapGrid[0].length : 0) * TILE_SIZE
    const mapHeight = (Array.isArray(mapGrid) ? mapGrid.length : 0) * TILE_SIZE

    if (attemptedCenterX < TILE_SIZE / 2) {
      normalX = -1
      overlap += TILE_SIZE / 2 - attemptedCenterX
    } else if (mapWidth > 0 && attemptedCenterX > mapWidth - TILE_SIZE / 2) {
      normalX = 1
      overlap += attemptedCenterX - (mapWidth - TILE_SIZE / 2)
    }

    if (attemptedCenterY < TILE_SIZE / 2) {
      normalY = -1
      overlap += TILE_SIZE / 2 - attemptedCenterY
    } else if (mapHeight > 0 && attemptedCenterY > mapHeight - TILE_SIZE / 2) {
      normalY = 1
      overlap += attemptedCenterY - (mapHeight - TILE_SIZE / 2)
    }
  }

  const normalLength = Math.hypot(normalX, normalY)
  if (normalLength > 0.0001) {
    normalX /= normalLength
    normalY /= normalLength
  } else {
    const velocityLength = Math.hypot(velocityX, velocityY)
    if (velocityLength > 0.0001) {
      normalX = velocityX / velocityLength
      normalY = velocityY / velocityLength
    } else {
      normalX = 0
      normalY = -1
    }
  }

  return { normalX, normalY, overlap }
}

function applyStaticObstacleCollisionResponse(
  unit,
  movement,
  collisionResult,
  attemptedX,
  attemptedY,
  mapGrid,
  occupancyMap,
  units = [],
  wrecks = []
) {
  if (!unit || !movement || !collisionResult) {
    return
  }

  const info = getStaticObstacleCollisionInfo(unit, collisionResult, attemptedX, attemptedY, mapGrid)
  if (!info) {
    return
  }

  const { normalX, normalY, overlap } = info
  const normalVel = movement.velocity.x * normalX + movement.velocity.y * normalY

  if (normalVel > 0) {
    const impulseBase = normalVel * STATIC_COLLISION_BOUNCE_MULT + overlap * STATIC_COLLISION_BOUNCE_OVERLAP
    const impulse = Math.max(STATIC_COLLISION_BOUNCE_MIN, Math.min(STATIC_COLLISION_BOUNCE_MAX, impulseBase))
    movement.velocity.x -= normalX * impulse
    movement.velocity.y -= normalY * impulse
  }

  if (movement.targetVelocity) {
    const targetNormal = movement.targetVelocity.x * normalX + movement.targetVelocity.y * normalY
    if (targetNormal > 0) {
      movement.targetVelocity.x -= normalX * targetNormal
      movement.targetVelocity.y -= normalY * targetNormal
    }
  }

  const separation = Math.min(
    STATIC_COLLISION_SEPARATION_MAX,
    Math.max(
      STATIC_COLLISION_SEPARATION_MIN,
      overlap * STATIC_COLLISION_SEPARATION_SCALE + Math.max(0, normalVel) * 0.4
    )
  )

  if (separation > 0.001) {
    applySafeSeparation(unit, -normalX * separation, -normalY * separation, mapGrid, occupancyMap, units, wrecks)
  }

  movement.currentSpeed = Math.hypot(movement.velocity.x, movement.velocity.y)
  movement.lastStaticCollisionTime = performance.now()
  movement.lastStaticCollisionNormal = { x: normalX, y: normalY }
}

function isGroundUnit(unit) {
  if (!unit) return false
  return !(unit.type === 'apache' && unit.flightState !== 'grounded')
}

function isTileBlockedForCollision(mapGrid, tileX, tileY) {
  if (!mapGrid || tileY < 0 || tileY >= mapGrid.length) {
    return true
  }
  const row = mapGrid[tileY]
  if (!row || tileX < 0 || tileX >= row.length) {
    return true
  }

  const tile = row[tileX]
  if (typeof tile === 'number') {
    return tile === 1
  }

  if (!tile) {
    return true
  }

  if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal) {
    return true
  }

  if (tile.building) {
    return true
  }

  return false
}

function isPositionBlockedForCollision(unit, targetX, targetY, mapGrid, occupancyMap, units = [], wrecks = [], ignoreIds = []) {
  if (!unit) {
    return true
  }

  const ignoreSet = ignoreIds.length > 0 ? new Set(ignoreIds) : null
  const centerX = targetX + TILE_SIZE / 2
  const centerY = targetY + TILE_SIZE / 2
  const tileX = Math.floor(centerX / TILE_SIZE)
  const tileY = Math.floor(centerY / TILE_SIZE)

  if (isTileBlockedForCollision(mapGrid, tileX, tileY)) {
    return true
  }

  if (occupancyMap && occupancyMap[tileY]) {
    let occupancy = occupancyMap[tileY][tileX] || 0
    const currentTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const currentTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

    if (tileX === currentTileX && tileY === currentTileY) {
      occupancy = Math.max(0, occupancy - 1)
    }

    if (occupancy > 0 && ignoreSet) {
      for (const other of units || []) {
        if (!other || other.id === unit.id) continue
        if (!ignoreSet.has(other.id)) continue
        const otherTileX = Math.floor((other.x + TILE_SIZE / 2) / TILE_SIZE)
        const otherTileY = Math.floor((other.y + TILE_SIZE / 2) / TILE_SIZE)
        if (otherTileX === tileX && otherTileY === tileY) {
          occupancy = Math.max(0, occupancy - 1)
        }
        if (occupancy <= 0) {
          break
        }
      }
    }

    if (occupancy > 0) {
      return true
    }
  }

  const minSeparation = MOVEMENT_CONFIG.MIN_UNIT_DISTANCE * 0.95

  if (units && units.length > 0) {
    for (const other of units) {
      if (!other || other.id === unit.id || other.health <= 0) continue
      if (ignoreSet && ignoreSet.has(other.id)) continue
      if (!isGroundUnit(other)) continue

      const otherCenterX = other.x + TILE_SIZE / 2
      const otherCenterY = other.y + TILE_SIZE / 2
      const distance = Math.hypot(centerX - otherCenterX, centerY - otherCenterY)

      if (distance < minSeparation) {
        return true
      }
    }
  }

  if (wrecks && wrecks.length > 0) {
    for (const wreck of wrecks) {
      if (!wreck || wreck.health <= 0) continue
      const wreckCenterX = wreck.x + TILE_SIZE / 2
      const wreckCenterY = wreck.y + TILE_SIZE / 2
      const distance = Math.hypot(centerX - wreckCenterX, centerY - wreckCenterY)
      if (distance < minSeparation) {
        return true
      }
    }
  }

  return false
}

function applySafeSeparation(unit, dx, dy, mapGrid, occupancyMap, units = [], wrecks = [], ignoreIds = []) {
  if (!unit || (dx === 0 && dy === 0)) {
    return { appliedX: 0, appliedY: 0 }
  }

  const startX = unit.x
  const startY = unit.y
  let appliedX = 0
  let appliedY = 0
  let scale = 1

  for (let attempt = 0; attempt < 5; attempt++) {
    const scaledX = dx * scale
    const scaledY = dy * scale
    const targetX = startX + scaledX
    const targetY = startY + scaledY

    if (!isPositionBlockedForCollision(unit, targetX, targetY, mapGrid, occupancyMap, units, wrecks, ignoreIds)) {
      unit.x = targetX
      unit.y = targetY
      appliedX = scaledX
      appliedY = scaledY
      break
    }

    scale *= 0.5
  }

  if (appliedX === 0 && appliedY === 0) {
    unit.x = startX
    unit.y = startY
  }

  return { appliedX, appliedY }
}

function ensureMinimumSeparation(unit, otherUnit, normalX, normalY, mapGrid, occupancyMap, units = [], wrecks = []) {
  if (!unit || !otherUnit) {
    return
  }
  if (!isGroundUnit(unit) || !isGroundUnit(otherUnit)) {
    return
  }

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2
  const otherCenterX = otherUnit.x + TILE_SIZE / 2
  const otherCenterY = otherUnit.y + TILE_SIZE / 2
  const distance = Math.hypot(unitCenterX - otherCenterX, unitCenterY - otherCenterY)
  const desiredDistance = MOVEMENT_CONFIG.MIN_UNIT_DISTANCE * 0.98

  if (distance >= desiredDistance) {
    return
  }

  let remaining = desiredDistance - distance
  if (remaining <= 0) {
    return
  }

  const otherResult = applySafeSeparation(
    otherUnit,
    normalX * remaining * 0.5,
    normalY * remaining * 0.5,
    mapGrid,
    occupancyMap,
    units,
    wrecks,
    [unit.id]
  )

  const otherAlong = otherResult.appliedX * normalX + otherResult.appliedY * normalY
  remaining = Math.max(0, remaining - otherAlong)

  if (remaining > 0.001) {
    const unitResult = applySafeSeparation(
      unit,
      -normalX * remaining,
      -normalY * remaining,
      mapGrid,
      occupancyMap,
      units,
      wrecks,
      [otherUnit.id]
    )
    const unitAlong = -(unitResult.appliedX * normalX + unitResult.appliedY * normalY)
    remaining = Math.max(0, remaining - unitAlong)
  }

  if (remaining > 0.001) {
    applySafeSeparation(
      otherUnit,
      normalX * remaining,
      normalY * remaining,
      mapGrid,
      occupancyMap,
      units,
      wrecks,
      [unit.id]
    )
  }
}

function applyUnitCollisionResponse(unit, movement, collisionResult, units = [], factories = [], gameState = null, mapGrid = null, occupancyMap = null, wrecks = []) {
  if (!unit || !movement || !collisionResult || collisionResult.type !== 'unit' || !collisionResult.data) {
    return false
  }

  const { normalX, normalY, overlap, unitSpeed, otherSpeed } = collisionResult.data
  const factoryList = Array.isArray(factories) ? factories : []

  if (unit.type === 'tankerTruck') {
    const otherUnit = collisionResult.other
    const isEnemyCollision = Boolean(
      otherUnit && typeof otherUnit.owner === 'string' && typeof unit.owner === 'string' && otherUnit.owner !== unit.owner
    )
    const kamikazeActive = isEnemyCollision && unit.kamikazeMode
    const baseSpeed = typeof unit.speed === 'number' ? unit.speed : MOVEMENT_CONFIG.MAX_SPEED
    const speedModifier = typeof unit.speedModifier === 'number' ? unit.speedModifier : 1
    const effectiveSpeed = Math.max(baseSpeed * speedModifier, 0.01)
    const currentSpeed = unitSpeed || movement.currentSpeed || 0
    const remoteAtMaxSpeed = isEnemyCollision && unit.remoteControlActive && currentSpeed >= effectiveSpeed * 0.95

    if ((kamikazeActive || remoteAtMaxSpeed) && detonateTankerTruck(unit, units, factoryList, gameState)) {
      return true
    }
  }

  const separation = Math.min(COLLISION_SEPARATION_MAX, Math.max(COLLISION_SEPARATION_MIN, (overlap * COLLISION_SEPARATION_SCALE)))
  if (separation > 0.001) {
    const otherUnit = collisionResult.other && collisionResult.other.movement ? collisionResult.other : null
    const pushOther = Boolean(otherUnit) && otherSpeed <= unitSpeed

    if (pushOther && otherUnit) {
      applySafeSeparation(
        otherUnit,
        normalX * separation,
        normalY * separation,
        mapGrid,
        occupancyMap,
        units,
        wrecks,
        [unit.id]
      )
    }

    applySafeSeparation(
      unit,
      -normalX * separation,
      -normalY * separation,
      mapGrid,
      occupancyMap,
      units,
      wrecks,
      otherUnit ? [otherUnit.id] : []
    )

    if (otherUnit) {
      ensureMinimumSeparation(unit, otherUnit, normalX, normalY, mapGrid, occupancyMap, units, wrecks)
    }
  }

  const normalVel = movement.velocity.x * normalX + movement.velocity.y * normalY
  if (normalVel > 0) {
    movement.velocity.x -= normalX * Math.min(normalVel * COLLISION_NORMAL_DAMPING_MULT, COLLISION_NORMAL_DAMPING_MAX)
    movement.velocity.y -= normalY * Math.min(normalVel * COLLISION_NORMAL_DAMPING_MULT, COLLISION_NORMAL_DAMPING_MAX)
  }

  movement.currentSpeed = Math.hypot(movement.velocity.x, movement.velocity.y)
  return false
}

function applyBuildingCollisionResponse(unit, movement, collisionResult, units = [], factories = [], gameState = null) {
  if (!unit || !movement || !collisionResult || collisionResult.type !== 'building') {
    return false
  }

  if (unit.type !== 'tankerTruck') {
    return false
  }

  const building = collisionResult.building || null
  const factoryList = Array.isArray(factories) ? factories : []
  const enemyBuilding = building ? ownersAreEnemies(unit.owner, building.owner) : false

  let shouldDetonate = false

  if (unit.kamikazeMode && unit.kamikazeTargetType === 'building') {
    if (building && unit.kamikazeTargetBuilding && building === unit.kamikazeTargetBuilding) {
      shouldDetonate = true
    } else if (building && unit.kamikazeTargetId && building.id === unit.kamikazeTargetId) {
      shouldDetonate = true
    } else if (enemyBuilding) {
      const tileX = collisionResult.tileX
      const tileY = collisionResult.tileY
      if (typeof tileX === 'number' && typeof tileY === 'number' && building &&
          typeof building.x === 'number' && typeof building.y === 'number' &&
          typeof building.width === 'number' && typeof building.height === 'number') {
        const withinBounds = tileX >= building.x && tileX < building.x + building.width &&
          tileY >= building.y && tileY < building.y + building.height
        if (withinBounds) {
          shouldDetonate = true
        }
      } else if (unit.kamikazeTargetPoint) {
        const targetTileX = Math.floor(unit.kamikazeTargetPoint.x / TILE_SIZE)
        const targetTileY = Math.floor(unit.kamikazeTargetPoint.y / TILE_SIZE)
        if (tileX === targetTileX && tileY === targetTileY) {
          shouldDetonate = true
        }
      } else {
        shouldDetonate = true
      }
    }
  }

  if (!shouldDetonate && enemyBuilding && unit.remoteControlActive) {
    const baseSpeed = typeof unit.speed === 'number' ? unit.speed : MOVEMENT_CONFIG.MAX_SPEED
    const speedModifier = typeof unit.speedModifier === 'number' ? unit.speedModifier : 1
    const effectiveSpeed = Math.max(baseSpeed * speedModifier, 0.01)
    const currentSpeed = movement.currentSpeed || Math.hypot(movement.velocity.x, movement.velocity.y)
    if (currentSpeed >= effectiveSpeed * 0.95) {
      shouldDetonate = true
    }
  }

  if (shouldDetonate) {
    return detonateTankerTruck(unit, units, factoryList, gameState)
  }

  return false
}

function ownersAreEnemies(ownerA, ownerB) {
  if (!ownerA || !ownerB) {
    return false
  }

  const normalize = owner => {
    if (owner === 'player') return 'player1'
    return owner
  }

  return normalize(ownerA) !== normalize(ownerB)
}

/**
 * Try to slide along obstacles when blocked
 */
function trySlideMovement(unit, movement, mapGrid, occupancyMap, units = [], wrecks = []) {
  const originalX = unit.x
  const originalY = unit.y

  // Try horizontal movement only
  unit.x = originalX + movement.velocity.x
  unit.y = originalY

  if (!checkUnitCollision(unit, mapGrid, occupancyMap, units, wrecks).collided) {
    movement.velocity.y = 0 // Cancel vertical movement
    return
  }

  // Try vertical movement only
  unit.x = originalX
  unit.y = originalY + movement.velocity.y

  if (!checkUnitCollision(unit, mapGrid, occupancyMap, units, wrecks).collided) {
    movement.velocity.x = 0 // Cancel horizontal movement
    return
  }

  // If both fail, stop movement
  unit.x = originalX
  unit.y = originalY
  movement.velocity.x = 0
  movement.velocity.y = 0
}

/**
 * Force stop a unit's movement
 */
export function stopUnitMovement(unit) {
  initializeUnitMovement(unit)

  unit.movement.velocity.x = 0
  unit.movement.velocity.y = 0
  unit.movement.targetVelocity.x = 0
  unit.movement.targetVelocity.y = 0
  unit.movement.isMoving = false
  unit.movement.currentSpeed = 0

  if (unit.path) {
    unit.path = []
  }
}

/**
 * Cancel a unit's current movement path but allow natural deceleration
 */
export function cancelUnitMovement(unit) {
  initializeUnitMovement(unit)

  if (unit.path) {
    unit.path = []
  }

  unit.movement.targetVelocity.x = 0
  unit.movement.targetVelocity.y = 0
  unit.movement.isMoving = false
  unit.moveTarget = null
}

/**
 * Check if a unit is currently moving
 */
export function isUnitMoving(unit) {
  initializeUnitMovement(unit)
  return unit.movement.currentSpeed > MOVEMENT_CONFIG.MIN_SPEED
}

/**
 * Force rotate a unit to try different directions when stuck
 */
export function rotateUnitInPlace(unit, targetDirection = null) {
  initializeUnitMovement(unit)

  const movement = unit.movement

  if (targetDirection !== null) {
    // Rotate towards a specific direction
    movement.targetRotation = targetDirection
  } else {
    // Random rotation to try different directions when stuck
    movement.targetRotation = Math.random() * Math.PI * 2
  }

  // Force rotation even if not moving
  const rotationDiff = normalizeAngle(movement.targetRotation - movement.rotation)

  if (Math.abs(rotationDiff) > 0.1) {
    const rotationStep = MOVEMENT_CONFIG.ROTATION_SPEED * 2 // Faster rotation when stuck

    if (rotationDiff > 0) {
      movement.rotation += Math.min(rotationStep, rotationDiff)
    } else {
      movement.rotation -= Math.min(rotationStep, Math.abs(rotationDiff))
    }

    movement.rotation = normalizeAngle(movement.rotation)
    unit.rotation = movement.rotation
    return true // Still rotating
  }

  return false // Rotation complete
}

/**
 * Check if a unit appears to be stuck and try to help it
 */
export function handleStuckUnit(unit, mapGrid, occupancyMap, units, gameState = null, factories = null) {
  initializeUnitMovement(unit)
  const movement = unit.movement

  // Initialize stuck detection if not present
  if (!unit.movement.stuckDetection) {
    // Add random offset (0-500ms) to distribute stuck checks across time and prevent performance spikes
    const randomOffset = Math.random() * STUCK_CHECK_INTERVAL
    unit.movement.stuckDetection = {
      lastPosition: { x: unit.x, y: unit.y },
      stuckTime: 0,
      lastMovementCheck: performance.now() - randomOffset, // Start with random offset
      rotationAttempts: 0,
      isRotating: false,
      dodgeAttempts: 0,
      lastDodgeTime: 0,
      lastStuckHandling: 0, // Add cooldown for stuck handling
      checkInterval: STUCK_CHECK_INTERVAL + randomOffset // Each unit gets its own check interval with offset
    }
  }

  const now = performance.now()
  const stuck = unit.movement.stuckDetection

  // Enhanced stuck detection for all units - each unit has its own randomized check interval
  const stuckThreshold = STUCK_THRESHOLD // Consider units stuck after 0.5 seconds
  const unitCheckInterval = stuck.checkInterval || STUCK_CHECK_INTERVAL // Use unit's individual interval or fallback

  // Check if unit has moved significantly
  if (now - stuck.lastMovementCheck > unitCheckInterval) {
    const distanceMoved = Math.hypot(unit.x - stuck.lastPosition.x, unit.y - stuck.lastPosition.y)
    const timeDelta = now - stuck.lastMovementCheck
    const recentStaticCollision = Boolean(
      movement?.lastStaticCollisionTime &&
      now - movement.lastStaticCollisionTime < STATIC_COLLISION_GRACE_PERIOD
    )

    // Special handling for harvesters - don't consider them stuck if they're performing valid actions
    if (unit.type === 'harvester') {
      const isPerformingValidAction = unit.harvesting ||
                                    unit.unloadingAtRefinery ||
                                    (unit.oreCarried === 0 && !unit.oreField && (!unit.path || unit.path.length === 0)) || // Idle without task
                                    (unit.manualOreTarget && !unit.path) // Manually commanded to wait

      if (isPerformingValidAction) {
        // Reset stuck detection for valid harvester actions
        stuck.stuckTime = 0
        stuck.rotationAttempts = 0
        stuck.dodgeAttempts = 0
        stuck.isRotating = false
      } else if (distanceMoved < TILE_SIZE / 4 && unit.path && unit.path.length > 0) {
        // Only consider stuck if harvester has a path but isn't moving and isn't doing valid actions
        // More lenient for AI harvesters to prevent wiggling
        const isAIHarvester = unit.owner === 'enemy'
        const movementThreshold = isAIHarvester ? TILE_SIZE / 8 : TILE_SIZE / 4  // 4px for AI, 8px for others
        const stuckTimeThreshold = isAIHarvester ? stuckThreshold * 2 : stuckThreshold  // 2x longer for AI harvesters

        if (distanceMoved < movementThreshold) {
          const slidingProgress = recentStaticCollision && distanceMoved >= movementThreshold * 0.35

          if (slidingProgress) {
            stuck.stuckTime = Math.max(0, stuck.stuckTime - timeDelta * 0.5)
          } else {
            stuck.stuckTime += timeDelta
          }

          if (stuck.stuckTime > stuckTimeThreshold && !stuck.isRotating && (now - stuck.lastStuckHandling > STUCK_HANDLING_COOLDOWN)) {

            stuck.lastStuckHandling = now // Set cooldown

            // For AI harvesters, be less aggressive with stuck recovery
            if (isAIHarvester) {
              // Try clearing ore field first, then path - minimal intervention
              if (unit.oreField) {
                clearStuckHarvesterOreField(unit)
                unit.path = [] // Clear path to force new ore finding
                stuck.stuckTime = 0
                stuck.rotationAttempts = 0
                stuck.dodgeAttempts = 0
                return
              } else {
                // Just clear path for AI harvesters
                unit.path = []
                stuck.stuckTime = 0
                stuck.rotationAttempts = 0
                stuck.dodgeAttempts = 0
                stuck.isRotating = false
                return
              }
            }

            // Non-AI harvesters get the full stuck recovery treatment
            // Try the new random movement pattern first (90 degrees left/right + 1-2 tiles forward)
            if (tryRandomStuckMovement(unit, mapGrid, occupancyMap, units)) {
              stuck.stuckTime = 0
              stuck.rotationAttempts = 0
              stuck.dodgeAttempts = 0
              return
            }

            // Enhanced recovery strategies for harvesters as fallback
            if (gameState && factories) {
              handleStuckHarvester(unit, mapGrid, occupancyMap, gameState, factories)
              stuck.stuckTime = 0 // Reset stuck time after handling
              stuck.rotationAttempts = 0
              stuck.dodgeAttempts = 0
              return
            }

            // Fallback to original logic if parameters not available
            // Clear ore field assignment if harvester is stuck trying to reach it
            if (unit.oreField && stuck.stuckTime > stuckThreshold) {
              clearStuckHarvesterOreField(unit)
              unit.path = [] // Clear path to force new ore finding
              stuck.stuckTime = 0 // Reset stuck time after clearing ore field
            }

            // Try dodge movement first for harvesters
            if (stuck.dodgeAttempts < 3 && now - stuck.lastDodgeTime > DODGE_ATTEMPT_COOLDOWN) {
              if (tryDodgeMovement(unit, mapGrid, occupancyMap, units)) {
                stuck.dodgeAttempts++
                stuck.lastDodgeTime = now
                stuck.stuckTime = 0 // Reset stuck time after successful dodge
                return
              }
            }

            // If dodge failed, try rotation
            if (stuck.rotationAttempts < 4) {
              stuck.isRotating = true
              stuck.rotationAttempts++

              // For harvesters, try rotating towards a nearby free space
              const freeDirection = findFreeDirection(unit, mapGrid, occupancyMap, units)
              if (freeDirection !== null) {
                rotateUnitInPlace(unit, freeDirection)
              } else {
                rotateUnitInPlace(unit)
              }
            } else {
              // Last resort: clear path and force new pathfinding
              unit.path = []
              stuck.stuckTime = 0
              stuck.rotationAttempts = 0
              stuck.dodgeAttempts = 0
              stuck.isRotating = false
            }
          }
        } else {
          // Harvester moved enough, reset stuck detection
          stuck.stuckTime = 0
          stuck.rotationAttempts = 0
          stuck.dodgeAttempts = 0
          stuck.isRotating = false
        }
      } else {
        // Unit is moving normally or has no path, reset stuck detection
        stuck.stuckTime = 0
        stuck.rotationAttempts = 0
        stuck.dodgeAttempts = 0
        stuck.isRotating = false
      }
    } else if (distanceMoved < TILE_SIZE / 4 && unit.path && unit.path.length > 0) {
      // All other unit types (tanks, etc.) - new unified stuck detection logic
      // More lenient stuck detection for AI combat units to prevent wiggling
      const isAICombatUnit = unit.owner === 'enemy' &&
        (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank')

      // Use more lenient thresholds for AI combat units
      const movementThreshold = isAICombatUnit ? TILE_SIZE / 8 : TILE_SIZE / 4  // 4px for AI, 8px for others
      const stuckTimeThreshold = isAICombatUnit ? stuckThreshold * 3 : stuckThreshold  // 3x longer for AI units

      if (distanceMoved < movementThreshold) {
        const slidingProgress = recentStaticCollision && distanceMoved >= movementThreshold * 0.35

        if (slidingProgress) {
          stuck.stuckTime = Math.max(0, stuck.stuckTime - timeDelta * 0.5)
        } else {
          stuck.stuckTime += timeDelta
        }

        if (stuck.stuckTime > stuckTimeThreshold && !stuck.isRotating && (now - stuck.lastStuckHandling > STUCK_HANDLING_COOLDOWN)) {

          stuck.lastStuckHandling = now // Set cooldown

          // For AI combat units, be less aggressive with stuck recovery
          if (isAICombatUnit) {
            // Only clear path for AI units - no random movements or rotations that cause wiggling
            unit.path = []
            stuck.stuckTime = 0
            stuck.rotationAttempts = 0
            stuck.dodgeAttempts = 0
            stuck.isRotating = false
            return
          }

          // Non-AI units get the full stuck recovery treatment
          // Try the new random movement pattern first (90 degrees left/right + 1-2 tiles forward)
          if (tryRandomStuckMovement(unit, mapGrid, occupancyMap, units)) {
            stuck.stuckTime = 0
            stuck.rotationAttempts = 0
            stuck.dodgeAttempts = 0
            return
          }

          // Fallback to rotation if random movement fails
          if (stuck.rotationAttempts < 3) {
            stuck.isRotating = true
            stuck.rotationAttempts++

            const freeDirection = findFreeDirection(unit, mapGrid, occupancyMap, units)
            if (freeDirection !== null) {
              rotateUnitInPlace(unit, freeDirection)
            } else {
              rotateUnitInPlace(unit)
            }
          } else {
            // Last resort: clear path and force new pathfinding
            unit.path = []
            stuck.stuckTime = 0
            stuck.rotationAttempts = 0
            stuck.dodgeAttempts = 0
            stuck.isRotating = false
          }
        }
      } else {
        // Unit moved enough, reset stuck detection
        stuck.stuckTime = 0
        stuck.rotationAttempts = 0
        stuck.dodgeAttempts = 0
        stuck.isRotating = false
      }
    } else {
      // Unit is moving normally, reset stuck detection
      stuck.stuckTime = 0
      stuck.rotationAttempts = 0
      stuck.dodgeAttempts = 0
      stuck.isRotating = false
    }

    // Update position tracking
    stuck.lastPosition.x = unit.x
    stuck.lastPosition.y = unit.y
    stuck.lastMovementCheck = now
  }

  // Handle ongoing rotation
  if (stuck.isRotating) {
    const stillRotating = rotateUnitInPlace(unit)
    if (!stillRotating) {
      // Rotation complete, allow movement again
      stuck.isRotating = false
      stuck.stuckTime = 0
    }
  }
}

/**
 * Try random 90-degree movement as requested
 * Moves unit 90 degrees left or right, then 1-2 tiles forward
 */
function tryRandomStuckMovement(unit, mapGrid, occupancyMap, units) {
  const currentTileX = Math.floor(unit.x / TILE_SIZE)
  const currentTileY = Math.floor(unit.y / TILE_SIZE)

  // Get current unit rotation or path direction
  let currentDirection = unit.movement?.rotation || 0
  if (unit.path && unit.path.length > 0) {
    const nextTile = unit.path[0]
    const dx = nextTile.x * TILE_SIZE - unit.x
    const dy = nextTile.y * TILE_SIZE - unit.y
    currentDirection = Math.atan2(dy, dx)
  }

  // Randomly choose left or right 90-degree turn
  const turnDirection = Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2 // -90 or +90 degrees
  const newDirection = currentDirection + turnDirection

  // Randomly choose 1 or 2 tiles forward
  const forwardDistance = Math.random() < 0.5 ? 1 : 2

  // Calculate target position
  const targetX = Math.round(currentTileX + Math.cos(newDirection) * forwardDistance)
  const targetY = Math.round(currentTileY + Math.sin(newDirection) * forwardDistance)

  // Validate target position
  if (isValidDodgePosition(targetX, targetY, mapGrid, units)) {
    // Store original path and target for restoration
    if (!unit.originalPath && unit.path) {
      unit.originalPath = [...unit.path]
      unit.originalTarget = unit.target
    }

    // Set stuck recovery state
    unit.isDodging = true
    unit.dodgeEndTime = performance.now() + 3000 // 3 second timeout

    // Create simple path to target position
    unit.path = [{ x: targetX, y: targetY }]

    return true
  }

  return false
}

/**
 * Try to perform a dodge movement around obstacles for stuck harvesters
 */
async function tryDodgeMovement(unit, mapGrid, occupancyMap, units) {
  const currentTileX = Math.floor(unit.x / TILE_SIZE)
  const currentTileY = Math.floor(unit.y / TILE_SIZE)

  // Look for free tiles in a wider pattern around the harvester
  const dodgePositions = []

  // Check in expanding circles for better dodge positions
  for (let radius = 1; radius <= 3; radius++) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const dodgeX = Math.round(currentTileX + Math.cos(angle) * radius)
      const dodgeY = Math.round(currentTileY + Math.sin(angle) * radius)

      if (isValidDodgePosition(dodgeX, dodgeY, mapGrid, units)) {
        dodgePositions.push({ x: dodgeX, y: dodgeY, radius })
      }
    }

    // Prefer closer positions first
    if (dodgePositions.length > 0) break
  }

  if (dodgePositions.length > 0) {
    // Choose a random dodge position from available options
    const dodgePos = dodgePositions[Math.floor(Math.random() * dodgePositions.length)]

    // Store original path for restoration after dodge
    if (!unit.originalPath && unit.path) {
      unit.originalPath = [...unit.path]
      unit.originalTarget = unit.target
    }

    // Set dodge state
    unit.isDodging = true
    unit.dodgeEndTime = performance.now() + 3000 // 3 second dodge timeout

    // Create path to dodge position using pathfinding
    const dodgePath = findPath(
      { x: currentTileX, y: currentTileY },
      dodgePos,
      mapGrid,
      null // Don't use occupancy map for dodge movement to avoid other stuck units
    )

    if (dodgePath.length > 1) {
      unit.path = dodgePath.slice(1)
      return true
    }
  }

  return false
}

/**
 * Check if a position is valid for dodge movement
 */
function isValidDodgePosition(x, y, mapGrid, units) {
  // Check bounds
  if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) {
    return false
  }

  // Check terrain
  const tile = mapGrid[y][x]
  if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal || tile.building) {
    return false
  }

  // Check for other units (allow some overlap for dodge movements)
  const tileCenter = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 }
  const unitRadius = TILE_SIZE * 0.4

  for (const otherUnit of units) {
    if (otherUnit.health <= 0) continue

    const otherCenter = { x: otherUnit.x + TILE_SIZE / 2, y: otherUnit.y + TILE_SIZE / 2 }
    const distance = Math.hypot(tileCenter.x - otherCenter.x, tileCenter.y - otherCenter.y)

    // Allow closer spacing during dodge movements
    if (distance < unitRadius * 1.5) {
      return false
    }
  }

  return true
}

/**
 * Find a free direction around the unit for rotation-based unsticking
 */
function findFreeDirection(unit, mapGrid, occupancyMap, units) {
  const currentTileX = Math.floor(unit.x / TILE_SIZE)
  const currentTileY = Math.floor(unit.y / TILE_SIZE)

  // Check 8 directions around the unit
  const directions = [
    { x: 0, y: -1, angle: -Math.PI / 2 },     // North
    { x: 1, y: -1, angle: -Math.PI / 4 },     // Northeast
    { x: 1, y: 0, angle: 0 },                 // East
    { x: 1, y: 1, angle: Math.PI / 4 },       // Southeast
    { x: 0, y: 1, angle: Math.PI / 2 },       // South
    { x: -1, y: 1, angle: 3 * Math.PI / 4 },  // Southwest
    { x: -1, y: 0, angle: Math.PI },          // West
    { x: -1, y: -1, angle: -3 * Math.PI / 4 } // Northwest
  ]

  for (const dir of directions) {
    const checkX = currentTileX + dir.x
    const checkY = currentTileY + dir.y

    if (isValidDodgePosition(checkX, checkY, mapGrid, units)) {
      return dir.angle
    }
  }

  return null // No free direction found
}

/**
 * Calculate collision avoidance force to prevent units from getting too close
 */
function calculateCollisionAvoidance(unit, units, mapGrid, occupancyMap) {
  if (!unit) return { x: 0, y: 0 }

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2
  let avoidanceX = 0
  let avoidanceY = 0

  for (const otherUnit of units || []) {
    if (otherUnit.id === unit.id || otherUnit.health <= 0) continue

    const otherCenterX = otherUnit.x + TILE_SIZE / 2
    const otherCenterY = otherUnit.y + TILE_SIZE / 2
    const dx = unitCenterX - otherCenterX
    const dy = unitCenterY - otherCenterY
    const distance = Math.hypot(dx, dy)

    // Apply avoidance force if too close
    if (distance < MOVEMENT_CONFIG.MIN_UNIT_DISTANCE && distance > 0) {
      const avoidanceStrength = (MOVEMENT_CONFIG.MIN_UNIT_DISTANCE - distance) / MOVEMENT_CONFIG.MIN_UNIT_DISTANCE
      const normalizedDx = dx / distance
      const normalizedDy = dy / distance

      avoidanceX += normalizedDx * avoidanceStrength * MOVEMENT_CONFIG.AVOIDANCE_FORCE
      avoidanceY += normalizedDy * avoidanceStrength * MOVEMENT_CONFIG.AVOIDANCE_FORCE
    }
  }

  const movement = unit.movement || {}
  const lookAheadVelX = movement.targetVelocity?.x ?? movement.velocity?.x ?? 0
  const lookAheadVelY = movement.targetVelocity?.y ?? movement.velocity?.y ?? 0
  const lookAheadSpeed = Math.hypot(lookAheadVelX, lookAheadVelY)

  if (lookAheadSpeed > 0.0001 && mapGrid) {
    const dirX = lookAheadVelX / lookAheadSpeed
    const dirY = lookAheadVelY / lookAheadSpeed
    const maxLookAhead = Math.max(...LOCAL_LOOKAHEAD_STEPS) * TILE_SIZE

    for (const step of LOCAL_LOOKAHEAD_STEPS) {
      const distance = step * TILE_SIZE
      const sampleX = unitCenterX + dirX * distance
      const sampleY = unitCenterY + dirY * distance
      const tileX = Math.floor(sampleX / TILE_SIZE)
      const tileY = Math.floor(sampleY / TILE_SIZE)

      let blocked = isTileBlockedForCollision(mapGrid, tileX, tileY)

      if (!blocked && occupancyMap && occupancyMap[tileY]) {
        let occupancy = occupancyMap[tileY][tileX] || 0
        const currentTileX = Math.floor(unitCenterX / TILE_SIZE)
        const currentTileY = Math.floor(unitCenterY / TILE_SIZE)
        if (tileX === currentTileX && tileY === currentTileY) {
          occupancy = Math.max(0, occupancy - 1)
        }
        blocked = occupancy > 0
      }

      if (!blocked && units) {
        blocked = units.some(other => {
          if (!other || other.id === unit.id || other.health <= 0) return false
          if (!isGroundUnit(other)) return false
          const otherTileX = Math.floor((other.x + TILE_SIZE / 2) / TILE_SIZE)
          const otherTileY = Math.floor((other.y + TILE_SIZE / 2) / TILE_SIZE)
          return otherTileX === tileX && otherTileY === tileY
        })
      }

      if (!blocked) continue

      const obstacleCenterX = (tileX + 0.5) * TILE_SIZE
      const obstacleCenterY = (tileY + 0.5) * TILE_SIZE
      const awayX = unitCenterX - obstacleCenterX
      const awayY = unitCenterY - obstacleCenterY
      const awayDist = Math.hypot(awayX, awayY) || 1
      // Ensure non-zero weight even for furthest probe by adding small epsilon
      const weight = Math.max(0.1, (maxLookAhead - distance) / maxLookAhead)
      const avoidanceStrength = weight * LOCAL_LOOKAHEAD_STRENGTH * MOVEMENT_CONFIG.AVOIDANCE_FORCE

      avoidanceX += (awayX / awayDist) * avoidanceStrength
      avoidanceY += (awayY / awayDist) * avoidanceStrength
    }
  }

  return { x: avoidanceX, y: avoidanceY }
}

