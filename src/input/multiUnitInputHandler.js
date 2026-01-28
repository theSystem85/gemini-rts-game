// multiUnitInputHandler.js

function isUnitAlive(unit) {
  return Boolean(unit && typeof unit.health === 'number' && unit.health > 0)
}

export function filterEligibleUnits(selectedUnits, { allowBuildings = false } = {}) {
  if (!Array.isArray(selectedUnits)) {
    return []
  }

  return selectedUnits.filter(unit => {
    if (!isUnitAlive(unit)) {
      return false
    }

    if (!allowBuildings && unit.isBuilding) {
      return false
    }

    return true
  })
}

export function applyCommandsToUnit(unit, commands, { queue = false } = {}) {
  if (!unit || !Array.isArray(commands)) {
    return
  }

  if (queue) {
    if (!unit.commandQueue) {
      unit.commandQueue = []
    }
    unit.commandQueue.push(...commands)
    return
  }

  unit.commandQueue = [...commands]
  unit.currentCommand = null
}

export function distributeCommandsToUnits(selectedUnits, targets, createCommand, options = {}) {
  const { queue = false, allowBuildings = false } = options

  if (!Array.isArray(targets) || targets.length === 0 || typeof createCommand !== 'function') {
    return []
  }

  const eligibleUnits = filterEligibleUnits(selectedUnits, { allowBuildings })
  if (eligibleUnits.length === 0) {
    return []
  }

  const assignments = eligibleUnits.map(() => [])

  targets.forEach((target, index) => {
    const command = createCommand(target, index)
    if (!command) {
      return
    }
    assignments[index % eligibleUnits.length].push(command)
  })

  eligibleUnits.forEach((unit, index) => {
    const commands = assignments[index]
    if (queue && commands.length === 0) {
      return
    }
    applyCommandsToUnit(unit, commands, { queue })
  })

  return eligibleUnits.map((unit, index) => ({ unit, commands: assignments[index] }))
}
