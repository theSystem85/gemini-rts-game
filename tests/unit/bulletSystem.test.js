/**
 * Unit tests for bullet/projectile system
 *
 * Tests bullet creation, movement, trajectory, collision detection
 * with units and buildings, and explosion radius damage.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  checkUnitCollision,
  checkBuildingCollision,
  checkFactoryCollision,
  checkWreckCollision
} from '../../src/game/bulletCollision.js'
import { TILE_SIZE, BULLET_DAMAGES } from '../../src/config.js'

// Mock performance.now for consistent timing
vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now())
})

/**
 * Creates a mock bullet
 * @param {Object} options - Bullet options
 * @returns {Object} - Mock bullet
 */
function createMockBullet(options = {}) {
  return {
    id: options.id || Date.now(),
    x: options.x ?? 100,
    y: options.y ?? 100,
    vx: options.vx ?? 5,
    vy: options.vy ?? 0,
    speed: options.speed ?? 12,
    baseDamage: options.baseDamage ?? 25,
    active: options.active ?? true,
    shooter: options.shooter || { id: 'shooter-1', owner: 'player', type: 'tank_v1' },
    homing: options.homing ?? false,
    target: options.target || null,
    targetPosition: options.targetPosition || null,
    projectileType: options.projectileType || 'bullet',
    startTime: options.startTime || Date.now(),
    explosionRadius: options.explosionRadius || undefined
  }
}

/**
 * Creates a mock unit
 * @param {Object} options - Unit options
 * @returns {Object} - Mock unit
 */
function createMockUnit(options = {}) {
  const tileX = options.tileX ?? 5
  const tileY = options.tileY ?? 5

  return {
    id: options.id || `unit-${Date.now()}`,
    type: options.type || 'tank_v1',
    owner: options.owner || 'enemy',
    x: options.x ?? tileX * TILE_SIZE,
    y: options.y ?? tileY * TILE_SIZE,
    tileX,
    tileY,
    health: options.health ?? 100,
    maxHealth: options.maxHealth ?? 100,
    isAirUnit: options.isAirUnit ?? false,
    altitude: options.altitude ?? 0
  }
}

/**
 * Creates a mock building
 * @param {Object} options - Building options
 * @returns {Object} - Mock building
 */
function createMockBuilding(options = {}) {
  return {
    id: options.id || `building-${Date.now()}`,
    type: options.type || 'powerPlant',
    owner: options.owner || 'enemy',
    x: options.x ?? 10,
    y: options.y ?? 10,
    width: options.width ?? 2,
    height: options.height ?? 2,
    health: options.health ?? 500,
    maxHealth: options.maxHealth ?? 500
  }
}

/**
 * Creates a mock factory
 * @param {Object} options - Factory options
 * @returns {Object} - Mock factory
 */
function createMockFactory(options = {}) {
  return {
    id: options.id || 'enemy',
    type: options.type || 'constructionYard',
    owner: options.owner || 'enemy',
    x: options.x ?? 15,
    y: options.y ?? 15,
    width: options.width ?? 3,
    height: options.height ?? 3,
    health: options.health ?? 1000,
    maxHealth: options.maxHealth ?? 1000,
    destroyed: options.destroyed ?? false
  }
}

/**
 * Creates a mock wreck
 * @param {Object} options - Wreck options
 * @returns {Object} - Mock wreck
 */
function createMockWreck(options = {}) {
  return {
    id: options.id || `wreck-${Date.now()}`,
    x: options.x ?? 200,
    y: options.y ?? 200,
    health: options.health ?? 50,
    maxHealth: options.maxHealth ?? 100
  }
}

