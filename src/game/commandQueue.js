import { initiateRetreat } from '../behaviours/retreat.js'

export function processCommandQueues(units, mapGrid, unitCommands) {
  units.forEach(unit => {
    if (!unit.commandQueue || unit.commandQueue.length === 0) return;

    if (!unit.currentCommand) {
      const action = unit.commandQueue.shift();
      unit.currentCommand = action;
      executeAction(unit, action, mapGrid, unitCommands);
    } else {
      if (isActionComplete(unit, unit.currentCommand)) {
        unit.currentCommand = null;
      }
    }
  });
}

function executeAction(unit, action, mapGrid, unitCommands) {
  switch (action.type) {
    case 'move':
      unitCommands.handleMovementCommand([unit], action.x, action.y, mapGrid, true);
      break;
    case 'attack':
      unitCommands.handleAttackCommand([unit], action.target, mapGrid, false, true);
      break;
    case 'agf':
      unit.attackQueue = [];
      action.targets.forEach(t => unit.attackQueue.push(t));
      if (unit.attackQueue.length > 0) {
        unitCommands.handleAttackCommand([unit], unit.attackQueue[0], mapGrid, false, true);
      }
      break;
    case 'retreat':
      initiateRetreat([unit], action.x, action.y, mapGrid);
      break;
    case 'workshopRepair':
      unitCommands.handleWorkshopRepairHotkey([unit], mapGrid, false, true);
      break;
  }
}

function isActionComplete(unit, action) {
  switch (action.type) {
    case 'move':
      return (!unit.path || unit.path.length === 0) && !unit.moveTarget;
    case 'attack':
    case 'agf':
      return (!unit.target || unit.target.health <= 0) && (!unit.attackQueue || unit.attackQueue.length === 0);
    case 'retreat':
      return !unit.isRetreating;
    case 'workshopRepair':
      return !unit.targetWorkshop && !unit.repairingAtWorkshop && !unit.returningFromWorkshop && (!unit.moveTarget && (!unit.path || unit.path.length === 0));
  }
  return true;
}
