export const logEntries = []

export function log(message) {
  const timestamp = new Date().toISOString()
  const entry = `[${timestamp}] ${message}`
  logEntries.push(entry)
  window.logger(entry)
}

export function getLogs() {
  return logEntries.join('\n')
}

export function downloadLogs(filename = 'game.log') {
  const blob = new Blob([getLogs()], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function enableUnitLogging(unit) {
  unit.loggingEnabled = true
  log(`Started logging for unit ${unit.id} (${unit.type})`)
}

export function disableUnitLogging(unit) {
  unit.loggingEnabled = false
  log(`Stopped logging for unit ${unit.id} (${unit.type})`)
}

export function toggleUnitLogging(unit) {
  if (unit.loggingEnabled) {
    disableUnitLogging(unit)
  } else {
    enableUnitLogging(unit)
  }
}

export function getUnitStatus(unit) {
  if (unit.isRetreating) return 'retreating'
  if (unit.isDodging) return 'dodging'
  if (unit.harvesting) return 'harvesting'
  if (unit.unloadingAtRefinery) return 'unloading'
  if (unit.target && unit.isAttacking) return 'attacking target'
  if (unit.moveTarget) return 'moving to target'
  if (unit.movement && unit.movement.isMoving) return 'moving'
  return 'idle'
}

export function logUnitStatus(unit) {
  const status = getUnitStatus(unit)
  if (unit.lastLoggedStatus !== status) {
    log(`Unit ${unit.id} (${unit.type}) status: ${status}`)
    unit.lastLoggedStatus = status
  }
}
