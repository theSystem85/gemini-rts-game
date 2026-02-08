import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { productionQueue } from '../productionQueue.js'
import { units as mainUnits, factories as mainFactories, mapGrid as mainMapGrid } from '../main.js'
import { collectTransitionsSince, pruneTransitionsUpTo } from './transitionCollector.js'
import { getSupportedProtocolVersion } from './validate.js'

function toWorldPosition(x, y) {
  return { x, y, space: 'world' }
}

function toTilePosition(x, y) {
  return { x, y, space: 'tile' }
}

function unitToSnapshot(unit) {
  const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  return {
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    health: unit.health,
    maxHealth: unit.maxHealth,
    position: toWorldPosition(unit.x, unit.y),
    tilePosition: toTilePosition(tileX, tileY),
    status: {
      ammo: Number.isFinite(unit.ammo) ? unit.ammo : undefined,
      fuel: Number.isFinite(unit.gas) ? unit.gas : undefined,
      crew: unit.crew || undefined,
      isAirUnit: Boolean(unit.isAirUnit)
    },
    orders: {
      moveTarget: unit.moveTarget ? toTilePosition(unit.moveTarget.x, unit.moveTarget.y) : undefined,
      targetId: unit.target ? unit.target.id : null
    }
  }
}

function buildingToSnapshot(building) {
  return {
    id: building.id,
    type: building.type,
    owner: building.owner,
    health: building.health,
    maxHealth: building.maxHealth,
    tilePosition: toTilePosition(building.x, building.y),
    size: { width: building.width, height: building.height },
    constructionFinished: Boolean(building.constructionFinished),
    rallyPoint: building.rallyPoint
      ? toWorldPosition(building.rallyPoint.x, building.rallyPoint.y)
      : null
  }
}

function collectMapSnapshot(mapGrid, verbosity) {
  if (verbosity !== 'full' || !Array.isArray(mapGrid) || mapGrid.length === 0) {
    return undefined
  }
  const oreTiles = []
  const obstacles = []
  mapGrid.forEach((row, y) => {
    if (!Array.isArray(row)) return
    row.forEach((tile, x) => {
      if (!tile) return
      if (tile.ore) {
        oreTiles.push({ x, y })
      }
      if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal) {
        obstacles.push({ x, y, type: tile.type })
      }
    })
  })
  return { oreTiles, obstacles }
}

export function exportGameTickInput(state = gameState, sinceTick = 0, options = {}) {
  const units = options.units || mainUnits || state.units || []
  const buildings = options.buildings || state.buildings || []
  const factories = options.factories || mainFactories || []
  const mapGrid = options.mapGrid || state.mapGrid || mainMapGrid || []
  const verbosity = options.verbosity || 'normal'

  const playerId = options.playerId || state.humanPlayer || 'player1'
  const matchId = options.matchId || state.gameInstanceId || 'local'
  const tick = Number.isFinite(options.tick) ? options.tick : state.frameCount

  const uniqueBuildings = new Map()
  buildings.forEach(building => {
    if (building && building.id) uniqueBuildings.set(building.id, building)
  })
  factories.forEach(factory => {
    if (factory && factory.id && !uniqueBuildings.has(factory.id)) {
      uniqueBuildings.set(factory.id, factory)
    }
  })

  const snapshotBuildings = Array.from(uniqueBuildings.values()).map(buildingToSnapshot)
  const snapshotUnits = Array.isArray(units) ? units.map(unitToSnapshot) : []

  const isHumanPlayer = playerId === state.humanPlayer ||
    (state.humanPlayer === 'player1' && playerId === 'player')
  const powerSnapshot = isHumanPlayer
    ? {
      supply: state.playerPowerSupply ?? state.powerSupply ?? 0,
      production: state.playerTotalPowerProduction ?? 0,
      consumption: state.playerPowerConsumption ?? 0
    }
    : {
      supply: state.enemyPowerSupply ?? 0,
      production: state.enemyTotalPowerProduction ?? 0,
      consumption: state.enemyPowerConsumption ?? 0
    }

  const buildQueues = productionQueue.getSerializableState()

  const transitions = collectTransitionsSince(sinceTick)
  if (options.pruneTransitions !== false) {
    pruneTransitionsUpTo(sinceTick)
  }

  return {
    protocolVersion: getSupportedProtocolVersion(),
    matchId,
    playerId,
    tick,
    sinceTick,
    verbosity,
    meta: {
      tilesX: state.mapTilesX,
      tilesY: state.mapTilesY,
      tileSize: TILE_SIZE,
      coordinateSystem: {
        tileOrigin: 'top-left',
        worldOrigin: 'top-left',
        worldUnits: 'pixels'
      },
      fogOfWarEnabled: Boolean(state.shadowOfWarEnabled),
      catalogVersion: options.catalogVersion || state.catalogVersion || 'default'
    },
    snapshot: {
      resources: {
        money: state.money ?? 0,
        power: powerSnapshot
      },
      units: snapshotUnits,
      buildings: snapshotBuildings,
      buildQueues,
      map: collectMapSnapshot(mapGrid, verbosity)
    },
    transitions,
    constraints: {
      maxActionsPerTick: options.maxActionsPerTick ?? 50,
      allowQueuedCommands: options.allowQueuedCommands ?? true,
      maxQueuedCommands: options.maxQueuedCommands ?? 20
    }
  }
}
