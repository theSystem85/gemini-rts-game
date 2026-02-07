let nextEventId = 1
const events = []

function nowId() {
  return `ev_${nextEventId++}`
}

function pushEvent(event) {
  events.push({
    id: nowId(),
    ...event
  })
}

export function recordUnitCreated({ unit, tick, timeSeconds }) {
  if (!unit) return
  pushEvent({
    type: 'unit_created',
    tick,
    timeSeconds,
    unitId: unit.id,
    unitType: unit.type,
    owner: unit.owner,
    position: unit.position || {
      x: unit.x,
      y: unit.y,
      space: 'world'
    }
  })
}

export function recordBuildingStarted({ building, tick, timeSeconds }) {
  if (!building) return
  pushEvent({
    type: 'building_started',
    tick,
    timeSeconds,
    buildingId: building.id,
    buildingType: building.type,
    owner: building.owner,
    tilePosition: {
      x: building.x,
      y: building.y,
      space: 'tile'
    }
  })
}

export function recordBuildingCompleted({ building, tick, timeSeconds }) {
  if (!building) return
  pushEvent({
    type: 'building_completed',
    tick,
    timeSeconds,
    buildingId: building.id,
    buildingType: building.type,
    owner: building.owner,
    tilePosition: {
      x: building.x,
      y: building.y,
      space: 'tile'
    }
  })
}

export function recordDamage({ attackerId, targetId, targetKind, amount, position, tick, timeSeconds, weapon }) {
  if (!targetId || !Number.isFinite(amount)) return
  pushEvent({
    type: 'damage',
    tick,
    timeSeconds,
    attackerId,
    targetId,
    targetKind,
    amount,
    weapon,
    position
  })
}

export function recordDestroyed({ killerId, victimId, victimKind, position, tick, timeSeconds, cause }) {
  if (!victimId) return
  pushEvent({
    type: 'destroyed',
    tick,
    timeSeconds,
    killerId,
    victimId,
    victimKind,
    cause,
    position
  })
}

export function collectTransitionsSince(sinceTick = 0) {
  const filtered = events.filter(event => event.tick > sinceTick)
  const summary = filtered.reduce(
    (acc, event) => {
      if (event.type === 'damage') {
        acc.totalDamage += event.amount
      }
      if (event.type === 'destroyed') {
        if (event.victimKind === 'unit') acc.unitsDestroyed += 1
        if (event.victimKind !== 'unit') acc.buildingsDestroyed += 1
      }
      return acc
    },
    { totalDamage: 0, unitsDestroyed: 0, buildingsDestroyed: 0 }
  )

  return { events: filtered, summary }
}

export function pruneTransitionsUpTo(tick) {
  if (!Number.isFinite(tick)) return
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].tick <= tick) {
      events.splice(i, 1)
    }
  }
}

export function resetTransitions() {
  events.length = 0
  nextEventId = 1
}
