import { HELIPAD_FUEL_CAPACITY, HELIPAD_RELOAD_TIME, TILE_SIZE, TANKER_SUPPLY_CAPACITY, HELIPAD_AMMO_RESERVE, AMMO_TRUCK_RANGE, AMMO_RESUPPLY_TIME, AMMO_TRUCK_CARGO } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { getBuildingIdentifier } from '../utils.js'
import { getHelipadLandingCenter } from '../utils/helipadUtils.js'

/**
 * Check if a unit is adjacent to any tile of a building
 * @param {Object} unit - Unit with x/y (pixel coords)
 * @param {Object} building - Building with x/y (tile coords), width, height
 * @param {number} range - Range in tiles
 * @returns {boolean} True if unit is within range of any building tile
 */
function isUnitAdjacentToBuilding(unit, building, range) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)
  const buildingWidth = building.width || 1
  const buildingHeight = building.height || 1
  
  // Check if unit is within range of any tile occupied by the building
  for (let bx = building.x; bx < building.x + buildingWidth; bx++) {
    for (let by = building.y; by < building.y + buildingHeight; by++) {
      const distance = Math.hypot(unitTileX - bx, unitTileY - by)
      if (distance <= range) {
        return true
      }
    }
  }
  return false
}

export const updateHelipadLogic = logPerformance(function(units, buildings, _gameState, delta) {
  if (!Array.isArray(buildings) || buildings.length === 0) return

  const helipads = buildings.filter(b => b.type === 'helipad' && b.health > 0)
  if (helipads.length === 0) return

  helipads.forEach(helipad => {
    const helipadId = getBuildingIdentifier(helipad)
    if (typeof helipad.maxFuel !== 'number' || helipad.maxFuel <= 0) {
      helipad.maxFuel = HELIPAD_FUEL_CAPACITY
    }

    if (typeof helipad.fuel !== 'number') {
      helipad.fuel = helipad.maxFuel
    }

    if (typeof helipad.maxAmmo !== 'number' || helipad.maxAmmo <= 0 || helipad.maxAmmo > HELIPAD_AMMO_RESERVE) {
      helipad.maxAmmo = HELIPAD_AMMO_RESERVE
    }

    if (typeof helipad.ammo !== 'number') {
      helipad.ammo = helipad.maxAmmo
    } else if (helipad.ammo > helipad.maxAmmo) {
      helipad.ammo = helipad.maxAmmo
    }

    const capacity = helipad.maxFuel
    if (capacity <= 0) return

    const reloadTime = typeof helipad.fuelReloadTime === 'number' && helipad.fuelReloadTime > 0
      ? helipad.fuelReloadTime
      : HELIPAD_RELOAD_TIME

    if (helipad.fuel < capacity) {
      const effectiveReloadTime = Math.max(reloadTime, 1)
      const rate = capacity / effectiveReloadTime
      helipad.fuel = Math.min(capacity, helipad.fuel + rate * delta)
    }

    helipad.needsFuel = helipad.fuel < capacity * 0.25

    // Get helipad center coordinates for ammo logic
    const landingCenter = getHelipadLandingCenter(helipad)
    if (!landingCenter) {
      return
    }
    const helipadCenterX = landingCenter.x
    const helipadCenterY = landingCenter.y

    // Ammo reloading logic - only when ammo trucks are nearby
    const ammoCapacity = helipad.maxAmmo

    if (helipad.ammo < ammoCapacity) {
      // Check for nearby ammo trucks
      const ammoTrucks = units.filter(u => u.type === 'ammunitionTruck' && u.health > 0 && typeof u.ammoCargo === 'number' && u.ammoCargo > 0)
      let ammoRefilled = false
      
      ammoTrucks.forEach(ammoTruck => {
        // Check if truck is adjacent to any tile of the helipad
        const isAdjacent = isUnitAdjacentToBuilding(ammoTruck, helipad, AMMO_TRUCK_RANGE)
        if (isAdjacent && helipad.ammo < ammoCapacity) {
          const refillRate = Math.max(1, ammoTruck.maxAmmoCargo || AMMO_TRUCK_CARGO) / AMMO_RESUPPLY_TIME
          const transfer = Math.min(refillRate * delta, ammoCapacity - helipad.ammo, ammoTruck.ammoCargo)
          if (transfer > 0) {
            helipad.ammo = Math.min(ammoCapacity, helipad.ammo + transfer)
            ammoTruck.ammoCargo = Math.max(0, ammoTruck.ammoCargo - transfer)
            ammoRefilled = true
          }
        }
      })
      
      // If no ammo trucks nearby and ammo is below capacity, do not refill automatically
      if (!ammoRefilled) {
        // Ammo stays at current level until ammo truck arrives
      }
    }

    helipad.needsAmmo = helipad.ammo < ammoCapacity * 0.25

    if (Array.isArray(units)) {

      const apacheUnits = units.filter(u => u.type === 'apache' && u.health > 0)
      if (helipad.landedUnitId) {
        const occupant = apacheUnits.find(u => u.id === helipad.landedUnitId)
        if (!occupant || occupant.landedHelipadId !== helipadId || occupant.flightState !== 'grounded') {
          helipad.landedUnitId = null
        }
      }
      apacheUnits.forEach(heli => {
        const heliCenterX = heli.x + TILE_SIZE / 2
        const heliCenterY = heli.y + TILE_SIZE / 2
        const distance = Math.hypot(heliCenterX - helipadCenterX, heliCenterY - helipadCenterY)
        const landingRadius = TILE_SIZE * 1.2

        if (heli.flightState !== 'grounded' && heli.landedHelipadId === helipadId) {
          heli.landedHelipadId = null
        }
        if (heli.flightState !== 'grounded' && helipad.landedUnitId === heli.id) {
          helipad.landedUnitId = null
        }

        const landingCommanded = heli.helipadLandingRequested && (!heli.helipadTargetId || heli.helipadTargetId === helipadId)
        const landingLinked = heli.landedHelipadId === helipadId || helipad.landedUnitId === heli.id
        const landingRequested = landingCommanded || landingLinked

        if (distance <= landingRadius) {
          if (landingRequested) {
            if (heli.flightState !== 'grounded') {
              heli.autoHoldAltitude = false
              heli.manualFlightState = 'land'
            }
            if (heli.flightState === 'grounded') {
              heli.x = helipadCenterX - TILE_SIZE / 2
              heli.y = helipadCenterY - TILE_SIZE / 2
              heli.tileX = Math.floor(heli.x / TILE_SIZE)
              heli.tileY = Math.floor(heli.y / TILE_SIZE)

              if (typeof heli.maxRocketAmmo === 'number' && heli.rocketAmmo < heli.maxRocketAmmo) {
                // Only refill ammo if helipad has ammo supply available
                if (helipad.ammo > 0) {
                  const ammoNeeded = heli.maxRocketAmmo - heli.rocketAmmo
                  // Ammo refill time: 10 seconds for full clip
                  const ammoRefillTime = 10000
                  const ammoRefillRate = heli.maxRocketAmmo / ammoRefillTime
                  const ammoToTransfer = Math.min(ammoRefillRate * delta, ammoNeeded, helipad.ammo)
                  if (ammoToTransfer > 0) {
                    heli.rocketAmmo += ammoToTransfer
                    helipad.ammo -= ammoToTransfer
                  }
                  if (heli.rocketAmmo > 0) {
                    heli.apacheAmmoEmpty = false
                    heli.canFire = true
                  }
                }
                // If helipad has no ammo, helicopter keeps its current ammo level
              }

              if (typeof heli.maxGas === 'number' && heli.gas < heli.maxGas && helipad.fuel > 0) {
                const refuelRate = heli.maxGas / 4000
                const transfer = Math.min(refuelRate * delta, heli.maxGas - heli.gas, helipad.fuel)
                if (transfer > 0) {
                  heli.gas = Math.min(heli.maxGas, heli.gas + transfer)
                  helipad.fuel = Math.max(0, helipad.fuel - transfer)
                  heli.refuelingAtHelipad = true
                } else {
                  heli.refuelingAtHelipad = false
                }
              } else {
                heli.refuelingAtHelipad = false
              }

              // Check if auto-return helicopter has finished refilling and can now takeoff
              if (heli.autoReturnRefilling && typeof heli.maxRocketAmmo === 'number' && heli.rocketAmmo >= heli.maxRocketAmmo) {
                // Ammo is full - allow helicopter to takeoff now
                heli.autoReturnRefilling = false
                heli.helipadLandingRequested = false
                heli.autoHoldAltitude = false
              }

              heli.helipadTargetId = helipadId
              heli.landedHelipadId = helipadId
              helipad.landedUnitId = heli.id
              heli.autoHelipadReturnActive = false
              heli.autoHelipadReturnTargetId = null
              heli.autoHelipadRetryAt = 0
              heli.noHelipadNotificationTime = 0
            }
          }
        } else {
          if (heli.refuelingAtHelipad) {
            heli.refuelingAtHelipad = false
          }
          if (heli.landedHelipadId === helipadId) {
            heli.landedHelipadId = null
          }
          if (helipad.landedUnitId === heli.id) {
            helipad.landedUnitId = null
          }
        }
      })

      const tankers = units.filter(u => u.type === 'tankerTruck' && u.health > 0 && typeof u.supplyGas === 'number' && u.supplyGas > 0)
      tankers.forEach(tanker => {
        const tankerCenterX = tanker.x + TILE_SIZE / 2
        const tankerCenterY = tanker.y + TILE_SIZE / 2
        const distance = Math.hypot(tankerCenterX - helipadCenterX, tankerCenterY - helipadCenterY)
        if (distance <= TILE_SIZE * 2 && helipad.fuel < capacity) {
          const refillRate = Math.max(1, tanker.maxSupplyGas || TANKER_SUPPLY_CAPACITY) / 6000
          const transfer = Math.min(refillRate * delta, capacity - helipad.fuel, tanker.supplyGas)
          if (transfer > 0) {
            helipad.fuel = Math.min(capacity, helipad.fuel + transfer)
            tanker.supplyGas = Math.max(0, tanker.supplyGas - transfer)
          }
        }
      })
    }
  })
})
