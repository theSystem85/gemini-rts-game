import { setupBenchmarkScenario, teardownBenchmarkScenario } from './benchmarkScenario.js'
import { startBenchmarkSession, isBenchmarkRunning } from './benchmarkTracker.js'
import {
  initializeBenchmarkModal,
  openBenchmarkModal,
  showBenchmarkStatus,
  showBenchmarkResults,
  setBenchmarkRunningState
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

async function runBenchmarkInternal({ triggeredFromModal = false } = {}) {
  if (isBenchmarkRunning()) {
    return null
  }

  const button = document.getElementById('runBenchmarkBtn')
  if (!triggeredFromModal && button) {
    button.disabled = true
  }

  let scenarioInitialized = false

  try {
    openBenchmarkModal()
    setBenchmarkRunningState(true)
    showBenchmarkStatus('Preparing benchmark scenario…')

    setupBenchmarkScenario()
    scenarioInitialized = true
    await waitForAnimationFrames(2)

    showBenchmarkStatus('Running benchmark (60s)…')

    const resultPromise = startBenchmarkSession(BENCHMARK_DURATION_MS)
    if (!resultPromise) {
      throw new Error('Benchmark session already running')
    }

    const result = await resultPromise

    showBenchmarkResults(result)
    setBenchmarkRunningState(false)

    return result
  } catch (err) {
    console.error('Benchmark run failed:', err)
    showBenchmarkStatus('Benchmark failed. Check console for details.')
    setBenchmarkRunningState(false)
    return null
  } finally {
    if (scenarioInitialized) {
      teardownBenchmarkScenario()
    }
    if (button) {
      button.disabled = false
    }
    gameState.benchmarkActive = false
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
    onRunAgain: () => runBenchmarkInternal({ triggeredFromModal: true }),
    onClose: () => {
      if (button) {
        button.disabled = false
      }
    }
  })

  button.addEventListener('click', () => {
    runBenchmarkInternal({ triggeredFromModal: false })
  })

  buttonInitialized = true
}

export async function runBenchmark() {
  await runBenchmarkInternal({ triggeredFromModal: false })
}
