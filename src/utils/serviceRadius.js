import { TILE_SIZE } from '../config.js'

const SERVICE_BUILDING_TYPES = new Set(['vehicleWorkshop', 'hospital', 'gasStation'])

export function isServiceBuilding(buildingOrType) {
  if (!buildingOrType) return false
  const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type
  return SERVICE_BUILDING_TYPES.has(type)
}

export function computeServiceRadiusTiles(width = 1, height = 1) {
  const halfWidth = (width || 1) / 2
  const halfHeight = (height || 1) / 2
  const radiusX = halfWidth + 0.5
  const radiusY = halfHeight + 0.5
  return Math.hypot(radiusX, radiusY)
}

export function ensureServiceRadius(building) {
  if (!building || !isServiceBuilding(building)) {
    return 0
  }

  if (typeof building.serviceRadius === 'number') {
    return building.serviceRadius
  }

  const radius = computeServiceRadiusTiles(building.width, building.height)
  building.serviceRadius = radius
  return radius
}

export function getServiceRadiusPixels(building) {
  const radiusTiles = ensureServiceRadius(building)
  return radiusTiles * TILE_SIZE
}

export function getServiceBuildingTypes() {
  return Array.from(SERVICE_BUILDING_TYPES)
}
