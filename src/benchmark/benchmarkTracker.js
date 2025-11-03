import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { getPlayableViewportHeight, getPlayableViewportWidth } from '../utils/layoutMetrics.js'
import { getCurrentGame, mapGrid, units } from '../main.js'

const FRAME_TIME_MIN_THRESHOLD = 0.0001
const CAMERA_UPDATE_INTERVAL_MS = 200
const COMBAT_DISTANCE_THRESHOLD = TILE_SIZE * 10
const COMBAT_DISTANCE_THRESHOLD_SQ = COMBAT_DISTANCE_THRESHOLD * COMBAT_DISTANCE_THRESHOLD
const CLUSTER_SIZE_PX = TILE_SIZE * 12
const CAMERA_LERP_FACTOR = 0.18

let activeSession = null
const cameraFocusState = {
  lastUpdate: 0,
  targetX: null,
  targetY: null,
  active: false
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function resetCameraFocusInternal() {
  cameraFocusState.lastUpdate = 0
  cameraFocusState.targetX = null
  cameraFocusState.targetY = null
  cameraFocusState.active = false
}

function updateBenchmarkCameraFocus(timestamp) {
  if (!cameraFocusState.active || !gameState.benchmarkActive) {
    return
  }

  if (timestamp - cameraFocusState.lastUpdate < CAMERA_UPDATE_INTERVAL_MS) {
    return
  }

  cameraFocusState.lastUpdate = timestamp

  if (!Array.isArray(units) || units.length === 0 || !Array.isArray(mapGrid) || mapGrid.length === 0) {
    return
  }

  const clusters = new Map()

  for (const unit of units) {
    if (!unit || unit.destroyed || !unit.target) {
      continue
    }

    const target = unit.target
    if (!target || target.destroyed || target.owner === unit.owner) {
      continue
    }

    const targetX = typeof target.x === 'number' ? target.x : null
    const targetY = typeof target.y === 'number' ? target.y : null
    const unitX = typeof unit.x === 'number' ? unit.x : null
    const unitY = typeof unit.y === 'number' ? unit.y : null

    if (unitX === null || unitY === null || targetX === null || targetY === null) {
      continue
    }

    const dx = targetX - unitX
    const dy = targetY - unitY
    const distanceSq = dx * dx + dy * dy
    if (distanceSq > COMBAT_DISTANCE_THRESHOLD_SQ) {
      continue
    }

    const centerX = (unitX + targetX) / 2
    const centerY = (unitY + targetY) / 2
    const cellX = Math.floor(centerX / CLUSTER_SIZE_PX)
    const cellY = Math.floor(centerY / CLUSTER_SIZE_PX)
    const key = `${cellX},${cellY}`

    let cell = clusters.get(key)
    if (!cell) {
      cell = { weight: 0, sumX: 0, sumY: 0 }
      clusters.set(key, cell)
    }

    cell.weight += 1
    cell.sumX += centerX
    cell.sumY += centerY
  }

  let bestCluster = null
  for (const cell of clusters.values()) {
    if (!bestCluster || cell.weight > bestCluster.weight) {
      bestCluster = cell
    }
  }

  if (bestCluster) {
    cameraFocusState.targetX = bestCluster.sumX / bestCluster.weight
    cameraFocusState.targetY = bestCluster.sumY / bestCluster.weight
  }

  if (cameraFocusState.targetX === null || cameraFocusState.targetY === null) {
    return
  }

  const game = getCurrentGame()
  const canvasManager = game && game.canvasManager
  const gameCanvas = canvasManager && canvasManager.getGameCanvas ? canvasManager.getGameCanvas() : null
  if (!gameCanvas) {
    return
  }

  const viewportWidth = getPlayableViewportWidth(gameCanvas)
  const viewportHeight = getPlayableViewportHeight(gameCanvas)
  const mapWidthPx = (mapGrid[0]?.length || 0) * TILE_SIZE
  const mapHeightPx = mapGrid.length * TILE_SIZE

  const desiredScrollX = clamp(
    cameraFocusState.targetX - viewportWidth / 2,
    0,
    Math.max(0, mapWidthPx - viewportWidth)
  )
  const desiredScrollY = clamp(
    cameraFocusState.targetY - viewportHeight / 2,
    0,
    Math.max(0, mapHeightPx - viewportHeight)
  )

  gameState.scrollOffset.x += (desiredScrollX - gameState.scrollOffset.x) * CAMERA_LERP_FACTOR
  gameState.scrollOffset.y += (desiredScrollY - gameState.scrollOffset.y) * CAMERA_LERP_FACTOR
}

function finalizeSession(session, finalTimestamp = null) {
  if (!session) return

  if (session.intervalFrameTimes.length > 0) {
    const sum = session.intervalFrameTimes.reduce((acc, t) => acc + t, 0)
    const fps = sum > 0 ? (1000 * session.intervalFrameTimes.length) / sum : 0
    session.intervalAverages.push({
      time: ((finalTimestamp || session.lastFrameTimestamp) - session.startTime) / 1000,
      fps
    })
    session.intervalFrameTimes = []
  }

  const averageFps = session.frameCount > 0 ? session.fpsSum / session.frameCount : 0
  const result = {
    durationMs: (finalTimestamp || session.lastFrameTimestamp) - session.startTime,
    frames: session.frameCount,
    averageFps,
    minFps: session.minFps === Infinity ? 0 : session.minFps,
    maxFps: session.maxFps,
    intervalAverages: session.intervalAverages
  }

  const resolve = session.resolve
  activeSession = null
  resetCameraFocusInternal()
  resolve(result)
}

export function notifyBenchmarkFrame({ timestamp, frameTime }) {
  if (!activeSession || !Number.isFinite(frameTime) || frameTime < FRAME_TIME_MIN_THRESHOLD) {
    return
  }

  const session = activeSession

  if (!session.startTime) {
    session.startTime = timestamp
    session.intervalStart = timestamp
  }

  session.lastFrameTimestamp = timestamp

  updateBenchmarkCameraFocus(timestamp)

  const fps = frameTime > 0 ? 1000 / frameTime : 0
  session.frameCount += 1
  session.fpsSum += fps
  session.minFps = Math.min(session.minFps, fps)
  session.maxFps = Math.max(session.maxFps, fps)

  session.intervalFrameTimes.push(frameTime)

  if (timestamp - session.intervalStart >= session.intervalDuration) {
    const intervalSum = session.intervalFrameTimes.reduce((acc, t) => acc + t, 0)
    const intervalFps = intervalSum > 0
      ? (1000 * session.intervalFrameTimes.length) / intervalSum
      : 0

    session.intervalAverages.push({
      time: (session.intervalStart + session.intervalDuration - session.startTime) / 1000,
      fps: intervalFps
    })

    session.intervalFrameTimes = []
    session.intervalStart += session.intervalDuration
  }

  if (timestamp - session.startTime >= session.durationMs) {
    finalizeSession(session, timestamp)
  }
}

export function startBenchmarkSession(durationMs = 60000, intervalMs = 1000) {
  if (activeSession) {
    return Promise.resolve(null)
  }

  let resolve
  const promise = new Promise((res) => { resolve = res })

  resetCameraFocusInternal()
  activeSession = {
    startTime: null,
    lastFrameTimestamp: null,
    intervalStart: null,
    durationMs,
    intervalDuration: intervalMs,
    frameCount: 0,
    fpsSum: 0,
    minFps: Infinity,
    maxFps: 0,
    intervalFrameTimes: [],
    intervalAverages: [],
    resolve
  }

  cameraFocusState.active = true

  return promise
}

export function isBenchmarkRunning() {
  return Boolean(activeSession)
}

export function cancelBenchmarkSession() {
  if (!activeSession) return null
  const session = activeSession
  cameraFocusState.active = false
  finalizeSession(session, session.lastFrameTimestamp || performance.now())
  return session
}

export function resetBenchmarkCameraFocus() {
  resetCameraFocusInternal()
}
