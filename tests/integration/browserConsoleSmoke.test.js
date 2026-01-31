import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const htmlPath = path.resolve(process.cwd(), 'index.html')
const smokeDelayMs = 2000

const createFetchMock = () => vi.fn(async(input) => {
  const url = typeof input === 'string' ? input : input?.url ?? ''
  const baseResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async() => new ArrayBuffer(0),
    text: async() => ''
  }

  if (url.includes('grass_tiles.json')) {
    return {
      ...baseResponse,
      json: async() => ({
        passablePaths: [],
        decorativePaths: [],
        impassablePaths: [],
        metadata: { generatedAt: 'smoke-test' }
      })
    }
  }

  return {
    ...baseResponse,
    json: async() => ({})
  }
})

describe('Browser smoke test', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads the game without console errors', async() => {
    const html = readFileSync(htmlPath, 'utf-8')
    document.documentElement.innerHTML = html

    const consoleErrors = []
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors.push(args.map(arg => String(arg)).join(' '))
    })

    vi.stubGlobal('fetch', createFetchMock())

    await import('../../src/main.js')
    document.dispatchEvent(new window.Event('DOMContentLoaded'))

    await new Promise((resolve) => setTimeout(resolve, smokeDelayMs))

    expect(consoleErrors, `Console errors detected:\n${consoleErrors.join('\n')}`).toHaveLength(0)
  })
})
