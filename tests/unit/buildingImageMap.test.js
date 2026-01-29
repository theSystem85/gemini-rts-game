import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import test utilities
import '../setup.js'

// Import functions to test
import {
  buildingImageMap,
  getBuildingImage,
  preloadBuildingImages,
  clearBuildingImageCache,
  getBuildingImageCacheStats
} from '../../src/buildingImageMap.js'

describe('buildingImageMap.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBuildingImageCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearBuildingImageCache()
  })

  describe('buildingImageMap structure', () => {
    it('should have image map defined', () => {
      expect(buildingImageMap).toBeDefined()
      expect(typeof buildingImageMap).toBe('object')
    })

    it('should have valid building types', () => {
      const expectedTypes = [
        'powerPlant',
        'oreRefinery',
        'vehicleFactory',
        'vehicleWorkshop',
        'radarStation',
        'hospital',
        'helipad',
        'gasStation',
        'constructionYard'
      ]

      expectedTypes.forEach(type => {
        expect(buildingImageMap).toHaveProperty(type)
      })
    })

    it('should have valid image paths', () => {
      Object.entries(buildingImageMap).forEach(([_type, path]) => {
        expect(typeof path).toBe('string')
        expect(path.length).toBeGreaterThan(0)
        expect(path).toMatch(/^images\//)
        expect(path).toMatch(/\.(webp|png|jpg)$/)
      })
    })

    it('should have turret types', () => {
      const turretTypes = [
        'turretGunV1',
        'turretGunV2',
        'turretGunV3',
        'rocketTurret',
        'teslaCoil',
        'artilleryTurret'
      ]

      turretTypes.forEach(type => {
        expect(buildingImageMap).toHaveProperty(type)
      })
    })

    it('should have wall types', () => {
      const wallTypes = [
        'concreteWallCross',
        'concreteWallHorizontal',
        'concreteWallVertical',
        'concreteWall'
      ]

      wallTypes.forEach(type => {
        expect(buildingImageMap).toHaveProperty(type)
      })
    })

    it('should have ammunition factory', () => {
      expect(buildingImageMap).toHaveProperty('ammunitionFactory')
      expect(buildingImageMap.ammunitionFactory).toContain('ammunition_factory')
    })
  })

  describe('getBuildingImage', () => {
    it('should return null for unknown building type', () => {
      const result = getBuildingImage('unknownBuilding')

      expect(result).toBeNull()
    })

    it('should call callback with null for unknown building type', () => {
      const callback = vi.fn()

      getBuildingImage('unknownBuilding', callback)

      expect(callback).toHaveBeenCalledWith(null)
    })

    it('should load image for valid building type', async() => {
      const callback = vi.fn()

      const result = getBuildingImage('powerPlant', callback)

      expect(result).toBeNull() // Async loading returns null initially

      // Wait for async image load to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(callback).toHaveBeenCalled()
    })

    it('should cache loaded images', async() => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      // First load
      getBuildingImage('powerPlant', callback1)

      // Wait for image to load (simulated in MockImage)
      await new Promise(resolve => setTimeout(resolve, 10))

      // Second load should use cache
      const result = getBuildingImage('powerPlant', callback2)

      expect(result).not.toBeNull()
      expect(callback2).toHaveBeenCalled()
    }, 1000)

    it('should return cached image immediately on subsequent calls', async() => {
      const callback = vi.fn()

      getBuildingImage('powerPlant', callback)

      await new Promise(resolve => setTimeout(resolve, 10))

      const result = getBuildingImage('powerPlant')

      expect(result).toBeTruthy()
    }, 1000)

    it('should handle image load errors', async() => {
      const callback = vi.fn()
      const originalImage = globalThis.Image

      // Mock Image to simulate error
      globalThis.Image = class MockImageWithError {
        constructor() {
          this.onerror = null
          setTimeout(() => {
            if (this.onerror) this.onerror()
          }, 0)
        }
        set src(value) {}
      }

      getBuildingImage('powerPlant', callback)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(callback).toHaveBeenCalledWith(null)
      globalThis.Image = originalImage
    }, 1000)

    it('should set correct image src path', async() => {
      const callback = vi.fn()

      getBuildingImage('oreRefinery', callback)

      await new Promise(resolve => setTimeout(resolve, 10))

      const args = callback.mock.calls[0]
      expect(args[0]).toBeTruthy()
    }, 1000)
  })

  describe('preloadBuildingImages', () => {
    it('should preload all building images', async() => {
      const callback = vi.fn()

      preloadBuildingImages(callback)

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(callback).toHaveBeenCalled()

      const stats = getBuildingImageCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.preloaded).toBe(true)
    }, 2000)

    it('should not reload if already preloaded', async() => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      preloadBuildingImages(callback1)

      await new Promise(resolve => setTimeout(resolve, 50))

      const statsBeforeSecondCall = getBuildingImageCacheStats()
      const cachedCountBefore = statsBeforeSecondCall.size

      preloadBuildingImages(callback2)

      await new Promise(resolve => setTimeout(resolve, 10))

      const statsAfterSecondCall = getBuildingImageCacheStats()
      const cachedCountAfter = statsAfterSecondCall.size

      // Both callbacks should be called
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()

      // But cache size shouldn't change (no reloading occurred)
      expect(cachedCountAfter).toBe(cachedCountBefore)
    }, 2000)

    it('should not reload if currently loading', async() => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      preloadBuildingImages(callback1)
      preloadBuildingImages(callback2)

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(callback1).toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    }, 2000)

    it('should call callback when already preloaded', async() => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      preloadBuildingImages(callback1)

      await new Promise(resolve => setTimeout(resolve, 50))

      preloadBuildingImages(callback2)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    }, 2000)

    it('should preload correct number of images', async() => {
      const callback = vi.fn()
      const expectedCount = Object.keys(buildingImageMap).length

      preloadBuildingImages(callback)

      await new Promise(resolve => setTimeout(resolve, 100))

      const stats = getBuildingImageCacheStats()
      expect(stats.size).toBe(expectedCount)
    }, 2000)
  })

  describe('clearBuildingImageCache', () => {
    it('should clear all cached images', async() => {
      const callback = vi.fn()

      getBuildingImage('powerPlant', callback)

      await new Promise(resolve => setTimeout(resolve, 10))

      let stats = getBuildingImageCacheStats()
      expect(stats.size).toBeGreaterThan(0)

      clearBuildingImageCache()

      stats = getBuildingImageCacheStats()
      expect(stats.size).toBe(0)
      expect(stats.preloaded).toBe(false)
    }, 1000)

    it('should reset preloaded flag', async() => {
      preloadBuildingImages()

      await new Promise(resolve => setTimeout(resolve, 50))

      clearBuildingImageCache()

      const stats = getBuildingImageCacheStats()
      expect(stats.preloaded).toBe(false)
    }, 2000)

    it('should allow reloading after clear', async() => {
      const callback = vi.fn()

      getBuildingImage('powerPlant', callback)

      await new Promise(resolve => setTimeout(resolve, 10))

      clearBuildingImageCache()

      const result = getBuildingImage('powerPlant')
      expect(result).toBeNull()
    }, 1000)
  })

  describe('getBuildingImageCacheStats', () => {
    it('should return stats object', () => {
      const stats = getBuildingImageCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('keys')
      expect(stats).toHaveProperty('preloaded')
    })

    it('should return zero size for empty cache', () => {
      clearBuildingImageCache()

      const stats = getBuildingImageCacheStats()

      expect(stats.size).toBe(0)
      expect(stats.keys.length).toBe(0)
      expect(stats.preloaded).toBe(false)
    })

    it('should return correct size after loading images', async() => {
      const callback = vi.fn()

      getBuildingImage('powerPlant', callback)
      getBuildingImage('oreRefinery', callback)

      await new Promise(resolve => setTimeout(resolve, 20))

      const stats = getBuildingImageCacheStats()

      expect(stats.size).toBeGreaterThanOrEqual(2)
      expect(stats.keys).toContain('powerPlant')
      expect(stats.keys).toContain('oreRefinery')
    }, 1000)

    it('should return all cached keys', async() => {
      const callback = vi.fn()
      const typesToLoad = ['powerPlant', 'oreRefinery', 'vehicleFactory']

      typesToLoad.forEach(type => {
        getBuildingImage(type, callback)
      })

      await new Promise(resolve => setTimeout(resolve, 30))

      const stats = getBuildingImageCacheStats()

      typesToLoad.forEach(type => {
        expect(stats.keys).toContain(type)
      })
    }, 1000)

    it('should reflect preloaded status', async() => {
      preloadBuildingImages()

      await new Promise(resolve => setTimeout(resolve, 100))

      const stats = getBuildingImageCacheStats()

      expect(stats.preloaded).toBe(true)
    }, 2000)
  })

  describe('image path correctness', () => {
    it('should have webp format for most buildings', () => {
      const webpBuildings = [
        'powerPlant',
        'oreRefinery',
        'vehicleFactory',
        'helipad'
      ]

      webpBuildings.forEach(type => {
        expect(buildingImageMap[type]).toMatch(/\.webp$/)
      })
    })

    it('should have correct subdirectory structure', () => {
      Object.values(buildingImageMap).forEach(path => {
        expect(path).toMatch(/^images\/map\/buildings\//)
      })
    })

    it('should have descriptive filenames', () => {
      Object.entries(buildingImageMap).forEach(([_type, path]) => {
        const filename = path.split('/').pop()
        expect(filename.length).toBeGreaterThan(4) // More than just extension
      })
    })
  })

  describe('concurrent loading', () => {
    it('should handle multiple simultaneous loads', async() => {
      const callback = vi.fn()
      const types = ['powerPlant', 'oreRefinery', 'vehicleFactory', 'hospital']

      types.forEach(type => {
        getBuildingImage(type, callback)
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(callback).toHaveBeenCalledTimes(types.length)

      const stats = getBuildingImageCacheStats()
      expect(stats.size).toBe(types.length)
    }, 2000)

    it('should handle duplicate load requests', async() => {
      const callback = vi.fn()

      getBuildingImage('powerPlant', callback)
      getBuildingImage('powerPlant', callback)
      getBuildingImage('powerPlant', callback)

      await new Promise(resolve => setTimeout(resolve, 20))

      const stats = getBuildingImageCacheStats()
      expect(stats.size).toBe(1)
    }, 1000)
  })

  describe('special building types', () => {
    it('should handle wall variations', () => {
      expect(buildingImageMap.concreteWall).toBe(buildingImageMap.concreteWallCross)
      expect(buildingImageMap.concreteWallHorizontal).toBeDefined()
      expect(buildingImageMap.concreteWallVertical).toBeDefined()
    })

    it('should have all turret variants', () => {
      expect(buildingImageMap.turretGunV1).toContain('turret01')
      expect(buildingImageMap.turretGunV2).toContain('turret02')
      expect(buildingImageMap.turretGunV3).toContain('turret03')
    })

    it('should have special turret types', () => {
      expect(buildingImageMap.rocketTurret).toBeDefined()
      expect(buildingImageMap.teslaCoil).toBeDefined()
      expect(buildingImageMap.artilleryTurret).toBeDefined()
    })
  })
})
