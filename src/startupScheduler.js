const DEFAULT_IDLE_TIMEOUT_MS = 1500

function hasPerformanceTools() {
  return typeof performance !== 'undefined' && typeof performance.mark === 'function'
}

function markStart(label) {
  if (!hasPerformanceTools()) return null
  const startMark = `${label}:start`
  performance.mark(startMark)
  return startMark
}

function markEnd(label, startMark) {
  if (!startMark || !hasPerformanceTools() || typeof performance.measure !== 'function') return

  const endMark = `${label}:end`
  const measureName = `${label}:duration`
  performance.mark(endMark)
  performance.measure(measureName, startMark, endMark)
}

function runMeasuredTask(label, task) {
  const startMark = markStart(label)

  try {
    const result = task()
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        markEnd(label, startMark)
      })
    }

    markEnd(label, startMark)
    return result
  } catch (error) {
    markEnd(label, startMark)
    throw error
  }
}

function scheduleAfterNextPaint(label, task) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      runMeasuredTask(label, task)
    }, 0)
  })
}

function scheduleIdleTask(label, task, timeout = DEFAULT_IDLE_TIMEOUT_MS) {
  const runTask = () => {
    runMeasuredTask(label, task)
  }

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runTask, { timeout })
    return
  }

  setTimeout(runTask, 0)
}

export {
  runMeasuredTask,
  scheduleAfterNextPaint,
  scheduleIdleTask
}
