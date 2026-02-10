import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/config.js', async() => {
  const actual = await vi.importActual('../../src/config.js')
  return {
    ...actual,
    TILE_SIZE: 32
  }
})

vi.mock('../../src/logic.js', () => ({
  smoothRotateTowardsAngle: vi.fn((_current, desired) => desired)
}))

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    humanPlayer: 'player',
    units: [],
    buildings: []
  }
}))

vi.mock('../../src/utils.js', () => ({
  getBuildingIdentifier: vi.fn(building => `helipad-${building.id}`)
}))

vi.mock('../../src/utils/helipadUtils.js', () => ({
  getHelipadLandingCenter: vi.fn(helipad => ({
    x: (helipad.x + 1) * 32,
    y: (helipad.y + 1) * 32
  })),
  getHelipadLandingTile: vi.fn(helipad => ({ x: helipad.x + 1, y: helipad.y + 1 })),
  isHelipadAvailableForUnit: vi.fn(() => true)
}))

vi.mock('../../src/ui/notifications.js', () => ({
  showNotification: vi.fn()
}))

vi.mock('../../src/game/unitCombat/combatConfig.js', () => ({
  COMBAT_CONFIG: {
    RANGE_MULTIPLIER: { ROCKET: 1 },
    APACHE: { FIRE_RATE: 1000, VOLLEY_DELAY: 180 }
  }
}))

vi.mock('../../src/game/unitCombat/combatHelpers.js', () => ({
  getEffectiveFireRange: vi.fn(() => 200),
  getEffectiveFireRate: vi.fn(() => 1000),
  isHumanControlledParty: vi.fn(() => true)
}))

vi.mock('../../src/game/unitCombat/firingHandlers.js', () => ({
  handleApacheVolley: vi.fn(() => true)
}))

import { gameState } from '../../src/gameState.js'
import { updateApacheCombat } from '../../src/game/unitCombat/apacheCombat.js'

const createTarget = (overrides = {}) => ({
  id: 'enemy-1',
  type: 'tank',
  x: 5 * 32,
  y: 5 * 32,
  tileX: 5,
  tileY: 5,
  health: 100,
  ...overrides
})

const createApache = (target, overrides = {}) => ({
  id: 'apache-1',
  owner: 'player',
  type: 'apache',
  x: 2 * 32,
  y: 2 * 32,
  direction: 0,
  rotationSpeed: 0.2,
  target,
  rocketAmmo: 0,
  maxRocketAmmo: 8,
  canFire: true,
  volleyState: null,
  flightPlan: null,
  moveTarget: null,
  path: [],
  health: 100,
  ...overrides
})

describe('apacheCombat auto return behavior', () => {
  beforeEach(() => {
    gameState.units = []
    gameState.buildings = []
  })

  it('returns to helipad and stores combat target when out of ammo', () => {
    const target = createTarget()
    const apache = createApache(target)
    const helipad = { id: 'h1', type: 'helipad', owner: 'player', x: 10, y: 10, width: 2, height: 2, health: 100 }
    gameState.buildings = [helipad]

    updateApacheCombat(apache, [apache, target], [], [[0]], 1000, null)

    expect(apache.helipadLandingRequested).toBe(true)
    expect(apache.autoReturnRefilling).toBe(true)
    expect(apache.autoReturnCombatTarget).toMatchObject({ id: 'enemy-1', type: 'unit' })
  })

  it('sends apache back to helipad when current target is destroyed', () => {
    const target = createTarget({ health: 0 })
    const apache = createApache(target, { rocketAmmo: 4, maxRocketAmmo: 8 })
    const helipad = { id: 'h1', type: 'helipad', owner: 'player', x: 6, y: 6, width: 2, height: 2, health: 100 }
    gameState.buildings = [helipad]

    updateApacheCombat(apache, [apache], [], [[0]], 1500, null)

    expect(apache.target).toBeNull()
    expect(apache.helipadLandingRequested).toBe(true)
    expect(apache.volleyState).toBeNull()
  })

  it('resumes attacking stored target after rearming and taking off', () => {
    const target = createTarget()
    const apache = createApache(null, {
      rocketAmmo: 8,
      autoReturnRefilling: true,
      autoReturnCombatTarget: { id: target.id, type: 'unit', ref: target },
      helipadLandingRequested: false,
      landedHelipadId: null
    })

    updateApacheCombat(apache, [apache, target], [], [[0]], 2000, null)

    expect(apache.target).toBe(target)
    expect(apache.autoReturnRefilling).toBe(false)
    expect(apache.autoReturnCombatTarget).toBeNull()
  })
})
