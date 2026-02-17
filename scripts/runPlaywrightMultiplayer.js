import { spawnSync } from 'node:child_process'

function parseResolutionFromText(text) {
  if (!text || typeof text !== 'string') {
    return null
  }

  const match = text.match(/(\d+)\s*x\s*(\d+)/u)
  if (!match) {
    return null
  }

  const width = Number.parseInt(match[1], 10)
  const height = Number.parseInt(match[2], 10)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return { width, height }
}

function detectLargestScreen() {
  if (process.platform !== 'darwin') {
    return null
  }

  const result = spawnSync('system_profiler', ['SPDisplaysDataType', '-json'], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout) {
    return null
  }

  try {
    const parsed = JSON.parse(result.stdout)
    const displays = parsed?.SPDisplaysDataType || []
    let largest = null

    displays.forEach((gpu) => {
      const drvList = gpu?.spdisplays_ndrvs || []
      drvList.forEach((display) => {
        const pixelRes = parseResolutionFromText(display?._spdisplays_pixels)
        const currentRes = parseResolutionFromText(display?._spdisplays_resolution)
        const resolution = pixelRes || currentRes
        if (!resolution) {
          return
        }

        const area = resolution.width * resolution.height
        if (!largest || area > largest.area) {
          largest = {
            width: resolution.width,
            height: resolution.height,
            area,
            name: display?._name || 'display'
          }
        }
      })
    })

    return largest
  } catch {
    return null
  }
}

function cleanupReportServerPort() {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return
  }

  const pidLookup = spawnSync('lsof', ['-ti', 'tcp:9323'], { encoding: 'utf8' })
  if (pidLookup.status !== 0) {
    return
  }

  const pids = (pidLookup.stdout || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (pids.length === 0) {
    return
  }

  spawnSync('kill', ['-9', ...pids], { stdio: 'ignore' })
}

const env = {
  ...process.env,
  PLAYWRIGHT_NETLIFY_DEV: process.env.PLAYWRIGHT_NETLIFY_DEV || '1',
  PLAYWRIGHT_HTML_OPEN: 'never'
}

const largestScreen = detectLargestScreen()
if (largestScreen) {
  process.stdout.write(
    `[E2E][runner] Largest screen detected: ${largestScreen.name} ${largestScreen.width}x${largestScreen.height}\n`
  )
  env.PLAYWRIGHT_LARGEST_SCREEN_WIDTH = String(largestScreen.width)
  env.PLAYWRIGHT_LARGEST_SCREEN_HEIGHT = String(largestScreen.height)
}

const result = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/e2e/multiplayerNetlifyFourParty.test.js', '--project=chromium'],
  {
    env,
    stdio: 'inherit'
  }
)

cleanupReportServerPort()

if (result.error) {
  process.stderr.write(`${result.error.message}\n`)
  process.exit(1)
}

process.exit(result.status ?? 1)