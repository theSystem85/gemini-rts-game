import { UNIT_COLLISION_MIN_DISTANCE } from './movementConstants.js'

export {
  checkMineDetonation,
  isUnitCenterInsideMineCircle,
  hasFriendlyUnitOnTile,
  initializeUnitMovement,
  updateUnitPosition,
  stopUnitMovement,
  cancelUnitMovement,
  resetUnitVelocityForNewPath,
  isUnitMoving
} from './movementCore.js'

export {
  normalizeAngle,
  isAirborneUnit,
  isGroundUnit,
  ownersAreEnemies
} from './movementHelpers.js'

export {
  rotateUnitInPlace,
  handleStuckUnit,
  isValidDodgePosition
} from './movementStuck.js'

export { UNIT_COLLISION_MIN_DISTANCE }
