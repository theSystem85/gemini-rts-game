// cursorManager.js
import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { findWreckAtTile } from '../game/unitWreckManager.js'

const CURSOR_CLASS_NAMES = [
  'repair-mode',
  'repair-blocked-mode',
  'sell-mode',
  'sell-blocked-mode',
  'move-mode',
  'move-into-mode',
  'move-blocked-mode',
  'attack-mode',
  'attack-blocked-mode',
  'guard-mode'
]

export class CursorManager {
  constructor() {
    this.isOverGameCanvas = false
    this.isOverEnemy = false
    this.isOverFriendlyUnit = false
    this.isOverBlockedTerrain = false
    this.isOverRepairableBuilding = false
    this.isOverSellableBuilding = false
    this.isOverPlayerWorkshop = false
    this.isOverOreTile = false
    this.isOverPlayerRefinery = false
    this.isOverHealableUnit = false
    this.isOverPlayerGasStation = false
    this.isOverRefuelableUnit = false
    this.isForceAttackMode = false
    this.isGuardMode = false
    this.lastMouseEvent = null
    this.isOverEnemyInRange = false
    this.isOverEnemyOutOfRange = false
    this.isInArtilleryRange = false
    this.isOutOfArtilleryRange = false
    this.activeCursorStyle = ''
    this.activeCursorClasses = new Set()
  }

  applyCursor(gameCanvas, cursorStyle, classNames = []) {
    if (!gameCanvas) {
      return
    }

    const desiredClasses = new Set(
      classNames.filter((className) => CURSOR_CLASS_NAMES.includes(className))
    )

    for (const className of CURSOR_CLASS_NAMES) {
      const shouldHave = desiredClasses.has(className)
      const hasClass = gameCanvas.classList.contains(className)

      if (shouldHave && !hasClass) {
        gameCanvas.classList.add(className)
      } else if (!shouldHave && hasClass) {
        gameCanvas.classList.remove(className)
      }
    }

    this.activeCursorClasses = new Set(desiredClasses)

    const currentCursorStyle = gameCanvas.style.cursor || ''
    if (currentCursorStyle !== cursorStyle) {
      gameCanvas.style.cursor = cursorStyle
    }
    this.activeCursorStyle = cursorStyle
  }

  // Function to check if a location is a blocked tile (water, rock, building)
  isBlockedTerrain(tileX, tileY, mapGrid) {
    // First check if mapGrid is defined and properly structured
    if (!mapGrid || !Array.isArray(mapGrid) || mapGrid.length === 0) {
      return false // Can't determine if blocked, assume not blocked
    }

    // Check if tile coordinates are valid
    if (tileX < 0 || tileY < 0 || tileX >= mapGrid[0].length || tileY >= mapGrid.length) {
      return true
    }

    // Ensure we have a valid row before accessing the tile
    if (!mapGrid[tileY] || !mapGrid[tileY][tileX]) {
      return false // Can't determine if blocked, assume not blocked
    }

    // Check if the tile type is impassable
    const tile = mapGrid[tileY][tileX]
    const tileType = tile.type
    const hasBuilding = tile.building
    const hasSeedCrystal = tile.seedCrystal
    const occupancyMap = gameState.occupancyMap
    const occupied =
      occupancyMap &&
      occupancyMap[tileY] &&
      occupancyMap[tileY][tileX]

    return (
      tileType === 'water' ||
      tileType === 'rock' ||
      hasBuilding ||
      hasSeedCrystal ||
      occupied
    )
  }

