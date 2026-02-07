import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { buildingData, canPlaceBuilding, createBuilding, placeBuilding, updatePowerSupply } from '../buildings.js'
import { unitCosts, spawnUnit } from '../units.js'
import { units as mainUnits, factories as mainFactories, mapGrid as mainMapGrid } from '../main.js'
import { validateGameTickOutput } from './validate.js'
import { updateDangerZoneMaps } from '../game/dangerZoneMap.js'

const vehicleUnitTypes = [
  'tank',
  'tank-v2',
  'rocketTank',
  'tank_v1',
  'tank-v3',
  'harvester',
  'ambulance',
  'tankerTruck',
  'ammunitionTruck',
  'recoveryTank',
  'howitzer',
  'mineLayer',
  'mineSweeper'
]

function toTilePosition(position) {
  if (!position) return null
  if (position.space === 'tile') {
    return { x: Math.floor(position.x), y: Math.floor(position.y) }
  }
  return {
    x: Math.floor(position.x / TILE_SIZE),
    y: Math.floor(position.y / TILE_SIZE)
  }
}

function toWorldPosition(position) {
  if (!position) return null
  if (position.space === 'world') {
    return { x: position.x, y: position.y }
  }
  return {
    x: position.x * TILE_SIZE + TILE_SIZE / 2,
    y: position.y * TILE_SIZE + TILE_SIZE / 2
  }
}

function findEntityById(units, buildings, factories, id) {
  return (
    units.find(u => u.id === id) ||
    buildings.find(b => b.id === id) ||
    factories.find(f => f.id === id)
  )
}

function findBuildingById(buildings, factories, id) {
  return buildings.find(b => b.id === id) || factories.find(f => f.id === id)
}

function resolveFactoryForUnit({ unitType, factoryId, buildings, factories, owner }) {
  const allBuildings = [...buildings, ...factories]
  if (factoryId) {
    const explicit = allBuildings.find(b => b.id === factoryId)
    return explicit || null
  }
  if (unitType === 'apache') {
    return allBuildings.find(b => b.type === 'helipad' && b.owner === owner) || null
  }
  if (vehicleUnitTypes.includes(unitType)) {
    return allBuildings.find(b => b.type === 'vehicleFactory' && b.owner === owner) || null
  }
  return allBuildings.find(b => b.type === 'constructionYard' && b.owner === owner) || null
}

