const FRAME_TIME_MIN_THRESHOLD = 0.0001

let activeSession = null

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

  return promise
}

export function isBenchmarkRunning() {
  return Boolean(activeSession)
}

export function cancelBenchmarkSession() {
  if (!activeSession) return null
  const session = activeSession
  finalizeSession(session, session.lastFrameTimestamp || performance.now())
  return session
}
