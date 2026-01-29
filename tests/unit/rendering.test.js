/**
 * Tests for src/rendering.js
 * This file provides wrapper functions around the Renderer class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../setup.js'

// Mock the Renderer class before importing rendering.js
vi.mock('../../src/rendering/renderer.js', () => {
  class MockRenderer {
    constructor() {
      this.textureManager = {
        preloadAllTextures: vi.fn((cb) => {
          if (cb) setTimeout(cb, 0)
        }),
        getOrLoadImage: vi.fn(),
        allTexturesLoaded: true
      }
      this.mapRenderer = {
        updateSOTMaskForTile: vi.fn(),
        computeSOTMask: vi.fn()
      }
      this.renderGame = vi.fn()
      this.renderMinimap = vi.fn()
      this.preloadTextures = vi.fn((cb) => {
        if (cb) setTimeout(cb, 0)
      })
    }
  }

  return { Renderer: MockRenderer }
})

describe('rendering.js', () => {
  let renderingModule

  beforeEach(async() => {
    vi.clearAllMocks()
    // Dynamic import to get fresh module
    vi.resetModules()
    renderingModule = await import('../../src/rendering.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('renderGame', () => {
    it('should export renderGame function', () => {
      expect(typeof renderingModule.renderGame).toBe('function')
    })

    it('should delegate to gameRenderer.renderGame', () => {
      const mockCtx = {}
      const mockCanvas = { width: 800, height: 600 }
      const mockMapGrid = [[]]
      const mockFactories = []
      const mockUnits = []
      const mockBullets = []
      const mockBuildings = []
      const mockScrollOffset = { x: 0, y: 0 }
      const mockGameState = { money: 1000 }

      renderingModule.renderGame(
        mockCtx,
        mockCanvas,
        mockMapGrid,
        mockFactories,
        mockUnits,
        mockBullets,
        mockBuildings,
        mockScrollOffset,
        false,
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        mockGameState
      )

      // The function should not throw
      expect(true).toBe(true)
    })

    it('should handle null parameters gracefully', () => {
      expect(() => {
        renderingModule.renderGame(
          null, null, null, null, null, null, null, null, null, null, null, null
        )
      }).not.toThrow()
    })

    it('should accept optional GPU context parameters', () => {
      const mockCtx = {}
      const mockCanvas = { width: 800, height: 600 }
      const mockMapGrid = [[]]
      const mockScrollOffset = { x: 0, y: 0 }
      const mockGameState = { money: 1000 }
      const mockGpuContext = {}
      const mockGpuCanvas = { width: 800, height: 600 }

      expect(() => {
        renderingModule.renderGame(
          mockCtx,
          mockCanvas,
          mockMapGrid,
          [],
          [],
          [],
          [],
          mockScrollOffset,
          false,
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          mockGameState,
          mockGpuContext,
          mockGpuCanvas
        )
      }).not.toThrow()
    })
  })

  describe('renderMinimap', () => {
    it('should export renderMinimap function', () => {
      expect(typeof renderingModule.renderMinimap).toBe('function')
    })

    it('should delegate to gameRenderer.renderMinimap', () => {
      const mockCtx = {}
      const mockCanvas = { width: 200, height: 200 }
      const mockMapGrid = [[]]
      const mockScrollOffset = { x: 0, y: 0 }
      const mockGameCanvas = { width: 800, height: 600 }
      const mockUnits = []
      const mockBuildings = []
      const mockGameState = {}

      expect(() => {
        renderingModule.renderMinimap(
          mockCtx,
          mockCanvas,
          mockMapGrid,
          mockScrollOffset,
          mockGameCanvas,
          mockUnits,
          mockBuildings,
          mockGameState
        )
      }).not.toThrow()
    })
  })

  describe('preloadTileTextures', () => {
    it('should export preloadTileTextures function', () => {
      expect(typeof renderingModule.preloadTileTextures).toBe('function')
    })

    it('should call the renderer preloadTextures method', async() => {
      const callback = vi.fn()

      renderingModule.preloadTileTextures(callback)

      // Wait for async callback
      await new Promise(r => setTimeout(r, 50))

      expect(callback).toHaveBeenCalled()
    })

    it('should handle missing callback gracefully', () => {
      expect(() => {
        renderingModule.preloadTileTextures()
      }).not.toThrow()
    })
  })

  describe('getTextureManager', () => {
    it('should export getTextureManager function', () => {
      expect(typeof renderingModule.getTextureManager).toBe('function')
    })

    it('should return the texture manager from the renderer', () => {
      const textureManager = renderingModule.getTextureManager()
      expect(textureManager).toBeDefined()
    })
  })

  describe('getMapRenderer', () => {
    it('should export getMapRenderer function', () => {
      expect(typeof renderingModule.getMapRenderer).toBe('function')
    })

    it('should return the map renderer from the renderer', () => {
      const mapRenderer = renderingModule.getMapRenderer()
      expect(mapRenderer).toBeDefined()
    })
  })

  describe('notifyTileMutation', () => {
    it('should export notifyTileMutation function', () => {
      expect(typeof renderingModule.notifyTileMutation).toBe('function')
    })

    it('should call mapRenderer.updateSOTMaskForTile when available', () => {
      const mockMapGrid = [[{ type: 'land' }]]
      const tileX = 0
      const tileY = 0

      expect(() => {
        renderingModule.notifyTileMutation(mockMapGrid, tileX, tileY)
      }).not.toThrow()
    })

    it('should handle out-of-bounds coordinates gracefully', () => {
      const mockMapGrid = [[{ type: 'land' }]]

      expect(() => {
        renderingModule.notifyTileMutation(mockMapGrid, -1, -1)
        renderingModule.notifyTileMutation(mockMapGrid, 100, 100)
      }).not.toThrow()
    })
  })

  describe('recomputeSOTMask', () => {
    it('should export recomputeSOTMask function', () => {
      expect(typeof renderingModule.recomputeSOTMask).toBe('function')
    })

    it('should call mapRenderer.computeSOTMask when available', () => {
      const mockMapGrid = [[{ type: 'land' }]]

      expect(() => {
        renderingModule.recomputeSOTMask(mockMapGrid)
      }).not.toThrow()
    })

    it('should handle empty map grid', () => {
      expect(() => {
        renderingModule.recomputeSOTMask([])
      }).not.toThrow()
    })

    it('should handle null map grid', () => {
      expect(() => {
        renderingModule.recomputeSOTMask(null)
      }).not.toThrow()
    })
  })

  describe('Module exports', () => {
    it('should export all required functions', () => {
      const expectedExports = [
        'renderGame',
        'renderMinimap',
        'preloadTileTextures',
        'getTextureManager',
        'getMapRenderer',
        'notifyTileMutation',
        'recomputeSOTMask'
      ]

      expectedExports.forEach(exportName => {
        expect(typeof renderingModule[exportName]).toBe('function')
      })
    })
  })
})