export function applyGameTickOutput(state = gameState, output, options = {}) {
  const validation = validateGameTickOutput(output)
  const accepted = []
  const rejected = []

  if (!validation.ok) {
    return {
      accepted,
      rejected: [
        {
          actionId: 'schema',
          reason: 'INVALID_SCHEMA',
          details: validation.errors
        }
      ]
    }
  }

  const units = options.units || mainUnits || state.units || []
  const buildings = options.buildings || state.buildings || []
  const factories = options.factories || mainFactories || []
  const mapGrid = options.mapGrid || state.mapGrid || mainMapGrid || []
  const owner = options.playerId || state.humanPlayer || 'player1'
  const seenActionIds = new Set()
  const overrideMoney = Number.isFinite(options.money)
  let availableMoney = overrideMoney ? options.money : (state.money ?? 0)
  const updateMoney = (delta) => {
    availableMoney += delta
    if (!overrideMoney) {
      state.money = availableMoney
    }
    if (typeof options.onMoneyChange === 'function') {
      options.onMoneyChange(availableMoney)
    }
  }

  output.actions.forEach(action => {
    if (seenActionIds.has(action.actionId)) {
      rejected.push({ actionId: action.actionId, reason: 'DUPLICATE_ACTION' })
      return
    }
    seenActionIds.add(action.actionId)

    switch (action.type) {
      case 'build_place': {
        const tilePos = toTilePosition(action.tilePosition)
        if (!tilePos) {
          rejected.push({ actionId: action.actionId, reason: 'INVALID_ACTION' })
          return
        }
        const buildingInfo = buildingData[action.buildingType]
        if (!buildingInfo) {
          rejected.push({ actionId: action.actionId, reason: 'UNKNOWN_ENTITY' })
          return
        }
        const cost = buildingInfo.cost || 0
        if (availableMoney < cost) {
          rejected.push({ actionId: action.actionId, reason: 'NOT_ENOUGH_RESOURCES' })
          return
        }
        if (!canPlaceBuilding(action.buildingType, tilePos.x, tilePos.y, mapGrid, units, buildings, factories, owner)) {
          rejected.push({ actionId: action.actionId, reason: 'PLACEMENT_BLOCKED' })
          return
        }
        const newBuilding = createBuilding(action.buildingType, tilePos.x, tilePos.y)
        newBuilding.owner = owner
        if (action.rallyPoint && (newBuilding.type === 'vehicleFactory' || newBuilding.type === 'vehicleWorkshop')) {
          newBuilding.rallyPoint = toWorldPosition(action.rallyPoint)
        }
        buildings.push(newBuilding)
        updateDangerZoneMaps(state)
        placeBuilding(newBuilding, mapGrid)
        updatePowerSupply(buildings, state)
        updateMoney(-cost)
        accepted.push({ actionId: action.actionId, type: action.type, buildingId: newBuilding.id })
        return
      }
      case 'build_queue': {
        const unitType = action.unitType
        if (!unitCosts[unitType]) {
          rejected.push({ actionId: action.actionId, reason: 'UNKNOWN_ENTITY' })
          return
        }
        const factory = resolveFactoryForUnit({
          unitType,
          factoryId: action.factoryId,
          buildings,
          factories,
          owner
        })
        if (!factory) {
          rejected.push({ actionId: action.actionId, reason: 'UNKNOWN_ENTITY' })
          return
        }
        if (unitType === 'apache' && factory.type !== 'helipad') {
          rejected.push({ actionId: action.actionId, reason: 'WRONG_FACTORY' })
          return
        }
        if (vehicleUnitTypes.includes(unitType) && factory.type !== 'vehicleFactory') {
          rejected.push({ actionId: action.actionId, reason: 'WRONG_FACTORY' })
          return
        }
        const count = Math.max(1, Math.floor(action.count || 1))
        const totalCost = unitCosts[unitType] * count
        if (availableMoney < totalCost) {
          rejected.push({ actionId: action.actionId, reason: 'NOT_ENOUGH_RESOURCES' })
          return
        }
        const rallyPoint = action.rallyPoint ? toWorldPosition(action.rallyPoint) : null
        const spawnedUnitIds = []
        for (let i = 0; i < count; i++) {
          const newUnit = spawnUnit(factory, unitType, units, mapGrid, rallyPoint, state.occupancyMap)
          if (!newUnit) {
            rejected.push({ actionId: action.actionId, reason: 'PLACEMENT_BLOCKED' })
            return
          }
          units.push(newUnit)
          spawnedUnitIds.push(newUnit.id)
        }
        updateMoney(-totalCost)
        accepted.push({ actionId: action.actionId, type: action.type, unitIds: spawnedUnitIds })
        return
      }
      case 'unit_command': {
        const targetPos = action.targetPos ? toTilePosition(action.targetPos) : null
        const worldTarget = action.targetPos ? toWorldPosition(action.targetPos) : null
        const target = action.targetId
          ? findEntityById(units, buildings, factories, action.targetId)
          : null
        const selectedUnits = action.unitIds
          .map(id => units.find(u => u.id === id))
          .filter(u => u && u.owner === owner)
        if (selectedUnits.length === 0) {
          rejected.push({ actionId: action.actionId, reason: 'UNKNOWN_ENTITY' })
          return
        }

        if (action.command === 'move') {
          if (!targetPos) {
            rejected.push({ actionId: action.actionId, reason: 'INVALID_TARGET' })
            return
          }
          if (action.queueMode === 'append') {
            selectedUnits.forEach(unit => {
              unit.commandQueue = unit.commandQueue || []
              unit.commandQueue.push({ type: 'move', x: worldTarget.x, y: worldTarget.y })
            })
          } else {
            selectedUnits.forEach(unit => {
              unit.moveTarget = { x: targetPos.x, y: targetPos.y }
              unit.target = null
              unit.guardTarget = null
              unit.guardMode = false
            })
          }
          accepted.push({ actionId: action.actionId, type: action.type, unitIds: action.unitIds })
          return
        }

        if (action.command === 'attack') {
          if (action.queueMode === 'append') {
            if (!target) {
              rejected.push({ actionId: action.actionId, reason: 'INVALID_TARGET' })
              return
            }
            selectedUnits.forEach(unit => {
              unit.commandQueue = unit.commandQueue || []
              unit.commandQueue.push({ type: 'attack', target })
            })
          } else if (target) {
            selectedUnits.forEach(unit => {
              unit.target = target
              unit.moveTarget = null
              unit.guardTarget = null
              unit.guardMode = false
            })
          } else if (targetPos) {
            selectedUnits.forEach(unit => {
              unit.moveTarget = { x: targetPos.x, y: targetPos.y }
              unit.target = null
            })
          } else {
            rejected.push({ actionId: action.actionId, reason: 'INVALID_TARGET' })
            return
          }
          accepted.push({ actionId: action.actionId, type: action.type, unitIds: action.unitIds })
          return
        }

        if (action.command === 'stop') {
          selectedUnits.forEach(unit => {
            unit.path = null
            unit.moveTarget = null
            unit.target = null
            unit.attackTarget = null
            unit.guardTarget = null
            unit.guardMode = false
            unit.commandQueue = []
            unit.currentCommand = null
          })
          accepted.push({ actionId: action.actionId, type: action.type, unitIds: action.unitIds })
          return
        }

        if (action.command === 'hold') {
          selectedUnits.forEach(unit => {
            unit.holdFire = true
            unit.target = null
            unit.moveTarget = null
          })
          accepted.push({ actionId: action.actionId, type: action.type, unitIds: action.unitIds })
          return
        }

        if (action.command === 'guard') {
          if (!target) {
            rejected.push({ actionId: action.actionId, reason: 'INVALID_TARGET' })
            return
          }
          selectedUnits.forEach(unit => {
            unit.guardTarget = target
            unit.guardMode = true
            unit.target = null
            unit.moveTarget = null
          })
          accepted.push({ actionId: action.actionId, type: action.type, unitIds: action.unitIds })
          return
        }

        rejected.push({ actionId: action.actionId, reason: 'NOT_SUPPORTED' })
        return
      }
      case 'set_rally': {
        const building = findBuildingById(buildings, factories, action.buildingId)
        if (!building || building.owner !== owner) {
          rejected.push({ actionId: action.actionId, reason: 'UNKNOWN_ENTITY' })
          return
        }
        const rallyPoint = toWorldPosition(action.rallyPoint)
        building.rallyPoint = rallyPoint
        accepted.push({ actionId: action.actionId, type: action.type })
        return
      }
      case 'cancel':
      case 'ability':
      default:
        rejected.push({ actionId: action.actionId, reason: 'NOT_SUPPORTED' })
    }
  })

  return { accepted, rejected }
}
