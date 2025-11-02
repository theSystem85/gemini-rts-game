import { HELIPAD_FUEL_CAPACITY, HELIPAD_RELOAD_TIME, TILE_SIZE, TANKER_SUPPLY_CAPACITY } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { getBuildingIdentifier } from '../utils.js'

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

    if (Array.isArray(units)) {
      const helipadCenterX = (helipad.x + (helipad.width || 1) / 2) * TILE_SIZE
      const helipadCenterY = (helipad.y + (helipad.height || 1) / 2) * TILE_SIZE

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
                heli.rocketAmmo = heli.maxRocketAmmo
                heli.apacheAmmoEmpty = false
                heli.canFire = true
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

              heli.helipadLandingRequested = false
              heli.autoHoldAltitude = false
              heli.helipadTargetId = helipadId
              heli.landedHelipadId = helipadId
              helipad.landedUnitId = heli.id
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
