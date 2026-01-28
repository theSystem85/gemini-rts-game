import { describe, it, expect, vi } from 'vitest'
import {
  isTankUnit,
  calculateHitZoneDamageMultiplier
} from '../../src/game/hitZoneCalculator.js'

// Mock config
vi.mock('../../src/config.js', () => ({
  HIT_ZONE_DAMAGE_MULTIPLIERS: {
    FRONT: 0.75,
    SIDE: 1.0,
    REAR: 1.5
  }
}))

describe('hitZoneCalculator', () => {
  describe('isTankUnit', () => {
    it('returns true for tank', () => {
      expect(isTankUnit({ type: 'tank' })).toBe(true)
    })

    it('returns true for tank_v1', () => {
      expect(isTankUnit({ type: 'tank_v1' })).toBe(true)
    })

    it('returns true for tank_v2', () => {
      expect(isTankUnit({ type: 'tank_v2' })).toBe(true)
    })

    it('returns true for tank_v3', () => {
      expect(isTankUnit({ type: 'tank_v3' })).toBe(true)
    })

    it('returns true for tank-v2 (with hyphen)', () => {
      expect(isTankUnit({ type: 'tank-v2' })).toBe(true)
    })

    it('returns true for tank-v3 (with hyphen)', () => {
      expect(isTankUnit({ type: 'tank-v3' })).toBe(true)
    })

    it('returns true for rocketTank', () => {
      expect(isTankUnit({ type: 'rocketTank' })).toBe(true)
    })

    it('returns false for harvester', () => {
      expect(isTankUnit({ type: 'harvester' })).toBe(false)
    })

    it('returns false for infantry', () => {
      expect(isTankUnit({ type: 'infantry' })).toBe(false)
    })

    it('returns false for apache', () => {
      expect(isTankUnit({ type: 'apache' })).toBe(false)
    })

    it('returns false for ambulance', () => {
      expect(isTankUnit({ type: 'ambulance' })).toBe(false)
    })

    it('returns false for null unit', () => {
      expect(isTankUnit(null)).toBe(false)
    })

    it('returns false for undefined unit', () => {
      expect(isTankUnit(undefined)).toBe(false)
    })

    it('returns false for unit without type', () => {
      expect(isTankUnit({})).toBe(false)
    })
  })

  describe('calculateHitZoneDamageMultiplier', () => {
    describe('non-tank units', () => {
      it('returns default multiplier for harvester', () => {
        const bullet = { x: 0, y: 0 }
        const unit = { type: 'harvester', x: 10, y: 10, direction: 0 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.0)
        expect(result.isRearHit).toBe(false)
      })

      it('returns default multiplier for null unit type', () => {
        const bullet = { x: 0, y: 0 }
        const unit = { type: null, x: 10, y: 10, direction: 0 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.0)
        expect(result.isRearHit).toBe(false)
      })
    })

    describe('front hits (0° to 45°)', () => {
      it('returns front multiplier when bullet hits from directly ahead', () => {
        // Unit at (32, 32) facing right (direction = 0)
        // Bullet coming from the right (ahead of unit)
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 48, y: 32 } // Right of unit center (32, 32)

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })

      it('returns front multiplier for slight angle to the front', () => {
        // Unit facing right (direction = 0)
        // Bullet slightly above the center-right
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 48, y: 28 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })
    })

    describe('side hits (45° to 135°)', () => {
      it('returns side multiplier when bullet hits from the side', () => {
        // Unit at (32, 32) facing right (direction = 0)
        // Bullet coming from above (perpendicular)
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 32, y: 0 } // Directly above

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.0)
        expect(result.isRearHit).toBe(false)
      })

      it('returns side multiplier when bullet hits from below', () => {
        // Unit facing right (direction = 0)
        // Bullet coming from below
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 32, y: 64 } // Directly below

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.0)
        expect(result.isRearHit).toBe(false)
      })
    })

    describe('rear hits (135° to 180°)', () => {
      it('returns rear multiplier when bullet hits from directly behind', () => {
        // Unit at (32, 32) facing right (direction = 0)
        // Bullet coming from the left (behind)
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 0, y: 32 } // Left of unit center

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.5)
        expect(result.isRearHit).toBe(true)
      })

      it('returns rear multiplier for angled rear hit', () => {
        // Unit facing right (direction = 0)
        // Bullet from behind-left corner
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 0, y: 16 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(1.5)
        expect(result.isRearHit).toBe(true)
      })
    })

    describe('unit facing different directions', () => {
      it('calculates correctly when unit faces up (direction = -PI/2)', () => {
        // Unit facing up, bullet from above = front hit
        const unit = { type: 'tank', x: 16, y: 16, direction: -Math.PI / 2 }
        const bullet = { x: 32, y: 0 } // Above

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })

      it('calculates correctly when unit faces down (direction = PI/2)', () => {
        // Unit facing down, bullet from below = front hit
        const unit = { type: 'tank', x: 16, y: 16, direction: Math.PI / 2 }
        const bullet = { x: 32, y: 64 } // Below

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })

      it('uses turretDirection when direction is not set', () => {
        // Unit with only turretDirection, facing right
        const unit = { type: 'tank', x: 16, y: 16, turretDirection: 0 }
        const bullet = { x: 48, y: 32 } // Right = front

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })

      it('defaults to direction 0 when no direction set', () => {
        // Unit with no direction properties
        const unit = { type: 'tank', x: 16, y: 16 }
        const bullet = { x: 48, y: 32 } // Right = front

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result.multiplier).toBe(0.75)
        expect(result.isRearHit).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('handles bullet at exact unit center', () => {
        const unit = { type: 'tank', x: 16, y: 16, direction: 0 }
        const bullet = { x: 32, y: 32 } // At unit center

        // When bullet is at center, angle is 0, which means front
        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result).toBeDefined()
        expect(typeof result.multiplier).toBe('number')
      })

      it('handles extreme positions', () => {
        const unit = { type: 'tank', x: 1000, y: 1000, direction: 0 }
        const bullet = { x: 0, y: 0 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result).toBeDefined()
        expect(typeof result.multiplier).toBe('number')
      })

      it('handles negative positions', () => {
        const unit = { type: 'tank', x: -100, y: -100, direction: 0 }
        const bullet = { x: 0, y: 0 }

        const result = calculateHitZoneDamageMultiplier(bullet, unit)

        expect(result).toBeDefined()
        expect(typeof result.multiplier).toBe('number')
      })
    })

    describe('all tank types', () => {
      const tankTypes = ['tank', 'tank_v1', 'tank_v2', 'tank_v3', 'tank-v2', 'tank-v3', 'rocketTank']

      tankTypes.forEach(tankType => {
        it(`applies hit zone damage to ${tankType}`, () => {
          const unit = { type: tankType, x: 16, y: 16, direction: 0 }
          const bullet = { x: 0, y: 32 } // Behind = rear hit

          const result = calculateHitZoneDamageMultiplier(bullet, unit)

          expect(result.multiplier).toBe(1.5)
          expect(result.isRearHit).toBe(true)
        })
      })
    })
  })
})