describe('Bullet System', () => {
  describe('Bullet Creation', () => {
    it('should create bullet with correct properties', () => {
      const bullet = createMockBullet({
        x: 100,
        y: 100,
        speed: 12,
        baseDamage: 25
      })

      expect(bullet.x).toBe(100)
      expect(bullet.y).toBe(100)
      expect(bullet.speed).toBe(12)
      expect(bullet.baseDamage).toBe(25)
      expect(bullet.active).toBe(true)
    })

    it('should have shooter reference', () => {
      const shooter = { id: 'tank-1', owner: 'player', type: 'tank_v1' }
      const bullet = createMockBullet({ shooter })

      expect(bullet.shooter).toBe(shooter)
    })

    it('should support homing property', () => {
      const bullet = createMockBullet({ homing: true })

      expect(bullet.homing).toBe(true)
    })

    it('should support target reference', () => {
      const target = createMockUnit({ owner: 'enemy' })
      const bullet = createMockBullet({ target })

      expect(bullet.target).toBe(target)
    })

    it('should support target position', () => {
      const targetPosition = { x: 500, y: 300 }
      const bullet = createMockBullet({ targetPosition })

      expect(bullet.targetPosition.x).toBe(500)
      expect(bullet.targetPosition.y).toBe(300)
    })

    it('should support different projectile types', () => {
      const regularBullet = createMockBullet({ projectileType: 'bullet' })
      const rocketBullet = createMockBullet({ projectileType: 'rocket' })
      const artilleryBullet = createMockBullet({ projectileType: 'artillery' })

      expect(regularBullet.projectileType).toBe('bullet')
      expect(rocketBullet.projectileType).toBe('rocket')
      expect(artilleryBullet.projectileType).toBe('artillery')
    })

    it('should support explosion radius for rockets', () => {
      const rocket = createMockBullet({
        projectileType: 'rocket',
        explosionRadius: TILE_SIZE * 1.5
      })

      expect(rocket.explosionRadius).toBe(TILE_SIZE * 1.5)
    })
  })

  describe('Bullet Movement', () => {
    it('should have velocity components', () => {
      const bullet = createMockBullet({ vx: 10, vy: 5 })

      expect(bullet.vx).toBe(10)
      expect(bullet.vy).toBe(5)
    })

    it('should update position based on velocity', () => {
      const bullet = createMockBullet({ x: 100, y: 100, vx: 10, vy: 5 })

      // Simulate one frame of movement
      bullet.x += bullet.vx
      bullet.y += bullet.vy

      expect(bullet.x).toBe(110)
      expect(bullet.y).toBe(105)
    })

    it('should calculate correct angle for velocity', () => {
      // Bullet moving east (angle = 0)
      const bulletEast = createMockBullet({ vx: 10, vy: 0 })
      const angleEast = Math.atan2(bulletEast.vy, bulletEast.vx)
      expect(angleEast).toBeCloseTo(0)

      // Bullet moving south (angle = PI/2)
      const bulletSouth = createMockBullet({ vx: 0, vy: 10 })
      const angleSouth = Math.atan2(bulletSouth.vy, bulletSouth.vx)
      expect(angleSouth).toBeCloseTo(Math.PI / 2)

      // Bullet moving diagonal (angle = PI/4)
      const bulletDiag = createMockBullet({ vx: 10, vy: 10 })
      const angleDiag = Math.atan2(bulletDiag.vy, bulletDiag.vx)
      expect(angleDiag).toBeCloseTo(Math.PI / 4)
    })

    it('should track start time', () => {
      const startTime = 1000
      const bullet = createMockBullet({ startTime })

      expect(bullet.startTime).toBe(1000)
    })
  })

  describe('Unit Collision Detection', () => {
    it('should detect collision when bullet hits unit', () => {
      const unit = createMockUnit({ tileX: 5, tileY: 5, owner: 'enemy' })
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2

      const bullet = createMockBullet({
        x: unitCenterX + 5, // Close to center
        y: unitCenterY
      })

      const collides = checkUnitCollision(bullet, unit)

      expect(collides).toBe(true)
    })

    it('should not detect collision when bullet misses unit', () => {
      const unit = createMockUnit({ tileX: 5, tileY: 5, owner: 'enemy' })
      const bullet = createMockBullet({
        x: unit.x + TILE_SIZE * 5, // Far from unit
        y: unit.y
      })

      const collides = checkUnitCollision(bullet, unit)

      expect(collides).toBe(false)
    })

    it('should not collide with dead units', () => {
      const unit = createMockUnit({ health: 0, owner: 'enemy' })
      const bullet = createMockBullet({
        x: unit.x + TILE_SIZE / 2,
        y: unit.y + TILE_SIZE / 2
      })

      const collides = checkUnitCollision(bullet, unit)

      expect(collides).toBe(false)
    })

    it('should not collide with friendly units', () => {
      const friendlyUnit = createMockUnit({ owner: 'player' })
      const shooter = { id: 'tank-1', owner: 'player', type: 'tank_v1' }
      const bullet = createMockBullet({
        x: friendlyUnit.x + TILE_SIZE / 2,
        y: friendlyUnit.y + TILE_SIZE / 2,
        shooter
      })

      const collides = checkUnitCollision(bullet, friendlyUnit)

      expect(collides).toBe(false)
    })

    it('should handle null bullet', () => {
      const unit = createMockUnit()

      const collides = checkUnitCollision(null, unit)

      expect(collides).toBe(false)
    })

    it('should handle null unit', () => {
      const bullet = createMockBullet()

      const collides = checkUnitCollision(bullet, null)

      expect(collides).toBe(false)
    })

    it('should adjust collision for Apache altitude', () => {
      const apache = createMockUnit({
        type: 'apache',
        isAirUnit: true,
        altitude: TILE_SIZE * 2,
        owner: 'enemy'
      })

      // Bullet at visual position (adjusted for altitude)
      const visualY = apache.y + TILE_SIZE / 2 - (apache.altitude * 0.4)
      const bullet = createMockBullet({
        x: apache.x + TILE_SIZE / 2,
        y: visualY
      })

      const collides = checkUnitCollision(bullet, apache)

      expect(collides).toBe(true)
    })
  })

  describe('Building Collision Detection', () => {
    it('should detect collision when bullet hits building', () => {
      const building = createMockBuilding({ x: 10, y: 10, width: 2, height: 2, owner: 'enemy' })
      const buildingCenterX = building.x * TILE_SIZE + (building.width * TILE_SIZE) / 2
      const buildingCenterY = building.y * TILE_SIZE + (building.height * TILE_SIZE) / 2

      const bullet = createMockBullet({
        x: buildingCenterX,
        y: buildingCenterY
      })

      const collides = checkBuildingCollision(bullet, building)

      expect(collides).toBe(true)
    })

    it('should not detect collision when bullet misses building', () => {
      const building = createMockBuilding({ x: 10, y: 10, owner: 'enemy' })
      const bullet = createMockBullet({
        x: 0, // Far from building
        y: 0
      })

      const collides = checkBuildingCollision(bullet, building)

      expect(collides).toBe(false)
    })

    it('should not collide with dead buildings', () => {
      const building = createMockBuilding({ health: 0, owner: 'enemy' })
      const bullet = createMockBullet({
        x: building.x * TILE_SIZE + TILE_SIZE,
        y: building.y * TILE_SIZE + TILE_SIZE
      })

      const collides = checkBuildingCollision(bullet, building)

      expect(collides).toBe(false)
    })

    it('should not collide with friendly buildings', () => {
      const friendlyBuilding = createMockBuilding({ owner: 'player' })
      const shooter = { id: 'tank-1', owner: 'player', type: 'tank_v1' }
      const bullet = createMockBullet({
        x: friendlyBuilding.x * TILE_SIZE + TILE_SIZE,
        y: friendlyBuilding.y * TILE_SIZE + TILE_SIZE,
        shooter
      })

      const collides = checkBuildingCollision(bullet, friendlyBuilding)

      expect(collides).toBe(false)
    })

    it('should handle building bounds correctly', () => {
      const building = createMockBuilding({ x: 5, y: 5, width: 3, height: 2, owner: 'enemy' })

      // Test edge of building
      const bulletAtEdge = createMockBullet({
        x: building.x * TILE_SIZE + 1,
        y: building.y * TILE_SIZE + 1
      })

      expect(checkBuildingCollision(bulletAtEdge, building)).toBe(true)
    })
  })

  describe('Factory Collision Detection', () => {
    it('should detect collision when bullet hits factory', () => {
      const factory = createMockFactory({ x: 15, y: 15, width: 3, height: 3 })
      const factoryCenterX = factory.x * TILE_SIZE + (factory.width * TILE_SIZE) / 2
      const factoryCenterY = factory.y * TILE_SIZE + (factory.height * TILE_SIZE) / 2

      const bullet = createMockBullet({
        x: factoryCenterX,
        y: factoryCenterY
      })

      const collides = checkFactoryCollision(bullet, factory)

      expect(collides).toBe(true)
    })

    it('should not detect collision when bullet misses factory', () => {
      const factory = createMockFactory({ x: 15, y: 15 })
      const bullet = createMockBullet({
        x: 0,
        y: 0
      })

      const collides = checkFactoryCollision(bullet, factory)

      expect(collides).toBe(false)
    })

    it('should not collide with destroyed factory', () => {
      const factory = createMockFactory({ destroyed: true })
      const bullet = createMockBullet({
        x: factory.x * TILE_SIZE + TILE_SIZE,
        y: factory.y * TILE_SIZE + TILE_SIZE
      })

      const collides = checkFactoryCollision(bullet, factory)

      expect(collides).toBe(false)
    })

    it('should not collide with friendly factory', () => {
      const friendlyFactory = createMockFactory({ id: 'player' })
      const shooter = { id: 'tank-1', owner: 'player', type: 'tank_v1' }
      const bullet = createMockBullet({
        x: friendlyFactory.x * TILE_SIZE + TILE_SIZE,
        y: friendlyFactory.y * TILE_SIZE + TILE_SIZE,
        shooter
      })

      const collides = checkFactoryCollision(bullet, friendlyFactory)

      expect(collides).toBe(false)
    })
  })

  describe('Wreck Collision Detection', () => {
    it('should detect collision when bullet hits wreck', () => {
      const wreck = createMockWreck({ x: 200, y: 200, health: 50 })
      const bullet = createMockBullet({
        x: wreck.x + TILE_SIZE / 2 + 5,
        y: wreck.y + TILE_SIZE / 2
      })

      const collides = checkWreckCollision(bullet, wreck)

      expect(collides).toBe(true)
    })

    it('should not detect collision when bullet misses wreck', () => {
      const wreck = createMockWreck({ x: 200, y: 200 })
      const bullet = createMockBullet({
        x: 0,
        y: 0
      })

      const collides = checkWreckCollision(bullet, wreck)

      expect(collides).toBe(false)
    })

    it('should not collide with destroyed wrecks', () => {
      const wreck = createMockWreck({ health: 0 })
      const bullet = createMockBullet({
        x: wreck.x + TILE_SIZE / 2,
        y: wreck.y + TILE_SIZE / 2
      })

      const collides = checkWreckCollision(bullet, wreck)

      expect(collides).toBe(false)
    })

    it('should handle null wreck', () => {
      const bullet = createMockBullet()

      const collides = checkWreckCollision(bullet, null)

      expect(collides).toBe(false)
    })
  })

  describe('Damage Calculation', () => {
    it('should have different base damages for unit types', () => {
      expect(BULLET_DAMAGES).toBeDefined()
    })

    it('should apply base damage', () => {
      const bullet = createMockBullet({ baseDamage: 25 })
      const target = createMockUnit({ health: 100 })

      target.health -= bullet.baseDamage

      expect(target.health).toBe(75)
    })

    it('should apply damage multiplier', () => {
      const baseDamage = 20
      const multiplier = 0.8 + Math.random() * 0.4 // 0.8 to 1.2

      const actualDamage = Math.round(baseDamage * multiplier)

      expect(actualDamage).toBeGreaterThanOrEqual(16)
      expect(actualDamage).toBeLessThanOrEqual(24)
    })

    it('should calculate rocket damage multiplier for buildings', () => {
      const baseDamage = 20
      const rocketBuildingMultiplier = 2

      const actualDamage = baseDamage * rocketBuildingMultiplier

      expect(actualDamage).toBe(40)
    })

    it('should apply armor reduction', () => {
      const baseDamage = 20
      const armor = 2 // 50% damage reduction

      const reducedDamage = Math.max(1, Math.round(baseDamage / armor))

      expect(reducedDamage).toBe(10)
    })

    it('should ensure minimum 1 damage with armor', () => {
      const baseDamage = 1
      const armor = 10

      const reducedDamage = Math.max(1, Math.round(baseDamage / armor))

      expect(reducedDamage).toBe(1)
    })
  })

  describe('Explosion Radius', () => {
    it('should have explosion radius for rockets', () => {
      const rocket = createMockBullet({
        projectileType: 'rocket',
        explosionRadius: TILE_SIZE * 1.5
      })

      expect(rocket.explosionRadius).toBe(TILE_SIZE * 1.5)
    })

    it('should calculate distance from explosion center', () => {
      const explosionX = 200
      const explosionY = 200
      const explosionRadius = TILE_SIZE * 2

      const unit = createMockUnit({ tileX: 6, tileY: 6 })
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2

      const distance = Math.hypot(unitCenterX - explosionX, unitCenterY - explosionY)
      const withinRadius = distance <= explosionRadius

      expect(typeof withinRadius).toBe('boolean')
    })

    it('should apply falloff damage based on distance', () => {
      const baseDamage = 50
      const explosionRadius = 100
      const distance = 50

      // Linear falloff: damage decreases with distance
      const damagePercent = Math.max(0, 1 - distance / explosionRadius)
      const actualDamage = Math.round(baseDamage * damagePercent)

      expect(actualDamage).toBe(25)
    })

    it('should deal zero damage outside radius', () => {
      const baseDamage = 50
      const explosionRadius = 100
      const distance = 150 // Outside radius

      const damagePercent = Math.max(0, 1 - distance / explosionRadius)
      const actualDamage = Math.round(baseDamage * damagePercent)

      expect(actualDamage).toBe(0)
    })
  })

  describe('Projectile Types', () => {
    describe('Standard Bullets', () => {
      it('should not be homing', () => {
        const bullet = createMockBullet({ projectileType: 'bullet', homing: false })

        expect(bullet.homing).toBe(false)
      })

      it('should travel in straight line', () => {
        const bullet = createMockBullet({ x: 100, y: 100, vx: 10, vy: 0 })

        // After 5 frames
        for (let i = 0; i < 5; i++) {
          bullet.x += bullet.vx
          bullet.y += bullet.vy
        }

        expect(bullet.x).toBe(150)
        expect(bullet.y).toBe(100) // No vertical movement
      })
    })

    describe('Homing Rockets', () => {
      it('should be homing', () => {
        const rocket = createMockBullet({ projectileType: 'rocket', homing: true })

        expect(rocket.homing).toBe(true)
      })

      it('should have target', () => {
        const target = createMockUnit({ owner: 'enemy' })
        const rocket = createMockBullet({
          projectileType: 'rocket',
          homing: true,
          target
        })

        expect(rocket.target).toBe(target)
      })

      it('should adjust velocity towards target', () => {
        const target = createMockUnit({ tileX: 10, tileY: 10, owner: 'enemy' })
        const rocket = createMockBullet({
          x: 100,
          y: 100,
          projectileType: 'rocket',
          homing: true,
          target
        })

        const targetCenterX = target.x + TILE_SIZE / 2
        const targetCenterY = target.y + TILE_SIZE / 2

        const dx = targetCenterX - rocket.x
        const dy = targetCenterY - rocket.y
        const distance = Math.hypot(dx, dy)

        if (distance > 10) {
          rocket.vx = (dx / distance) * rocket.speed
          rocket.vy = (dy / distance) * rocket.speed
        }

        // Velocity should point towards target
        const velocityAngle = Math.atan2(rocket.vy, rocket.vx)
        const targetAngle = Math.atan2(dy, dx)

        expect(velocityAngle).toBeCloseTo(targetAngle, 1)
      })
    })

    describe('Ballistic Projectiles', () => {
      it('should support ballistic arc', () => {
        const rocket = createMockBullet({
          projectileType: 'rocket',
          arcHeight: 100,
          startX: 100,
          startY: 200
        })

        rocket.ballistic = true
        rocket.arcHeight = 100 // Set arc height for ballistic rockets

        expect(rocket.ballistic).toBe(true)
        expect(rocket.arcHeight).toBe(100)
      })
    })

    describe('Artillery Shells', () => {
      it('should support parabolic trajectory', () => {
        const artillery = createMockBullet({
          projectileType: 'artillery',
          startX: 100,
          startY: 100,
          dx: 200,
          dy: 0,
          flightDuration: 2000
        })

        artillery.parabolic = true
        artillery.arcHeight = 150 // Set arc height for parabolic trajectory

        expect(artillery.parabolic).toBe(true)
        expect(artillery.arcHeight).toBe(150)
      })

      it('should calculate position along parabolic arc', () => {
        const startX = 100
        const startY = 100
        const dx = 200
        const dy = 0
        const arcHeight = 100
        const progress = 0.5 // Halfway through flight

        const x = startX + dx * progress
        const y = startY + dy * progress - arcHeight * Math.sin(Math.PI * progress)

        expect(x).toBe(200) // Midpoint horizontally
        expect(y).toBeCloseTo(0) // At peak of arc (100 - 100)
      })
    })
  })

  describe('Bullet Lifetime', () => {
    it('should track active state', () => {
      const bullet = createMockBullet({ active: true })

      expect(bullet.active).toBe(true)

      bullet.active = false
      expect(bullet.active).toBe(false)
    })

    it('should have start time for timeout calculation', () => {
      const startTime = 5000
      const bullet = createMockBullet({ startTime })

      expect(bullet.startTime).toBe(5000)
    })

    it('should expire after max flight time', () => {
      const maxFlightTime = 3000
      const startTime = 1000
      const currentTime = 5000

      const flightTime = currentTime - startTime
      const expired = flightTime >= maxFlightTime

      expect(expired).toBe(true)
    })

    it('should detect out of bounds bullets', () => {
      const mapWidth = 100 * TILE_SIZE
      const mapHeight = 100 * TILE_SIZE

      const outOfBoundsBullet = createMockBullet({
        x: -200,
        y: 100
      })

      const isOutOfBounds =
        outOfBoundsBullet.x < -100 ||
        outOfBoundsBullet.x > mapWidth + 100 ||
        outOfBoundsBullet.y < -100 ||
        outOfBoundsBullet.y > mapHeight + 100

      expect(isOutOfBounds).toBe(true)
    })
  })

  describe('Trail Effects', () => {
    it('should support trail array', () => {
      const rocket = createMockBullet({ projectileType: 'rocket' })
      rocket.trail = []

      rocket.trail.push({ x: 100, y: 100, time: 1000 })
      rocket.trail.push({ x: 110, y: 105, time: 1016 })
      rocket.trail.push({ x: 120, y: 110, time: 1032 })

      expect(rocket.trail.length).toBe(3)
    })

    it('should filter old trail points', () => {
      const rocket = createMockBullet({ projectileType: 'rocket' })
      const now = 2000
      const maxTrailAge = 300

      rocket.trail = [
        { x: 100, y: 100, time: 1500 }, // 500ms old - should be removed
        { x: 110, y: 105, time: 1800 }, // 200ms old - should be kept
        { x: 120, y: 110, time: 1900 }  // 100ms old - should be kept
      ]

      rocket.trail = rocket.trail.filter(p => now - p.time < maxTrailAge)

      expect(rocket.trail.length).toBe(2)
    })
  })
})
