import { setupBenchmarkScenario, teardownBenchmarkScenario } from './benchmarkScenario.js'
import { startBenchmarkSession, isBenchmarkRunning } from './benchmarkTracker.js'
import {
  hideBenchmarkCountdown,
  initializeBenchmarkModal,
  openBenchmarkModal,
  setBenchmarkRunningState,
  showBenchmarkCountdownMessage,
  showBenchmarkResults,
  showBenchmarkStatus,
  startBenchmarkCountdown
} from '../ui/benchmarkModal.js'
import { gameState } from '../gameState.js'

const BENCHMARK_DURATION_MS = 60_000

let buttonInitialized = false

function waitForAnimationFrames(count = 1) {
  return new Promise(resolve => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(remaining - 1))
    }
    step(count)
  })
}

async function runBenchmarkInternal() {
  if (isBenchmarkRunning()) {
    return null
  }

  const button = document.getElementById('runBenchmarkBtn')
  if (button) {
    button.disabled = true
  }

  let scenarioInitialized = false
  let stopCountdown = null

  try {
    setBenchmarkRunningState(true)
    showBenchmarkStatus('Preparing benchmark scenario…')
    showBenchmarkCountdownMessage('Benchmark: preparing scenario…')

    setupBenchmarkScenario()
    scenarioInitialized = true
    await waitForAnimationFrames(2)

    showBenchmarkStatus('Running benchmark (60s)…')
    stopCountdown = startBenchmarkCountdown(BENCHMARK_DURATION_MS)

    const resultPromise = startBenchmarkSession(BENCHMARK_DURATION_MS)
    if (!resultPromise) {
      throw new Error('Benchmark session already running')
    }

    const result = await resultPromise

    if (stopCountdown) {
      stopCountdown()
      stopCountdown = null
    }
    hideBenchmarkCountdown()
    showBenchmarkResults(result)
    setBenchmarkRunningState(false)
    openBenchmarkModal()

    return result
  } catch (err) {
    console.error('Benchmark run failed:', err)
    if (stopCountdown) {
      stopCountdown()
      stopCountdown = null
    } else {
      hideBenchmarkCountdown()
    }
    showBenchmarkStatus('Benchmark failed. Check console for details.')
    setBenchmarkRunningState(false)
    openBenchmarkModal()
    return null
  } finally {
    if (scenarioInitialized) {
      teardownBenchmarkScenario()
    }
    if (button) {
      button.disabled = false
    }
    gameState.benchmarkActive = false
    hideBenchmarkCountdown()
  }
}

export function attachBenchmarkButton() {
  if (buttonInitialized) {
    return
  }

  const button = document.getElementById('runBenchmarkBtn')
  if (!button) {
    return
  }

  initializeBenchmarkModal({
    onRunAgain: () => runBenchmarkInternal(),
    onClose: () => {
      if (button) {
        button.disabled = false
      }
    }
  })

  button.addEventListener('click', () => {
    runBenchmarkInternal()
  })

  buttonInitialized = true
}

export async function runBenchmark() {
  await runBenchmarkInternal()
}
