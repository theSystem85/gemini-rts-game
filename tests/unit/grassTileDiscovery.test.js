
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverGrassTiles } from '../../src/utils/grassTileDiscovery.js'

describe('grassTileDiscovery.js', () => {
  // Mock window.logger
  const mockLogger = vi.fn()
  mockLogger.warn = vi.fn()

  // Setup window object if it doesn't exist (JSDOM/happy-dom handles this usually, but good practice here)
  beforeEach(() => {
    globalThis.window = {
      logger: mockLogger
    }

    // Spy on console.error to keep test output clean during expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Default fetch mock setup
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.window
  })

  it('discoverGrassTiles returns correct data on successful fetch', async() => {
    const mockData = {
      passablePaths: ['path/to/passable1.png'],
      decorativePaths: ['path/to/decorative1.png'],
      impassablePaths: ['path/to/impassable1.png'],
      metadata: { generatedAt: '2023-01-01' }
    }

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async() => mockData
    })

    const result = await discoverGrassTiles()

    expect(globalThis.fetch).toHaveBeenCalledWith('images/map/grass_tiles/grass_tiles.json')
    expect(result).toEqual({
      passablePaths: mockData.passablePaths,
      decorativePaths: mockData.decorativePaths,
      impassablePaths: mockData.impassablePaths
    })

    // Verify successful logging
    expect(window.logger).toHaveBeenCalledWith(expect.stringContaining('Loaded grass tiles configuration'))
  })

  it('throws error if fetch fails (response.ok is false)', async() => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    await expect(discoverGrassTiles()).rejects.toThrow('Grass tiles JSON configuration is required but could not be loaded: Failed to load grass tiles configuration: 404 Not Found')
  })

  it('throws error if JSON is missing required fields', async() => {
    const incompleteData = {
      passablePaths: [],
      // decorativePaths missing
      impassablePaths: []
    }

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async() => incompleteData
    })

    await expect(discoverGrassTiles()).rejects.toThrow('Grass tiles JSON configuration is required but could not be loaded: Invalid grass tiles configuration: missing required path arrays')
  })

  it('logs warnings if arrays are empty', async() => {
    const emptyData = {
      passablePaths: [],
      decorativePaths: [],
      impassablePaths: [],
      metadata: { generatedAt: '2023-01-01' }
    }

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async() => emptyData
    })

    await discoverGrassTiles()

    expect(window.logger.warn).toHaveBeenCalledWith(expect.stringContaining('No passable grass tiles found'))
    expect(window.logger.warn).toHaveBeenCalledWith(expect.stringContaining('No decorative grass tiles found'))
    expect(window.logger.warn).toHaveBeenCalledWith(expect.stringContaining('No impassable grass tiles found'))
  })
})