  // Function to update custom cursor position and visibility
  updateCustomCursor(e, mapGrid, factories, selectedUnits, units = []) {
    // Store last mouse event for later refreshes
    this.lastMouseEvent = e
    const gameCanvas = document.getElementById('gameCanvas')
    const rect = gameCanvas.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    const setCursor = (style, classes = []) => {
      const classList = Array.isArray(classes) ? classes.filter(Boolean) : [classes].filter(Boolean)
      this.applyCursor(gameCanvas, style, classList)
    }

    // Check if cursor is over the game canvas
    this.isOverGameCanvas = (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    )

    // Calculate mouse position in world coordinates
    const worldX = x - rect.left + gameState.scrollOffset.x
    const worldY = y - rect.top + gameState.scrollOffset.y

    // Update global cursor position for other systems like cheats
    gameState.cursorX = worldX
    gameState.cursorY = worldY

    // Convert to tile coordinates
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    // Check if mouse is over blocked terrain when in game canvas, with added safety check
    this.isOverBlockedTerrain = this.isOverGameCanvas &&
      mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
      this.isBlockedTerrain(tileX, tileY, mapGrid)

    // Check if mouse is over a player refinery when harvesters are selected
    this.isOverPlayerRefinery = false
    // Check if mouse is over a healable unit when ambulances are selected
    this.isOverHealableUnit = false
    this.isOverPlayerGasStation = false
    // Check if mouse is over a hospital when ambulances are selected and not fully loaded
    this.isOverPlayerHospital = false
    // Check if mouse is over a repairable unit when recovery tanks are selected
    this.isOverRepairableUnit = false
    // Check if mouse is over a recovery tank when damaged units are selected
    this.isOverRecoveryTank = false
    // Check if mouse is over a wreck when recovery tanks are selected
    this.isOverWreck = false
    if (this.isOverGameCanvas && gameState.buildings && Array.isArray(gameState.buildings) &&
        tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length) {
      // Only show refinery cursor if harvesters are selected
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      // Check for ambulance healing
      const hasSelectedAmbulancesWithMedics = selectedUnits.some(
        unit => unit.type === 'ambulance' && unit.medics > 0
      )
      const hasSelectedNotFullyLoadedAmbulances = selectedUnits.some(unit => unit.type === 'ambulance' && unit.medics < 4)
      // Check for recovery tank interactions
      const hasSelectedRecoveryTanks = selectedUnits.some(unit => unit.type === 'recoveryTank')
      const hasSelectedDamagedUnits = selectedUnits.some(unit => unit.health < unit.maxHealth)

      if (hasSelectedHarvesters) {
        for (const building of gameState.buildings) {
          if (building.type === 'oreRefinery' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            this.isOverPlayerRefinery = true
            break
          }
        }
      }

      // Check for hospital when ambulances that are not fully loaded are selected
      if (hasSelectedNotFullyLoadedAmbulances) {
        for (const building of gameState.buildings) {
          if (building.type === 'hospital' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            this.isOverPlayerHospital = true
            break
          }
        }
      }

      const hasUnitsNeedingGas = selectedUnits.some(
        u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75
      )
      if (hasUnitsNeedingGas) {
        for (const building of gameState.buildings) {
          if (building.type === 'gasStation' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            this.isOverPlayerGasStation = true
            break
          }
        }
      }

      // Check for healable units when fully loaded ambulances are selected
      if (hasSelectedAmbulancesWithMedics && units && Array.isArray(units)) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer &&
              unit.crew && typeof unit.crew === 'object') {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

            if (unitTileX === tileX && unitTileY === tileY) {
              // Check if unit has missing crew members
              const missingCrew = Object.entries(unit.crew).filter(([_, alive]) => !alive)
              if (missingCrew.length > 0) {
                this.isOverHealableUnit = true
                break
              }
            }
          }
        }
      }

      // Check for refuelable units when tanker trucks are selected
      this.isOverRefuelableUnit = false
      const hasSelectedTankers = selectedUnits.some(unit => unit.type === 'tankerTruck')
      if (hasSelectedTankers && units && Array.isArray(units)) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && typeof unit.maxGas === 'number') {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            if (unitTileX === tileX && unitTileY === tileY && unit.gas < unit.maxGas) {
              this.isOverRefuelableUnit = true
              break
            }
          }
        }
      }
      // Check for repairable units when recovery tanks are selected
      if (hasSelectedRecoveryTanks && units && Array.isArray(units)) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && unit.type !== 'recoveryTank') {
            const needsRepair = unit.health < unit.maxHealth
            const needsTow = unit.crew && (!unit.crew.driver || !unit.crew.commander)
            if (!needsRepair && !needsTow) continue
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

            if (unitTileX === tileX && unitTileY === tileY) {
              this.isOverRepairableUnit = true
              break
            }
          }
        }
      }

      // Check for recovery tanks when damaged units are selected
      if (hasSelectedDamagedUnits && units && Array.isArray(units)) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && unit.type === 'recoveryTank') {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

            if (unitTileX === tileX && unitTileY === tileY) {
              this.isOverRecoveryTank = true
              break
            }
          }
        }
      }

      // Check for wrecks when recovery tanks are selected
      if (hasSelectedRecoveryTanks) {
        const wreck = findWreckAtTile(gameState, tileX, tileY)
        if (wreck) {
          const assignedTankSelected = wreck.assignedTankId && selectedUnits.some(unit => unit.id === wreck.assignedTankId)
          const isRecoverable = !wreck.isBeingRestored && !wreck.towedBy && !wreck.isBeingRecycled &&
            (!wreck.assignedTankId || assignedTankSelected)
          if (isRecoverable) {
            this.isOverWreck = true
          }
        }
      }
    }

    // Check if mouse is over an ore tile when harvesters are selected
    this.isOverOreTile = false
    if (this.isOverGameCanvas && mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
        tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length) {
      // Only show ore tile cursor if harvesters are selected
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      if (hasSelectedHarvesters && mapGrid[tileY][tileX].ore) {
        this.isOverOreTile = true
      }
    }

    // Check if mouse is over player vehicle workshop when a repairable unit is
    // selected (damaged or tanker truck)
    this.isOverPlayerWorkshop = false
    if (
      this.isOverGameCanvas &&
      gameState.buildings &&
      Array.isArray(gameState.buildings) &&
      tileX >= 0 &&
      tileY >= 0 &&
      tileX < mapGrid[0].length &&
      tileY < mapGrid.length
    ) {
      const needsWorkshop = selectedUnits.some(
        unit => unit.health < unit.maxHealth || unit.type === 'tankerTruck'
      )
      if (needsWorkshop) {
        for (const building of gameState.buildings) {
          if (
            building.type === 'vehicleWorkshop' &&
            building.owner === gameState.humanPlayer &&
            building.health > 0 &&
            tileX >= building.x &&
            tileX < building.x + building.width &&
            tileY >= building.y &&
            tileY < building.y + building.height
          ) {
            this.isOverPlayerWorkshop = true
            break
          }
        }
      }
    }

    // Check if mouse is over a repairable building (when in repair mode)
    this.isOverRepairableBuilding = false
    if (gameState.repairMode && this.isOverGameCanvas) {
      // Check player factory first - Added null check for factories
      if (factories && Array.isArray(factories)) {
        const playerFactory = factories.find(factory => factory && factory.id === gameState.humanPlayer)
        if (playerFactory &&
            tileX >= playerFactory.x && tileX < (playerFactory.x + playerFactory.width) &&
            tileY >= playerFactory.y && tileY < (playerFactory.y + playerFactory.height)) {
          // Factory is repairable if it's not at full health
          this.isOverRepairableBuilding = playerFactory.health < playerFactory.maxHealth
        }
      }

      // Check player buildings
      if (!this.isOverRepairableBuilding && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner === gameState.humanPlayer &&
              tileX >= building.x && tileX < (building.x + building.width) &&
              tileY >= building.y && tileY < (building.y + building.height)) {
            // Building is repairable if it's not at full health
            // Concrete walls cannot be repaired
            this.isOverRepairableBuilding = (building.health < building.maxHealth) && building.type !== 'concreteWall'
            break
          }
        }
      }
    }

    // Check if mouse is over a sellable building (when in sell mode)
    this.isOverSellableBuilding = false
    if (gameState.sellMode && this.isOverGameCanvas) {
      // Check player factory first - Player factory can't be sold

      // Check player buildings
      if (gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner === gameState.humanPlayer &&
              tileX >= building.x && tileX < (building.x + building.width) &&
              tileY >= building.y && tileY < (building.y + building.height) &&
              !building.isBeingSold) {
            // All player buildings can be sold if not currently being sold
            this.isOverSellableBuilding = true
            break
          }
        }
      }
    }

    // If not over the game canvas, just use default cursor
    if (!this.isOverGameCanvas) {
      setCursor('default')
      return
    }

    // REPAIR MODE TAKES PRIORITY
    if (gameState.repairMode) {
      // Use CSS class for cursors and hide system cursor
      const cursorClass = this.isOverRepairableBuilding ? 'repair-mode' : 'repair-blocked-mode'
      setCursor('none', cursorClass)
      return // Exit early to prevent other cursors from showing
    }

    // SELL MODE TAKES SECOND PRIORITY
    if (gameState.sellMode) {
      // Use CSS class for cursors and hide system cursor
      const cursorClass = this.isOverSellableBuilding ? 'sell-mode' : 'sell-blocked-mode'
      setCursor('none', cursorClass)
      return // Exit early to prevent other cursors from showing
    }

    // Default cursor behavior for regular movement/attack
    if (selectedUnits.length > 0) {
      const hasNonBuildingSelected = selectedUnits.some(u => !u.isBuilding)
      const selectedBuildings = selectedUnits.filter(u => u.isBuilding)

      // CHECK FOR AGF MODE CAPABILITY FIRST - but allow recovery tank interactions to override
      const hasSelectedUnits = selectedUnits && selectedUnits.length > 0
      const hasCombatUnits = hasSelectedUnits && selectedUnits.some(unit =>
        unit.type !== 'harvester' && unit.owner === gameState.humanPlayer && !unit.isBuilding
      )
      const hasSelectedFactory = hasSelectedUnits && selectedUnits.some(unit =>
        (unit.isBuilding && (unit.type === 'vehicleFactory' || unit.type === 'constructionYard')) ||
        (unit.id && (unit.id === gameState.humanPlayer))
      )
      const isAGFCapable = hasSelectedUnits && hasCombatUnits && !hasSelectedFactory &&
                          !gameState.buildingPlacementMode &&
                          !gameState.repairMode &&
                          !gameState.sellMode &&
                          !gameState.attackGroupMode

      // Check for recovery tank interactions first - these take priority over AGF
      if (this.isOverWreck) {
        // Over wreck with recovery tanks selected - show move into cursor
        setCursor('none', 'move-into-mode')
        return // Exit early - recovery tank interaction takes priority
      } else if (this.isOverRepairableUnit) {
        // Over repairable unit with recovery tanks selected - show move into cursor
        setCursor('none', 'move-into-mode')
        return // Exit early - recovery tank interaction takes priority
      } else if (this.isOverRecoveryTank) {
        // Over recovery tank with damaged units selected - show move into cursor
        setCursor('none', 'move-into-mode')
        return // Exit early - recovery tank interaction takes priority
      } else if (this.isOverPlayerWorkshop) {
        // Damaged units or tankers over workshop - highest priority move-into cursor
        setCursor('none', 'move-into-mode')
        return
      }

      // If AGF capable and no recovery tank interactions, use AGF behavior
      if (isAGFCapable && !this.isGuardMode && !this.isForceAttackMode) {
        if (this.isOverEnemy) {
          // Over enemy - use attack cursor
          setCursor('none', 'attack-mode')
        } else if (this.isOverBlockedTerrain) {
          // Over blocked terrain - use move-blocked cursor
          setCursor('none', 'move-blocked-mode')
        } else if (!gameState.isRightDragging) {
          // Normal move cursor for AGF-capable units
          setCursor('none', 'move-mode')
        } else {
          // Right-drag scrolling
          setCursor('grabbing')
        }
        return // Exit early to prevent other interactions
      }

      if (!hasNonBuildingSelected) {
        // Only buildings are selected
        const singleBuilding = selectedBuildings.length === 1 ? selectedBuildings[0] : null
        const isVehicleFactory = singleBuilding && singleBuilding.type === 'vehicleFactory'

        if (isVehicleFactory) {
          // Vehicle factory uses move cursor for rally point placement
          if (this.isOverBlockedTerrain) {
            setCursor('none', 'move-blocked-mode')
          } else if (!gameState.isRightDragging) {
            setCursor('none', 'move-mode')
          } else {
            setCursor('grabbing')
          }
        } else {
          // Other buildings: check if artillery turret is selected for range-based cursor
          const selectedArtilleryTurrets = selectedBuildings.filter(b => b.type === 'artilleryTurret')

          // Also check gameState.buildings for selected artillery turrets (alternative selection method)
          let artilleryTurretSelected = selectedArtilleryTurrets.length > 0
          if (!artilleryTurretSelected && gameState.buildings) {
            artilleryTurretSelected = gameState.buildings.some(b =>
              b.type === 'artilleryTurret' && b.selected && b.owner === gameState.humanPlayer
            )
          }

          // Also check selectedUnits directly for artillery turrets (without building filter)
          if (!artilleryTurretSelected) {
            artilleryTurretSelected = selectedUnits.some(u => u.type === 'artilleryTurret')
          }

          if (artilleryTurretSelected) {
            // Artillery turret selected - show range-based cursor
            if (this.isOverEnemyInRange) {
              // Enemy within range - show attack cursor
              setCursor('none', 'attack-mode')
            } else if (this.isOverEnemyOutOfRange) {
              // Enemy out of range - show blocked attack cursor
              setCursor('none', 'attack-blocked-mode')
            } else if (this.isOverEnemy) {
              // Over enemy but range logic didn't trigger - fallback to attack cursor for now
              setCursor('none', 'attack-mode')
            } else {
              setCursor('default')
            }
          } else {
            // Other buildings: always show default cursor
            setCursor('default')
          }
        }
      } else if (this.isGuardMode) {
        // Guard mode - show guard cursor
        setCursor('none', 'guard-mode')
      } else if (this.isForceAttackMode) {
        // Force attack mode - check if artillery turret is selected for range-based cursor
        const selectedBuildings = selectedUnits.filter(u => u.isBuilding)
        const selectedArtilleryTurrets = selectedBuildings.filter(b => b.type === 'artilleryTurret')

        // Also check gameState.buildings for selected artillery turrets (alternative selection method)
        let artilleryTurretSelected = selectedArtilleryTurrets.length > 0
        if (!artilleryTurretSelected && gameState.buildings) {
          artilleryTurretSelected = gameState.buildings.some(b =>
            b.type === 'artilleryTurret' && b.selected && b.owner === gameState.humanPlayer
          )
        }

        // Also check selectedUnits directly for artillery turrets (without building filter)
        if (!artilleryTurretSelected) {
          artilleryTurretSelected = selectedUnits.some(u => u.type === 'artilleryTurret')
        }

        if (artilleryTurretSelected) {
          // Artillery turret selected in force attack mode - use range-based cursor
          if (this.isInArtilleryRange) {
            // Within artillery range - show attack cursor
            setCursor('none', 'attack-mode')
          } else if (this.isOutOfArtilleryRange) {
            // Out of artillery range - show blocked attack cursor
            setCursor('none', 'attack-blocked-mode')
          } else {
            // Default force attack cursor when range not calculated
            setCursor('none', 'attack-mode')
          }
        } else {
          // Regular force attack mode - use standard attack cursor
          setCursor('none', 'attack-mode')
        }
      } else if (this.isOverHealableUnit) {
        // Over healable unit with ambulances selected - show move into cursor
        setCursor('none', 'move-into-mode')
      } else if (this.isOverRefuelableUnit) {
        // Over refuelable unit with tanker trucks selected - show move into cursor
        setCursor('none', 'move-into-mode')
      } else if (this.isOverFriendlyUnit) {
        // Over friendly unit - use normal arrow cursor
        setCursor('default')
      } else if (this.isOverEnemy) {
        // Over enemy - use attack cursor
        setCursor('none', 'attack-mode')
      } else if (this.isOverPlayerHospital) {
        // Over hospital with not fully loaded ambulances selected - show move into cursor
        setCursor('none', 'move-into-mode')
      } else if (this.isOverPlayerGasStation) {
        setCursor('none', 'move-into-mode')
      } else if (this.isOverPlayerRefinery) {
        // Over player refinery with harvesters selected - show move into cursor
        setCursor('none', 'move-into-mode')
      } else if (this.isOverOreTile) {
        // Over ore tile with harvesters selected - use attack cursor to indicate harvesting
        setCursor('none', 'attack-mode')
      } else if (this.isOverBlockedTerrain) {
        // Over blocked terrain - use move-blocked cursor
        setCursor('none', 'move-blocked-mode')
      } else if (!gameState.isRightDragging) {
        // Normal move cursor
        setCursor('none', 'move-mode')
      } else {
        // Check if artillery turret is selected and handle special cursor logic
        const selectedBuildings = selectedUnits.filter(u => u.isBuilding)
        const selectedArtilleryTurrets = selectedBuildings.filter(b => b.type === 'artilleryTurret')

        // Also check gameState.buildings for selected artillery turrets (alternative selection method)
        let artilleryTurretSelected = selectedArtilleryTurrets.length > 0
        if (!artilleryTurretSelected && gameState.buildings) {
          artilleryTurretSelected = gameState.buildings.some(b =>
            b.type === 'artilleryTurret' && b.selected && b.owner === gameState.humanPlayer
          )
        }

        // Also check selectedUnits directly for artillery turrets (without building filter)
        if (!artilleryTurretSelected) {
          artilleryTurretSelected = selectedUnits.some(u => u.type === 'artilleryTurret')
        }

        if (artilleryTurretSelected) {
          // Artillery turret is selected - apply range-based cursor logic
          if (this.isOverEnemyInRange) {
            // Enemy within range - show attack cursor
            setCursor('none', 'attack-mode')
          } else if (this.isOverEnemyOutOfRange) {
            // Enemy out of range - show blocked attack cursor
            setCursor('none', 'attack-blocked-mode')
          } else if (this.isOverEnemy) {
            // Over enemy but range logic didn't trigger - fallback to attack cursor for now
            setCursor('none', 'attack-mode')
          } else if (this.isOverPlayerRefinery) {
            // Over player refinery with harvesters selected - use attack cursor to indicate force unload
            setCursor('none', 'attack-mode')
          } else if (this.isOverOreTile) {
            // Over ore tile with harvesters selected - use attack cursor to indicate harvesting
            setCursor('none', 'attack-mode')
          } else if (this.isOverBlockedTerrain) {
            // Over blocked terrain - use move-blocked cursor
            setCursor('none', 'move-blocked-mode')
          } else if (!gameState.isRightDragging) {
            // Normal move cursor
            setCursor('none', 'move-mode')
          } else {
            // Right-drag scrolling
            setCursor('grabbing')
          }
        } else if (this.isOverEnemy) {
          // Over enemy - use attack cursor (normal units logic)
          setCursor('none', 'attack-mode')
        } else if (this.isOverPlayerRefinery) {
          // Over player refinery with harvesters selected - use attack cursor to indicate force unload
          setCursor('none', 'attack-mode')
        } else if (this.isOverOreTile) {
          // Over ore tile with harvesters selected - use attack cursor to indicate harvesting
          setCursor('none', 'attack-mode')
        } else if (this.isOverBlockedTerrain) {
          // Over blocked terrain - use move-blocked cursor
          setCursor('none', 'move-blocked-mode')
        } else if (!gameState.isRightDragging) {
          // Normal move cursor
          setCursor('none', 'move-mode')
        } else {
          // Right-drag scrolling
          setCursor('grabbing')
        }
      }
    } else {
      // No units selected - use default cursor
      setCursor('default')
    }
  }

  updateForceAttackMode(isActive) {
    this.isForceAttackMode = isActive
  }

  updateGuardMode(isActive) {
    if (this.isGuardMode !== isActive) {
      this.isGuardMode = isActive
      console.log(`[GMF] Guard mode ${isActive ? 'ENABLED' : 'DISABLED'}`)
    }
  }

  // Reapply cursor appearance using the last known mouse position
  refreshCursor(mapGrid, factories, selectedUnits, units = []) {
    if (this.lastMouseEvent) {
      this.updateCustomCursor(this.lastMouseEvent, mapGrid, factories, selectedUnits, units)
    }
  }

  setIsOverEnemy(value) {
    this.isOverEnemy = value
  }

  setIsOverFriendlyUnit(value) {
    this.isOverFriendlyUnit = value
  }

  setIsOverEnemyInRange(value) {
    this.isOverEnemyInRange = value
  }

  setIsOverEnemyOutOfRange(value) {
    this.isOverEnemyOutOfRange = value
  }

  setIsInArtilleryRange(value) {
    this.isInArtilleryRange = value
  }

  setIsOutOfArtilleryRange(value) {
    this.isOutOfArtilleryRange = value
  }
}
