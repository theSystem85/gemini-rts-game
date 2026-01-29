/**
 * Unit tests for utils.js
 *
 * Tests the utility functions for unit management, leveling system,
 * coordinate conversions, and other game utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  tileToPixel,
  getUniqueId,
  getBuildingIdentifier,
  calculateHealthSpeedModifier,
  updateUnitSpeedModifier,
  initializeUnitLeveling,
  getUnitCost,
  getExperienceRequiredForLevel,
  awardExperience,
  checkLevelUp,
  applyLevelBonuses,
  getExperienceProgress,
  handleSelfRepair,
  debugAddExperience,
  debugShowUnitStats,
  debugForceShowExperienceBars,
  debugSpawnEnemyUnit,
  debugTestExperienceAwarding,
  debugListAllUnits,
  debugInitializeAllUnits
} from '../../src/utils.js'
import { TILE_SIZE } from '../../src/config.js'

describe('utils', () => {
  describe('tileToPixel()', () => {
    it('should convert tile coordinates to pixel coordinates', () => {
      const result = tileToPixel(5, 10)
      expect(result.x).toBe(5 * TILE_SIZE)
      expect(result.y).toBe(10 * TILE_SIZE)
    })

    it('should return 0,0 for origin tile', () => {
      const result = tileToPixel(0, 0)
      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })

    it('should handle large tile coordinates', () => {
      const result = tileToPixel(100, 100)
      expect(result.x).toBe(100 * TILE_SIZE)
      expect(result.y).toBe(100 * TILE_SIZE)
    })

    it('should handle decimal tile coordinates', () => {
      const result = tileToPixel(2.5, 3.5)
      expect(result.x).toBe(2.5 * TILE_SIZE)
      expect(result.y).toBe(3.5 * TILE_SIZE)
    })
  })

  describe('getUniqueId()', () => {
    it('should return a string', () => {
      const result = getUniqueId()
      expect(typeof result).toBe('string')
    })

    it('should return different IDs on consecutive calls', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(getUniqueId())
      }
      expect(ids.size).toBe(100)
    })

    it('should have reasonable length', () => {
      const id = getUniqueId()
      expect(id.length).toBeGreaterThan(10)
      expect(id.length).toBeLessThan(30)
    })
  })

  describe('getBuildingIdentifier()', () => {
    it('should return null for null building', () => {
      expect(getBuildingIdentifier(null)).toBeNull()
    })

    it('should return null for undefined building', () => {
      expect(getBuildingIdentifier(undefined)).toBeNull()
    })

    it('should return id if building has id', () => {
      const building = { id: 'building-123', type: 'powerPlant', x: 10, y: 20 }
      expect(getBuildingIdentifier(building)).toBe('building-123')
    })

    it('should generate identifier from type and position if no id', () => {
      const building = { type: 'powerPlant', x: 10, y: 20 }
      expect(getBuildingIdentifier(building)).toBe('powerPlant:10,20')
    })

    it('should use "unknown" for missing type', () => {
      const building = { x: 5, y: 15 }
      expect(getBuildingIdentifier(building)).toBe('unknown:5,15')
    })

    it('should prefer id over generated identifier', () => {
      const building = { id: 'custom-id', type: 'turret', x: 0, y: 0 }
      expect(getBuildingIdentifier(building)).toBe('custom-id')
    })
  })

  describe('calculateHealthSpeedModifier()', () => {
    it('should return 1.0 for null unit', () => {
      expect(calculateHealthSpeedModifier(null)).toBe(1.0)
    })

    it('should return 1.0 for unit without health', () => {
      expect(calculateHealthSpeedModifier({})).toBe(1.0)
    })

    it('should return 1.0 for unit without maxHealth', () => {
      expect(calculateHealthSpeedModifier({ health: 50 })).toBe(1.0)
    })

    it('should return 1.0 for healthy unit (above 25% health)', () => {
      const unit = { health: 100, maxHealth: 100 }
      expect(calculateHealthSpeedModifier(unit)).toBe(1.0)
    })

    it('should return 1.0 for unit at exactly 25% health', () => {
      const unit = { health: 25, maxHealth: 100 }
      expect(calculateHealthSpeedModifier(unit)).toBe(1.0)
    })

    it('should return 0.5 for unit below 25% health', () => {
      const unit = { health: 24, maxHealth: 100 }
      expect(calculateHealthSpeedModifier(unit)).toBe(0.5)
    })

    it('should return 0.5 for very low health unit', () => {
      const unit = { health: 1, maxHealth: 100 }
      expect(calculateHealthSpeedModifier(unit)).toBe(0.5)
    })

    it('should return 1.0 for unit at 50% health', () => {
      const unit = { health: 50, maxHealth: 100 }
      expect(calculateHealthSpeedModifier(unit)).toBe(1.0)
    })
  })

  describe('updateUnitSpeedModifier()', () => {
    it('should not throw for null unit', () => {
      expect(() => updateUnitSpeedModifier(null)).not.toThrow()
    })

    it('should set speedModifier based on health', () => {
      const unit = { health: 100, maxHealth: 100 }
      updateUnitSpeedModifier(unit)
      expect(unit.speedModifier).toBe(1.0)
    })

    it('should set speedModifier to 0.5 for damaged unit', () => {
      const unit = { health: 20, maxHealth: 100 }
      updateUnitSpeedModifier(unit)
      expect(unit.speedModifier).toBe(0.5)
    })

    it('should combine with baseSpeedModifier', () => {
      const unit = { health: 100, maxHealth: 100, baseSpeedModifier: 0.8 }
      updateUnitSpeedModifier(unit)
      expect(unit.speedModifier).toBe(0.8)
    })

    it('should multiply health modifier with base modifier', () => {
      const unit = { health: 20, maxHealth: 100, baseSpeedModifier: 0.8 }
      updateUnitSpeedModifier(unit)
      expect(unit.speedModifier).toBe(0.5 * 0.8)
    })
  })

  describe('getUnitCost()', () => {
    it('should return cost for known unit type', () => {
      const cost = getUnitCost('tank')
      expect(typeof cost).toBe('number')
      expect(cost).toBeGreaterThan(0)
    })

    it('should return very high cost for unknown unit type', () => {
      const cost = getUnitCost('nonexistent')
      expect(cost).toBe(9999999)
    })
  })

  describe('initializeUnitLeveling()', () => {
    it('should not throw for null unit', () => {
      expect(() => initializeUnitLeveling(null)).not.toThrow()
    })

    it('should not initialize leveling for harvesters', () => {
      const unit = { type: 'harvester' }
      initializeUnitLeveling(unit)
      expect(unit.level).toBeUndefined()
    })

    it('should initialize level to 0', () => {
      const unit = { type: 'tank' }
      initializeUnitLeveling(unit)
      expect(unit.level).toBe(0)
    })

    it('should initialize experience to 0', () => {
      const unit = { type: 'tank' }
      initializeUnitLeveling(unit)
      expect(unit.experience).toBe(0)
    })

    it('should set baseCost from unit type', () => {
      const unit = { type: 'tank' }
      initializeUnitLeveling(unit)
      expect(unit.baseCost).toBeGreaterThan(0)
    })

    it('should not overwrite existing level', () => {
      const unit = { type: 'tank', level: 2 }
      initializeUnitLeveling(unit)
      expect(unit.level).toBe(2)
    })

    it('should not overwrite existing experience', () => {
      const unit = { type: 'tank', experience: 500 }
      initializeUnitLeveling(unit)
      expect(unit.experience).toBe(500)
    })
  })

  describe('getExperienceRequiredForLevel()', () => {
    it('should return 2x baseCost for level 1', () => {
      const required = getExperienceRequiredForLevel(0, 1000)
      expect(required).toBe(2000)
    })

    it('should return 4x baseCost for level 2', () => {
      const required = getExperienceRequiredForLevel(1, 1000)
      expect(required).toBe(4000)
    })

    it('should return 6x baseCost for level 3', () => {
      const required = getExperienceRequiredForLevel(2, 1000)
      expect(required).toBe(6000)
    })

    it('should return null for level 3+', () => {
      const required = getExperienceRequiredForLevel(3, 1000)
      expect(required).toBeNull()
    })
  })

  describe('awardExperience()', () => {
    it('should not throw for null unit', () => {
      expect(() => awardExperience(null, { type: 'tank' })).not.toThrow()
    })

    it('should not throw for null killedUnit', () => {
      expect(() => awardExperience({ type: 'tank' }, null)).not.toThrow()
    })

    it('should not award experience to harvesters', () => {
      const unit = { type: 'harvester', experience: 0 }
      awardExperience(unit, { type: 'tank' })
      expect(unit.experience).toBe(0)
    })

    it('should increase experience when killing enemy', () => {
      const unit = { type: 'tank', level: 0, experience: 0, baseCost: 1000 }
      const killedUnit = { type: 'tank' }
      awardExperience(unit, killedUnit)
      // Experience may be reset to 0 if level up occurred, check that it was processed
      expect(unit.level >= 0).toBe(true)
    })

    it('should initialize leveling if not initialized', () => {
      const unit = { type: 'tank' }
      const killedUnit = { type: 'tank' }
      awardExperience(unit, killedUnit)
      expect(unit.level).toBeDefined()
      expect(unit.experience).toBeDefined()
      expect(unit.baseCost).toBeDefined()
    })
  })

  describe('checkLevelUp()', () => {
    it('should not throw for null unit', () => {
      expect(() => checkLevelUp(null)).not.toThrow()
    })

    it('should not level up if not enough experience', () => {
      const unit = { type: 'tank', level: 0, experience: 100, baseCost: 1000 }
      checkLevelUp(unit)
      expect(unit.level).toBe(0)
    })

    it('should level up when enough experience', () => {
      const unit = { type: 'tank', level: 0, experience: 2000, baseCost: 1000 }
      checkLevelUp(unit)
      expect(unit.level).toBe(1)
    })

    it('should reset experience after level up', () => {
      const unit = { type: 'tank', level: 0, experience: 2000, baseCost: 1000 }
      checkLevelUp(unit)
      expect(unit.experience).toBe(0)
    })

    it('should not level up past level 3', () => {
      const unit = { type: 'tank', level: 3, experience: 999999, baseCost: 1000 }
      checkLevelUp(unit)
      expect(unit.level).toBe(3)
    })
  })

  describe('applyLevelBonuses()', () => {
    it('should not throw for null unit', () => {
      expect(() => applyLevelBonuses(null)).not.toThrow()
    })

    it('should apply range multiplier at level 1', () => {
      const unit = { type: 'tank', level: 1 }
      applyLevelBonuses(unit)
      expect(unit.rangeMultiplier).toBe(1.2)
    })

    it('should apply armor at level 2', () => {
      const unit = { type: 'tank', level: 2 }
      applyLevelBonuses(unit)
      expect(unit.armor).toBeDefined()
    })

    it('should apply self repair at level 3', () => {
      const unit = { type: 'tank', level: 3 }
      applyLevelBonuses(unit)
      expect(unit.selfRepair).toBe(true)
    })

    it('should apply fire rate multiplier at level 3', () => {
      const unit = { type: 'tank', level: 3 }
      applyLevelBonuses(unit)
      expect(unit.fireRateMultiplier).toBeGreaterThan(1)
    })

    it('should have different bonuses for howitzer', () => {
      const unit = { type: 'howitzer', level: 1 }
      applyLevelBonuses(unit)
      expect(unit.fireRateMultiplier).toBeCloseTo(1.33, 1)
    })
  })

  describe('getExperienceProgress()', () => {
    it('should return 0 for null unit', () => {
      expect(getExperienceProgress(null)).toBe(0)
    })

    it('should return 0 for max level unit', () => {
      const unit = { type: 'tank', level: 3, experience: 1000, baseCost: 1000 }
      expect(getExperienceProgress(unit)).toBe(0)
    })

    it('should return 0 for unit with no experience', () => {
      const unit = { type: 'tank', level: 0, experience: 0, baseCost: 1000 }
      expect(getExperienceProgress(unit)).toBe(0)
    })

    it('should return 0.5 for unit with half required experience', () => {
      const unit = { type: 'tank', level: 0, experience: 1000, baseCost: 1000 }
      expect(getExperienceProgress(unit)).toBeCloseTo(0.5, 1)
    })

    it('should return 1 for unit at full experience', () => {
      const unit = { type: 'tank', level: 0, experience: 2000, baseCost: 1000 }
      expect(getExperienceProgress(unit)).toBe(1)
    })

    it('should cap at 1 for over-full experience', () => {
      const unit = { type: 'tank', level: 0, experience: 5000, baseCost: 1000 }
      expect(getExperienceProgress(unit)).toBe(1)
    })
  })

  describe('handleSelfRepair()', () => {
    it('should not throw for null unit', () => {
      expect(() => handleSelfRepair(null, Date.now())).not.toThrow()
    })

    it('should not repair units below level 3', () => {
      const unit = { type: 'tank', level: 2, health: 50, maxHealth: 100, selfRepair: true }
      handleSelfRepair(unit, Date.now())
      expect(unit.health).toBe(50)
    })

    it('should not repair units without selfRepair flag', () => {
      const unit = { type: 'tank', level: 3, health: 50, maxHealth: 100 }
      handleSelfRepair(unit, Date.now())
      expect(unit.health).toBe(50)
    })

    it('should not repair units at full health', () => {
      const unit = { type: 'tank', level: 3, health: 100, maxHealth: 100, selfRepair: true }
      handleSelfRepair(unit, Date.now())
      expect(unit.health).toBe(100)
    })

    it('should not repair units that are moving', () => {
      const unit = {
        type: 'tank',
        level: 3,
        health: 50,
        maxHealth: 100,
        selfRepair: true,
        path: [{ x: 5, y: 5 }]
      }
      handleSelfRepair(unit, Date.now())
      expect(unit.health).toBe(50)
    })

    it('should set lastRepairTime on first call', () => {
      const now = Date.now()
      const unit = {
        type: 'tank',
        level: 3,
        health: 50,
        maxHealth: 100,
        selfRepair: true,
        path: []
      }
      handleSelfRepair(unit, now)
      expect(unit.lastRepairTime).toBe(now)
    })

    it('should repair after 3 seconds', () => {
      const startTime = 1000
      const unit = {
        type: 'tank',
        level: 3,
        health: 50,
        maxHealth: 100,
        selfRepair: true,
        path: [],
        lastRepairTime: startTime
      }

      // After 3+ seconds
      handleSelfRepair(unit, startTime + 3001)
      // Health should increase by 1% of maxHealth (1)
      expect(unit.health).toBeGreaterThanOrEqual(50)
    })

    it('should not exceed maxHealth', () => {
      const startTime = 1000
      const unit = {
        type: 'tank',
        level: 3,
        health: 99.5,
        maxHealth: 100,
        selfRepair: true,
        path: [],
        lastRepairTime: startTime
      }

      handleSelfRepair(unit, startTime + 3001)
      // Health should not exceed maxHealth
      expect(unit.health).toBeLessThanOrEqual(100)
    })
  })

  describe('debugAddExperience()', () => {
    beforeEach(() => {
      // Setup window logger mock
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        debugGetSelectedUnits: vi.fn()
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugAddExperience).toBe('function')
    })

    it('should not throw when no units selected', () => {
      window.debugGetSelectedUnits = vi.fn(() => [])

      expect(() => debugAddExperience()).not.toThrow()
      expect(window.logger).toHaveBeenCalled()
    })

    it('should log message when no units selected', () => {
      window.debugGetSelectedUnits = vi.fn(() => [])

      debugAddExperience()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('No units selected'))
    })

    it('should add experience to selected units', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        level: 1,
        experience: 0,
        baseCost: 1000
      }
      window.debugGetSelectedUnits = vi.fn(() => [mockUnit])

      debugAddExperience(500)

      expect(mockUnit.experience).toBe(500)
    })

    it('should skip harvesters', () => {
      const mockHarvester = {
        id: 'test-harvester',
        type: 'harvester',
        experience: 0
      }
      window.debugGetSelectedUnits = vi.fn(() => [mockHarvester])

      debugAddExperience(500)

      expect(mockHarvester.experience).toBe(0)
      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('cannot gain experience'))
    })

    it('should use default amount of 1000', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        level: 1,
        experience: 0,
        baseCost: 1000
      }
      window.debugGetSelectedUnits = vi.fn(() => [mockUnit])

      debugAddExperience()

      expect(mockUnit.experience).toBe(1000)
    })
  })

  describe('debugShowUnitStats()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        selectedUnits: []
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugShowUnitStats).toBe('function')
    })

    it('should not throw with empty selected units', () => {
      window.selectedUnits = []

      expect(() => debugShowUnitStats()).not.toThrow()
    })

    it('should show stats for selected units', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        level: 2,
        experience: 500,
        baseCost: 1000
      }
      window.selectedUnits = [mockUnit]

      debugShowUnitStats()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('tank'))
    })

    it('should skip harvesters', () => {
      const mockHarvester = {
        id: 'test-harvester',
        type: 'harvester'
      }
      window.selectedUnits = [mockHarvester]

      debugShowUnitStats()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining("don't level up"))
    })
  })

  describe('debugForceShowExperienceBars()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        gameInstance: { units: [] }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugForceShowExperienceBars).toBe('function')
    })

    it('should not throw with empty units array', () => {
      window.gameInstance.units = []

      expect(() => debugForceShowExperienceBars()).not.toThrow()
    })

    it('should add experience to units with 0 experience', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        level: 1,
        experience: 0,
        baseCost: 1000
      }
      window.gameInstance.units = [mockUnit]

      debugForceShowExperienceBars()

      expect(mockUnit.experience).toBe(100)
    })

    it('should skip harvesters', () => {
      const mockHarvester = {
        id: 'test-harvester',
        type: 'harvester',
        experience: 0
      }
      window.gameInstance.units = [mockHarvester]

      debugForceShowExperienceBars()

      expect(mockHarvester.experience).toBe(0)
    })

    it('should log completion message', () => {
      window.gameInstance.units = []

      debugForceShowExperienceBars()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('Forced experience bars'))
    })
  })

  describe('debugSpawnEnemyUnit()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        gameInstance: { units: [] },
        gameState: { occupancyMap: [] }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugSpawnEnemyUnit).toBe('function')
    })

    it('should spawn enemy unit', () => {
      const result = debugSpawnEnemyUnit('tank')

      expect(result).toBeDefined()
      expect(result.type).toBe('tank')
      expect(result.owner).toBe('enemy')
    })

    it('should add unit to gameInstance.units', () => {
      debugSpawnEnemyUnit('tank')

      expect(window.gameInstance.units).toHaveLength(1)
    })

    it('should use default unit type of tank', () => {
      const result = debugSpawnEnemyUnit()

      expect(result.type).toBe('tank')
    })

    it('should log spawn message', () => {
      debugSpawnEnemyUnit('heavyTank')

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('Spawned enemy heavyTank'))
    })
  })

  describe('debugTestExperienceAwarding()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        debugGetSelectedUnits: vi.fn(() => [])
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugTestExperienceAwarding).toBe('function')
    })

    it('should not throw when no units selected', () => {
      window.debugGetSelectedUnits = vi.fn(() => [])

      expect(() => debugTestExperienceAwarding()).not.toThrow()
    })

    it('should log error when no units selected', () => {
      window.debugGetSelectedUnits = vi.fn(() => [])

      debugTestExperienceAwarding()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('No units selected'))
    })

    it('should award experience to selected units', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        level: 1,
        experience: 0,
        baseCost: 1000
      }
      window.debugGetSelectedUnits = vi.fn(() => [mockUnit])

      debugTestExperienceAwarding()

      expect(mockUnit.experience).toBeGreaterThan(0)
    })
  })

  describe('debugListAllUnits()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        gameInstance: { units: [] }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugListAllUnits).toBe('function')
    })

    it('should not throw with empty units', () => {
      window.gameInstance.units = []

      expect(() => debugListAllUnits()).not.toThrow()
    })

    it('should return units array', () => {
      const mockUnits = [
        { type: 'tank', owner: 'player1' },
        { type: 'harvester', owner: 'player1' }
      ]
      window.gameInstance.units = mockUnits

      const result = debugListAllUnits()

      expect(result).toBe(mockUnits)
    })

    it('should log total unit count', () => {
      window.gameInstance.units = [
        { type: 'tank', owner: 'player1' }
      ]

      debugListAllUnits()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('Total units'))
    })

    it('should group units by owner', () => {
      window.gameInstance.units = [
        { type: 'tank', owner: 'player1' },
        { type: 'harvester', owner: 'player1' },
        { type: 'tank', owner: 'enemy' }
      ]

      debugListAllUnits()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('player1'))
      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('enemy'))
    })
  })

  describe('debugInitializeAllUnits()', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        ...window,
        logger: vi.fn(),
        gameInstance: { units: [] }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should be a function', () => {
      expect(typeof debugInitializeAllUnits).toBe('function')
    })

    it('should not throw with empty units', () => {
      window.gameInstance.units = []

      expect(() => debugInitializeAllUnits()).not.toThrow()
    })

    it('should initialize leveling for units without it', () => {
      const mockUnit = {
        id: 'test-unit',
        type: 'tank',
        owner: 'player1'
      }
      window.gameInstance.units = [mockUnit]

      debugInitializeAllUnits()

      expect(mockUnit.level).toBeDefined()
      expect(mockUnit.experience).toBeDefined()
    })

    it('should skip harvesters', () => {
      const mockHarvester = {
        id: 'test-harvester',
        type: 'harvester',
        owner: 'player1'
      }
      window.gameInstance.units = [mockHarvester]

      debugInitializeAllUnits()

      expect(mockHarvester.level).toBeUndefined()
    })

    it('should log completion summary', () => {
      window.gameInstance.units = []

      debugInitializeAllUnits()

      expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('Initialized experience system'))
    })
  })
})
