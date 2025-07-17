// aiWorker.js - Web Worker for AI processing
// This worker handles all AI computations to prevent blocking the main render loop

// Note: For now, we'll use a simplified approach and import the main AI function
// The web worker will communicate with a bridge function that handles the actual AI logic

// aiWorker.js - Web Worker for AI processing timing and coordination
// This worker handles timing and coordination to prevent blocking the main render loop

// Configuration for dynamic throttling
const BASE_AI_INTERVAL = 300 // Base interval in milliseconds
let currentAIInterval = BASE_AI_INTERVAL
let lastIterationTime = 0
let averageIterationTime = 0
let iterationCount = 0

// Performance tracking
const performanceHistory = []
const MAX_HISTORY_SIZE = 10

// AI Worker state
let isProcessing = false
let aiLoopActive = false
let aiLoopIntervalId = null

// Message handling from main thread
self.onmessage = function(e) {
  const { type, data } = e.data

  switch (type) {
    case 'TEST':
      // Test message for debugging worker functionality
      self.postMessage({
        type: 'TEST_RESPONSE',
        data: { status: 'OK', message: 'Worker is functional' }
      })
      break
      
    case 'START_AI_LOOP':
      startAILoop()
      break
    case 'STOP_AI_LOOP':
      stopAILoop()
      break
    case 'AI_ITERATION_COMPLETE':
      handleAIIterationComplete(data)
      break
    case 'RESET_AI':
      resetAIState(data)
      break
    case 'CONFIG_UPDATE':
      updateAIConfig(data)
      break
    case 'PERFORMANCE_QUERY':
      sendPerformanceData()
      break
    default:
      console.warn('Unknown message type in AI Worker:', type)
  }
}

/**
 * Start the AI processing loop
 */
function startAILoop() {
  if (aiLoopActive) {
    return
  }

  aiLoopActive = true
  scheduleNextAIIteration()

  self.postMessage({
    type: 'AI_LOOP_STARTED',
    data: {
      interval: currentAIInterval
    }
  })
}

/**
 * Stop the AI processing loop
 */
function stopAILoop() {
  aiLoopActive = false
  
  if (aiLoopIntervalId) {
    clearTimeout(aiLoopIntervalId)
    aiLoopIntervalId = null
  }

  self.postMessage({
    type: 'AI_LOOP_STOPPED',
    data: {}
  })
}

/**
 * Schedule the next AI iteration
 */
function scheduleNextAIIteration() {
  if (!aiLoopActive) {
    return
  }

  aiLoopIntervalId = setTimeout(() => {
    if (aiLoopActive && !isProcessing) {
      triggerAIIteration()
    }
    scheduleNextAIIteration()
  }, currentAIInterval)
}

/**
 * Trigger an AI iteration
 */
function triggerAIIteration() {
  if (isProcessing) {
    return // Skip if still processing
  }

  isProcessing = true
  const startTime = performance.now()

  // Request AI processing from main thread
  self.postMessage({
    type: 'REQUEST_AI_UPDATE',
    data: {
      timestamp: startTime,
      iteration: iterationCount
    }
  })
}

/**
 * Handle completion of AI iteration from main thread
 * @param {Object} data - Completion data from main thread
 */
function handleAIIterationComplete(data) {
  if (!isProcessing) {
    return
  }

  const endTime = performance.now()
  const iterationTime = endTime - data.startTime
  
  updatePerformanceMetrics(iterationTime)
  isProcessing = false

  self.postMessage({
    type: 'AI_ITERATION_METRICS',
    data: {
      iterationTime,
      averageIterationTime,
      currentInterval: currentAIInterval,
      iteration: iterationCount
    }
  })
}

/**
 * Update performance metrics and adjust AI interval dynamically
 * @param {number} iterationTime - Time taken for this iteration
 */
function updatePerformanceMetrics(iterationTime) {
  iterationCount++
  
  // Add to performance history
  performanceHistory.push(iterationTime)
  if (performanceHistory.length > MAX_HISTORY_SIZE) {
    performanceHistory.shift()
  }

  // Calculate average iteration time
  averageIterationTime = performanceHistory.reduce((sum, time) => sum + time, 0) / performanceHistory.length

  // Dynamic interval adjustment
  if (averageIterationTime > BASE_AI_INTERVAL) {
    // AI is taking longer than the base interval, increase the interval
    const multiplier = Math.ceil(averageIterationTime / BASE_AI_INTERVAL)
    currentAIInterval = BASE_AI_INTERVAL * multiplier
  } else {
    // AI is fast enough, use base interval
    currentAIInterval = BASE_AI_INTERVAL
  }

  // Ensure minimum interval
  currentAIInterval = Math.max(currentAIInterval, BASE_AI_INTERVAL)
  
  // Cap maximum interval to prevent AI from becoming too slow
  currentAIInterval = Math.min(currentAIInterval, 2000) // Max 2 seconds

  lastIterationTime = iterationTime
}

/**
 * Reset AI state for new game
 * @param {Object} data - Reset configuration
 */
function resetAIState(data) {
  // Reset performance tracking
  currentAIInterval = BASE_AI_INTERVAL
  lastIterationTime = 0
  averageIterationTime = 0
  iterationCount = 0
  performanceHistory.length = 0
  isProcessing = false

  self.postMessage({
    type: 'AI_RESET_COMPLETE',
    data: {
      currentInterval: currentAIInterval
    }
  })
}

/**
 * Update AI configuration
 * @param {Object} config - New configuration parameters
 */
function updateAIConfig(config) {
  if (config.baseInterval) {
    const oldBaseInterval = BASE_AI_INTERVAL
    BASE_AI_INTERVAL = config.baseInterval
    currentAIInterval = BASE_AI_INTERVAL
    
    console.log(`AI base interval updated from ${oldBaseInterval}ms to ${BASE_AI_INTERVAL}ms`)
  }

  self.postMessage({
    type: 'AI_CONFIG_UPDATED',
    data: {
      currentInterval: currentAIInterval,
      baseInterval: BASE_AI_INTERVAL
    }
  })
}

/**
 * Send current performance data to main thread
 */
function sendPerformanceData() {
  self.postMessage({
    type: 'AI_PERFORMANCE_DATA',
    data: {
      currentInterval: currentAIInterval,
      baseInterval: BASE_AI_INTERVAL,
      averageIterationTime,
      lastIterationTime,
      iterationCount,
      performanceHistory: [...performanceHistory],
      isProcessing,
      aiLoopActive
    }
  })
}

// Initialize worker
console.log('AI Worker initialized with base interval:', BASE_AI_INTERVAL + 'ms')
self.postMessage({
  type: 'AI_WORKER_READY',
  data: {
    baseInterval: BASE_AI_INTERVAL
  }
})
