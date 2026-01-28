/**
 * Integration tests for building placement near Construction Yard
 * 
 * Tests the building placement validation logic to ensure:
 * 1. Buildings can be placed within MAX_BUILDING_GAP_TILES of existing buildings
 * 2. Buildings cannot be placed beyond the allowed distance
 * 
 * The game uses Chebyshev distance (chess king distance) for proximity checks.
 * MAX_BUILDING_GAP_TILES is currently 3.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  TestGameContext, 
  getMaxBuildingGap, 
  getBuildingData,
  chebyshevDistance 
} from '../testUtils.js'

describe('Building Placement Near Construction Yard', () => {
  let ctx
  const MAX_GAP = getMaxBuildingGap() // Should be 3
  
  beforeEach(() => {
    // Create a fresh test context for each test
    ctx = new TestGameContext({ mapWidth: 50, mapHeight: 50 })
    
    // Place construction yard at position (20, 20) - center of map for testing
    // Construction yard is 3x3, so it occupies tiles 20-22 on x and y
    ctx.addFactory(20, 20, 'player')
  })
  
  afterEach(() => {
    ctx.cleanup()
  })
  
  describe('Maximum Building Gap Configuration', () => {
    it('should have MAX_BUILDING_GAP_TILES set to 3', () => {
      expect(MAX_GAP).toBe(3)
    })
    
    it('should have power plant as a valid building type', () => {
      const powerPlantData = getBuildingData('powerPlant')
      expect(powerPlantData).toBeDefined()
      expect(powerPlantData.width).toBe(3)
      expect(powerPlantData.height).toBe(3)
    })
    
    it('should have construction yard as a valid building type', () => {
      const cyData = getBuildingData('constructionYard')
      expect(cyData).toBeDefined()
      expect(cyData.width).toBe(3)
      expect(cyData.height).toBe(3)
    })
  })
  
  describe('Variation 1: 1 tile free space around (immediately adjacent)', () => {
    // Construction yard is at (20,20) to (22,22)
    // 1 tile gap means power plant at position that has 1 tile between CY and PP
    
    it('should allow power plant placement 1 tile to the right of construction yard', async () => {
      // CY occupies x: 20-22, so x=23 is 1 tile gap from CY edge (x=22)
      // Power plant at x=24 would have 1 tile gap (tile 23 is free)
      const canPlace = ctx.canPlaceBuilding('powerPlant', 24, 20, 'player')
      expect(canPlace).toBe(true)
      
      // Run a few ticks to ensure game loop would work
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 1 tile below construction yard', async () => {
      // CY occupies y: 20-22, so y=23 is 1 tile gap from CY edge (y=22)
      // Power plant at y=24 would have 1 tile gap (tile 23 is free)
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 24, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 1 tile diagonally from construction yard', async () => {
      // Diagonal placement with 1 tile gap
      // CY corner is at (22,22), power plant at (24,24) leaves 1 tile diagonal gap
      const canPlace = ctx.canPlaceBuilding('powerPlant', 24, 24, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 1 tile to the left of construction yard', async () => {
      // CY starts at x=20, power plant is 3 wide, so at x=16 it ends at x=18
      // Gap at tile 19, then CY at 20
      const canPlace = ctx.canPlaceBuilding('powerPlant', 16, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 1 tile above construction yard', async () => {
      // CY starts at y=20, power plant is 3 tall, so at y=16 it ends at y=18
      // Gap at tile 19, then CY at 20
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 16, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
  })
  
  describe('Variation 2: 2 tiles free space around', () => {
    it('should allow power plant placement 2 tiles to the right of construction yard', async () => {
      // CY edge at x=22, 2 tile gap means power plant at x=25
      const canPlace = ctx.canPlaceBuilding('powerPlant', 25, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 2 tiles below construction yard', async () => {
      // CY edge at y=22, 2 tile gap means power plant at y=25
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 25, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 2 tiles diagonally from construction yard', async () => {
      // CY corner is at (22,22), power plant at (25,25) leaves 2 tile diagonal gap
      const canPlace = ctx.canPlaceBuilding('powerPlant', 25, 25, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 2 tiles to the left of construction yard', async () => {
      // CY starts at x=20, power plant at x=15 ends at x=17
      // 2 tile gap at 18 and 19
      const canPlace = ctx.canPlaceBuilding('powerPlant', 15, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement 2 tiles above construction yard', async () => {
      // CY starts at y=20, power plant at y=15 ends at y=17
      // 2 tile gap at 18 and 19
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 15, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
  })
  
  describe('Variation 3: 0 tiles free space (directly adjacent)', () => {
    it('should allow power plant placement directly adjacent to the right of construction yard', async () => {
      // CY edge at x=22, power plant at x=23 is directly adjacent
      const canPlace = ctx.canPlaceBuilding('powerPlant', 23, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement directly adjacent below construction yard', async () => {
      // CY edge at y=22, power plant at y=23 is directly adjacent
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 23, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement directly adjacent diagonally to construction yard', async () => {
      // CY corner at (22,22), power plant at (23,23) is directly diagonal
      const canPlace = ctx.canPlaceBuilding('powerPlant', 23, 23, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement directly adjacent to the left of construction yard', async () => {
      // CY starts at x=20, power plant at x=17 ends at x=19, adjacent to CY
      const canPlace = ctx.canPlaceBuilding('powerPlant', 17, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant placement directly adjacent above construction yard', async () => {
      // CY starts at y=20, power plant at y=17 ends at y=19, adjacent to CY
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 17, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
  })
  
  describe('Negative tests: Too far from construction yard', () => {
    it('should NOT allow power plant placement 4 tiles away to the right (beyond MAX_GAP)', async () => {
      // MAX_GAP is 3, so 4 tiles away should fail
      // CY edge at x=22, 4 tile gap means power plant at x=27
      // The closest tile of power plant (x=27) is distance 4 from CY edge (x=22+1=23..26..27 = 4 tiles)
      // Actually let's calculate: CY rightmost is x=22
      // Power plant at x=27 has leftmost at x=27
      // Distance = 27 - 22 = 5 tiles (too far)
      const canPlace = ctx.canPlaceBuilding('powerPlant', 27, 20, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant placement 4 tiles away below (beyond MAX_GAP)', async () => {
      // CY bottom edge at y=22, power plant at y=27
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 27, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant placement 4 tiles away diagonally (beyond MAX_GAP)', async () => {
      // Testing with significantly far distance
      const canPlace = ctx.canPlaceBuilding('powerPlant', 27, 27, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant placement far to the left (beyond MAX_GAP)', async () => {
      // CY starts at x=20, power plant at x=13 ends at x=15
      // Gap between 15 and 20 is 4 tiles (16,17,18,19) - too far
      const canPlace = ctx.canPlaceBuilding('powerPlant', 13, 20, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant placement far above (beyond MAX_GAP)', async () => {
      // CY starts at y=20, power plant at y=13 ends at y=15
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 13, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant placement far from construction yard in corner of map', async () => {
      // Place at far corner - definitely too far
      const canPlace = ctx.canPlaceBuilding('powerPlant', 5, 5, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
  })
  
  describe('Edge case: Maximum allowed distance (exactly 3 tiles)', () => {
    it('should allow power plant at exactly MAX_GAP tiles distance to the right', async () => {
      // CY edge at x=22, MAX_GAP=3 means power plant at x=26 is at the edge
      // Power plant leftmost at x=26, CY rightmost at x=22, distance = 26-22 = 4
      // Wait, that's 4 tiles distance. Let's reconsider.
      // The game uses Chebyshev distance from any tile of the new building to any tile of existing
      // Power plant at x=26 occupies 26,27,28. CY occupies 20,21,22.
      // Distance from (26,20) to (22,20) = 4, which exceeds MAX_GAP=3
      // So x=26 should fail. x=25 should work (distance 3)
      const canPlace = ctx.canPlaceBuilding('powerPlant', 25, 20, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant at MAX_GAP+1 tiles distance to the right', async () => {
      // x=26 gives distance of 4 from CY edge
      const canPlace = ctx.canPlaceBuilding('powerPlant', 26, 20, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
    
    it('should allow power plant at exactly MAX_GAP tiles distance below', async () => {
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 25, 'player')
      expect(canPlace).toBe(true)
      
      await ctx.runTicks(10)
    })
    
    it('should NOT allow power plant at MAX_GAP+1 tiles distance below', async () => {
      const canPlace = ctx.canPlaceBuilding('powerPlant', 20, 26, 'player')
      expect(canPlace).toBe(false)
      
      await ctx.runTicks(10)
    })
  })
  
  describe('Integration: Game loop runs with building placement', () => {
    it('should successfully run game loop for 60 ticks (1 second at 60fps)', async () => {
      let ticksExecuted = 0
      
      await ctx.runTicks(60, 16.67, (tick) => {
        ticksExecuted = tick
      })
      
      expect(ticksExecuted).toBe(60)
    })
    
    it('should successfully run game loop for 300 ticks (5 seconds at 60fps)', async () => {
      // Place a power plant first
      ctx.addBuilding('powerPlant', 23, 20, 'player')
      
      let ticksExecuted = 0
      
      await ctx.runTicks(300, 16.67, (tick) => {
        ticksExecuted = tick
      })
      
      expect(ticksExecuted).toBe(300)
      expect(ctx.buildings.length).toBe(2) // Factory + power plant
    })
    
    it('should maintain correct game state after running ticks', async () => {
      // Add a power plant
      const powerPlant = ctx.addBuilding('powerPlant', 23, 20, 'player')
      
      await ctx.runTicks(100)
      
      // Verify buildings are still present
      expect(ctx.buildings).toContain(powerPlant)
      expect(ctx.factories.length).toBe(1)
      expect(ctx.buildings.length).toBe(2)
    })
  })
})
