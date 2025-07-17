// aiManager.js - Manages AI processing through web worker timing coordination
// Handles coordination between main thread rendering and AI processing

export class AIManager {
  constructor() {
    this.timingWorker = null
    this.computeWorker = null
    this.isInitialized = false
    this.computeWorkerReady = false
    this.aiInterval = 300 // Base interval in ms
    this.isProcessing = false
    this.performanceData = {}
    
    // AI processing state
    this.aiLoopActive = false
    this.lastAIUpdateTime = 0
    
    // Debug mode flag
    this.debugMode = false
    
    // Flag to track if start was requested before initialization
    this.pendingStart = false
    
    // Processing mode: 'worker', 'chunked', 'synchronous'
    this.processingMode = 'worker'
    
    this.initializeWorkers()
  }

  /**
   * Initialize both timing and computation workers
   */
  async initializeWorkers() {
    try {
      // Create timing worker for coordination
      this.timingWorker = new Worker(
        new URL('./aiWorker.js', import.meta.url),
        { type: 'module' }
      )

      // Create computation worker for actual AI processing
      this.computeWorker = new Worker(
        new URL('./aiComputeWorker.js', import.meta.url),
        { type: 'module' }
      )

      // Set up message handling for both workers
      this.timingWorker.onmessage = (e) => this.handleTimingWorkerMessage(e)
      this.timingWorker.onerror = (error) => this.handleTimingWorkerError(error)
      
      this.computeWorker.onmessage = (e) => this.handleComputeWorkerMessage(e)
      this.computeWorker.onerror = (error) => this.handleComputeWorkerError(error)

      // Initialize the computation worker
      this.computeWorker.postMessage({ type: 'INIT' })

      console.log('AI Workers created successfully (timing + computation)')
      this.processingMode = 'worker'
      
    } catch (error) {
      console.error('Failed to create AI Workers:', error)
      console.warn('Falling back to chunked processing on main thread')
      this.timingWorker = null
      this.computeWorker = null
      this.processingMode = 'chunked'
      
      // If start was requested but worker failed, start fallback
      if (this.pendingStart) {
        this.pendingStart = false
        console.log('Starting fallback AI processing (worker creation failed)')
        this.startFallbackAILoop()
      }
    }
  }

  /**
   * Handle messages from the timing worker
   * @param {MessageEvent} e - Message event from timing worker
   */
  handleTimingWorkerMessage(e) {
    const { type, data } = e.data

    switch (type) {
      case 'AI_WORKER_READY':
        this.isInitialized = true
        this.aiInterval = data.baseInterval
        console.log('AI Timing Worker ready, base interval:', this.aiInterval)
        
        // Check if both workers are ready
        this.checkWorkersReady()
        break

      case 'REQUEST_AI_UPDATE':
        this.handleAIUpdateRequest(data)
        break

      case 'AI_LOOP_STARTED':
        this.aiLoopActive = true
        console.log('AI loop started with interval:', data.interval)
        break

      case 'AI_LOOP_STOPPED':
        this.aiLoopActive = false
        console.log('AI loop stopped')
        break

      case 'AI_ITERATION_METRICS':
        this.handleIterationMetrics(data)
        break

      case 'AI_RESET_COMPLETE':
        this.aiInterval = data.currentInterval
        console.log('AI reset complete, interval:', this.aiInterval)
        break

      case 'AI_CONFIG_UPDATED':
        this.aiInterval = data.currentInterval
        console.log('AI config updated, interval:', this.aiInterval)
        break

      case 'AI_PERFORMANCE_DATA':
        this.performanceData = { ...this.performanceData, timing: data }
        if (this.debugMode) {
          console.log('AI Timing Performance:', data)
        }
        break

      default:
        console.warn('Unknown message type from Timing Worker:', type)
    }
  }

  /**
   * Handle messages from the computation worker
   * @param {MessageEvent} e - Message event from computation worker
   */
  handleComputeWorkerMessage(e) {
    const { type, data } = e.data

    switch (type) {
      case 'AI_COMPUTE_WORKER_INITIALIZED':
        console.log('AI Compute Worker initialized')
        break

      case 'AI_COMPUTE_WORKER_READY':
        this.computeWorkerReady = true
        console.log('AI Compute Worker ready, modules loaded:', data.modulesLoaded)
        
        // Check if both workers are ready
        this.checkWorkersReady()
        break

      case 'AI_PROCESSING_COMPLETE':
        this.handleAIProcessingComplete(data)
        break

      case 'AI_PROCESSING_ERROR':
        this.handleAIProcessingError(data)
        break

      case 'AI_PROCESSING_SKIPPED':
        if (this.debugMode) {
          console.log('AI processing skipped:', data.reason)
        }
        this.isProcessing = false
        break

      case 'AI_CHUNK_COMPLETE':
        this.handleAIChunkComplete(data)
        break

      case 'AI_CHUNK_ERROR':
        this.handleAIChunkError(data)
        break

      case 'AI_PROCESSING_STATS':
        this.performanceData = { ...this.performanceData, computation: data }
        break

      case 'AI_COMPUTE_WORKER_ERROR':
        this.handleComputeWorkerError(data)
        break

      default:
        console.warn('Unknown message type from Compute Worker:', type)
    }
  }

  /**
   * Check if both workers are ready and start AI if pending
   */
  checkWorkersReady() {
    if (this.isInitialized && this.computeWorkerReady && this.pendingStart) {
      this.pendingStart = false
      console.log('Both AI workers ready, starting AI loop')
      this.startAILoop()
    }
  }

  /**
   * Handle timing worker errors
   * @param {ErrorEvent} error - Error event from timing worker
   */
  handleTimingWorkerError(error) {
    console.error('AI Timing Worker error:', error)
    this.isProcessing = false
    
    if (!this.timingWorker) {
      console.warn('AI Timing Worker failed, falling back to main thread timing')
      this.processingMode = this.computeWorker ? 'worker' : 'chunked'
    }
  }

  /**
   * Handle computation worker errors  
   * @param {ErrorEvent} error - Error event from computation worker
   */
  handleComputeWorkerError(error) {
    console.error('AI Compute Worker error:', error)
    this.isProcessing = false
    this.computeWorkerReady = false
    
    if (!this.computeWorker) {
      console.warn('AI Compute Worker failed, falling back to chunked processing')
      this.processingMode = 'chunked'
    }
  }

  /**
   * Handle successful AI processing completion
   * @param {Object} data - Processing results
   */
  handleAIProcessingComplete(data) {
    const { units, factories, bullets, gameState, processingTime, stats } = data
    
    try {
      // Apply AI computation results back to game state
      this.applyAIResults({ units, factories, bullets, gameState })
      
      // Update performance data
      this.performanceData = { 
        ...this.performanceData, 
        computation: stats,
        lastProcessingTime: processingTime,
        processingMode: this.processingMode
      }
      
      // Report completion to timing worker
      if (this.timingWorker) {
        this.timingWorker.postMessage({
          type: 'AI_ITERATION_COMPLETE',
          data: {
            startTime: data.startTime,
            endTime: data.endTime,
            processingTime
          }
        })
      }
      
      if (this.debugMode) {
        console.log(`AI computation completed in ${processingTime.toFixed(2)}ms`)
      }
      
    } catch (error) {
      console.error('Error applying AI results:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Handle AI processing errors
   * @param {Object} data - Error data
   */
  handleAIProcessingError(data) {
    console.error('AI processing error:', data.error)
    if (data.stack) {
      console.error('Stack trace:', data.stack)
    }
    
    // Fall back to main thread processing for this iteration
    if (data.phase === 'processing') {
      console.warn('Falling back to main thread for this AI iteration')
      this.processAIMainThread().catch(err => {
        console.error('Fallback AI processing also failed:', err)
      })
    }
    
    this.isProcessing = false
  }

  /**
   * Handle AI chunk processing completion
   * @param {Object} data - Chunk processing results
   */
  handleAIChunkComplete(data) {
    const { chunkType, result, processingTime } = data
    
    if (this.debugMode) {
      console.log(`AI chunk ${chunkType} completed in ${processingTime.toFixed(2)}ms`)
    }
    
    // Apply chunk results based on type
    this.applyChunkResults(chunkType, result)
  }

  /**
   * Handle AI chunk processing errors
   * @param {Object} data - Chunk error data  
   */
  handleAIChunkError(data) {
    console.error(`AI chunk ${data.chunkType} error:`, data.error)
    this.isProcessing = false
  }

  /**
   * Start the AI processing loop
   */
  startAILoop() {
    // Check if workers are ready
    const workersReady = this.isInitialized && this.computeWorkerReady
    
    if (!workersReady && (this.timingWorker || this.computeWorker)) {
      // Workers exist but not ready yet, wait for initialization
      console.log('AI Workers initializing, will start AI loop when ready...')
      this.pendingStart = true
      return
    }

    if (!workersReady && !this.timingWorker && !this.computeWorker) {
      console.warn('AI Workers not available, starting fallback AI loop')
      this.processingMode = 'chunked'
      this.startFallbackAILoop()
      return
    }

    if (this.timingWorker && workersReady) {
      this.timingWorker.postMessage({
        type: 'START_AI_LOOP',
        data: {}
      })
    } else {
      // Fallback to chunked processing
      this.processingMode = 'chunked'
      this.startFallbackAILoop()
    }
  }

  /**
   * Stop the AI processing loop
   */
  stopAILoop() {
    if (this.timingWorker) {
      this.timingWorker.postMessage({
        type: 'STOP_AI_LOOP',
        data: {}
      })
    } else {
      this.stopFallbackAILoop()
    }
  }

  /**
   * Handle AI update request from timing worker
   * @param {Object} data - Request data from timing worker
   */
  async handleAIUpdateRequest(data) {
    if (this.isProcessing) {
      return // Skip if still processing previous update
    }

    this.isProcessing = true
    const startTime = performance.now()
    this.lastAIUpdateTime = startTime

    try {
      if (this.processingMode === 'worker' && this.computeWorker && this.computeWorkerReady) {
        // Use computation worker for AI processing
        await this.processAIWithWorker()
      } else if (this.processingMode === 'chunked') {
        // Use chunked processing on main thread
        await this.processAIChunked()
      } else {
        // Fallback to synchronous processing
        await this.processAIMainThread()
      }
      
    } catch (error) {
      console.error('Error processing AI update:', error)
      
      // Report error to timing worker
      if (this.timingWorker) {
        const endTime = performance.now()
        this.timingWorker.postMessage({
          type: 'AI_ITERATION_COMPLETE',
          data: {
            startTime,
            endTime,
            processingTime: endTime - startTime,
            error: error.message
          }
        })
      }
    }
    
    // Note: isProcessing will be set to false in the completion handlers
  }

  /**
   * Process AI using the computation worker
   */
  async processAIWithWorker() {
    // Gather game data
    const rawGameData = {
      units: this.getUnits(),
      factories: this.getFactories(),
      bullets: this.getBullets(),
      mapGrid: this.getMapGrid(),
      gameState: this.getGameState()
    }

    // Clean data for worker transfer (remove DOM elements and non-serializable objects)
    const gameData = this.sanitizeDataForWorker(rawGameData)

    if (!gameData.gameState || !gameData.units || !gameData.factories || !gameData.mapGrid) {
      console.warn('Incomplete game data for AI processing')
      this.isProcessing = false
      return
    }

    // Send to computation worker
    try {
      this.computeWorker.postMessage({
        type: 'PROCESS_AI',
        data: gameData
      })
    } catch (error) {
      if (error.name === 'DataCloneError') {
        console.error('AI Manager: DataCloneError - failed to serialize game data for worker:', error)
        console.log('AI Manager: Attempting to identify problematic data...')
        
        // Try to identify which part of the data is problematic
        for (const [key, value] of Object.entries(gameData)) {
          try {
            JSON.stringify(value)
            console.log(`✓ ${key}: serializable`)
          } catch (e) {
            console.error(`✗ ${key}: NOT serializable`, e.message)
          }
        }
        
        // Fallback to chunked processing
        console.log('AI Manager: Falling back to chunked processing due to serialization error')
        this.processingMode = 'chunked'
        await this.processAIChunked()
      } else {
        throw error
      }
    }
  }

  /**
   * Process AI using chunked processing on main thread
   */
  async processAIChunked() {
    const gameState = this.getGameState()
    const units = this.getUnits()
    const factories = this.getFactories()
    const bullets = this.getBullets()
    const mapGrid = this.getMapGrid()

    if (!gameState || !units || !factories || !mapGrid) {
      this.isProcessing = false
      return
    }

    try {
      // Process AI in chunks to avoid blocking
      await this.processAIInChunks(units, factories, bullets, mapGrid, gameState)
      
      const endTime = performance.now()
      
      // Report completion to timing worker
      if (this.timingWorker) {
        this.timingWorker.postMessage({
          type: 'AI_ITERATION_COMPLETE',
          data: {
            startTime: this.lastAIUpdateTime,
            endTime,
            processingTime: endTime - this.lastAIUpdateTime
          }
        })
      }

    } catch (error) {
      console.error('Error in chunked AI processing:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Apply AI computation results back to game state
   * @param {Object} results - AI processing results
   */
  applyAIResults(results) {
    const { units, factories, bullets, gameState } = results
    
    try {
      // Get current game objects
      const gameUnits = this.getUnits()
      const gameFactories = this.getFactories()
      const gameBullets = this.getBullets()
      const currentGameState = this.getGameState()

      // Apply unit updates (only for AI units)
      units.forEach((aiUnit, index) => {
        if (gameUnits[index] && gameUnits[index].owner !== 'player') {
          // Preserve critical properties and apply AI changes
          const originalId = gameUnits[index].id
          Object.assign(gameUnits[index], aiUnit)
          gameUnits[index].id = originalId // Ensure ID consistency
        }
      })

      // Apply factory updates (only for AI factories)
      factories.forEach((aiFactory, index) => {
        if (gameFactories[index] && gameFactories[index].id !== 'player') {
          const originalId = gameFactories[index].id
          Object.assign(gameFactories[index], aiFactory)
          gameFactories[index].id = originalId // Ensure ID consistency
        }
      })

      // Apply bullet updates
      if (gameBullets && bullets) {
        gameBullets.length = 0
        gameBullets.push(...bullets)
      }

      // Apply selective game state updates (avoid overwriting player state)
      const aiStateUpdates = {
        money: gameState.money,
        powerSupply: gameState.powerSupply,
        targetedOreTiles: gameState.targetedOreTiles,
        refineryStatus: gameState.refineryStatus
      }
      
      Object.assign(currentGameState, aiStateUpdates)
      
    } catch (error) {
      console.error('Error applying AI results:', error)
    }
  }

  /**
   * Apply chunk processing results
   * @param {string} chunkType - Type of chunk processed
   * @param {Object} result - Chunk processing result
   */
  applyChunkResults(chunkType, result) {
    try {
      switch (chunkType) {
        case 'AI_PLAYER':
          this.applyAIPlayerChunkResults(result)
          break
        case 'AI_UNITS':
          this.applyAIUnitsChunkResults(result)
          break
        case 'AI_STRATEGIES':
          this.applyAIStrategiesChunkResults(result)
          break
        case 'AI_BUILDING':
          this.applyAIBuildingChunkResults(result)
          break
        case 'AI_SPAWNER':
          this.applyAISpawnerChunkResults(result)
          break
        default:
          console.warn('Unknown chunk type for result application:', chunkType)
      }
    } catch (error) {
      console.error(`Error applying ${chunkType} chunk results:`, error)
    }
  }

  /**
   * Apply AI player chunk results
   */
  applyAIPlayerChunkResults(result) {
    const { playerId, updatedUnits, updatedFactories, gameStateChanges } = result
    const gameUnits = this.getUnits()
    const gameFactories = this.getFactories()
    const gameState = this.getGameState()

    // Update units for this player
    updatedUnits.forEach(updatedUnit => {
      const gameUnit = gameUnits.find(u => u.id === updatedUnit.id)
      if (gameUnit) {
        Object.assign(gameUnit, updatedUnit)
      }
    })

    // Update factories for this player
    updatedFactories.forEach(updatedFactory => {
      const gameFactory = gameFactories.find(f => f.id === updatedFactory.id)
      if (gameFactory) {
        Object.assign(gameFactory, updatedFactory)
      }
    })

    // Apply game state changes
    Object.assign(gameState, gameStateChanges)
  }

  /**
   * Apply AI units chunk results
   */
  applyAIUnitsChunkResults(result) {
    const { ownerId, processedUnits } = result
    const gameUnits = this.getUnits()

    // Update units for this owner
    processedUnits.forEach(processedUnit => {
      const gameUnit = gameUnits.find(u => u.id === processedUnit.id)
      if (gameUnit && gameUnit.owner === ownerId) {
        Object.assign(gameUnit, processedUnit)
      }
    })
  }

  /**
   * Apply AI strategies chunk results
   */
  applyAIStrategiesChunkResults(result) {
    const { strategicDecisions } = result
    
    // Store strategic decisions for use by other AI components
    if (!window.aiStrategicDecisions) {
      window.aiStrategicDecisions = {}
    }
    
    Object.assign(window.aiStrategicDecisions, strategicDecisions)
    
    if (this.debugMode) {
      console.log('Strategic decisions updated:', strategicDecisions)
    }
  }

  /**
   * Apply AI building chunk results
   */
  applyAIBuildingChunkResults(result) {
    const { playerId, buildingDecisions } = result
    
    // Store building decisions for use by AI player logic
    if (!window.aiBuildingDecisions) {
      window.aiBuildingDecisions = {}
    }
    
    window.aiBuildingDecisions[playerId] = buildingDecisions
    
    if (this.debugMode && buildingDecisions) {
      console.log(`Building decisions for ${playerId}:`, buildingDecisions)
    }
  }

  /**
   * Apply AI spawner chunk results
   */
  applyAISpawnerChunkResults(result) {
    const { playerId, spawningDecisions } = result
    
    // Store spawning decisions for use by AI player logic
    if (!window.aiSpawningDecisions) {
      window.aiSpawningDecisions = {}
    }
    
    window.aiSpawningDecisions[playerId] = spawningDecisions
    
    if (this.debugMode && spawningDecisions) {
      console.log(`Spawning decisions for ${playerId}:`, spawningDecisions)
    }
  }

  /**
   * Process AI in chunks to avoid blocking main thread
   */
  async processAIInChunks(units, factories, bullets, mapGrid, gameState) {
    const CHUNK_SIZE = 5 // Process 5 units at a time
    const aiPlayers = ['player2', 'player3', 'player4'].filter(p => p !== gameState.humanPlayer)
    
    // Process each AI player
    for (const aiPlayerId of aiPlayers) {
      const aiUnits = units.filter(unit => unit.owner === aiPlayerId)
      
      // Process units in chunks
      for (let i = 0; i < aiUnits.length; i += CHUNK_SIZE) {
        const chunk = aiUnits.slice(i, i + CHUNK_SIZE)
        await this.processUnitChunk(chunk, units, gameState, mapGrid, aiPlayerId)
        await this.yieldToMainThread()
      }
      
      // Process AI player decisions (building, production)
      await this.processSingleAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState)
      await this.yieldToMainThread()
    }
  }

  /**
   * Process a chunk of units
   */
  async processUnitChunk(unitChunk, allUnits, gameState, mapGrid, ownerId) {
    return new Promise(async (resolve) => {
      const processChunk = async () => {
        try {
          const { updateAIUnit } = await import('./enemyUnitBehavior.js')
          const now = performance.now()
          const targetedOreTiles = gameState.targetedOreTiles || {}
          
          unitChunk.forEach(unit => {
            updateAIUnit(unit, allUnits, gameState, mapGrid, now, ownerId, targetedOreTiles)
          })
          
          resolve()
        } catch (error) {
          console.error('Error processing unit chunk:', error)
          resolve()
        }
      }

      if (window.requestIdleCallback) {
        window.requestIdleCallback(processChunk, { timeout: 16 }) // 16ms max
      } else {
        setTimeout(processChunk, 0)
      }
    })
  }

  /**
   * Process a single AI player's decisions
   */
  async processSingleAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState) {
    return new Promise(async (resolve) => {
      const processPlayer = async () => {
        try {
          const { updateAIPlayer } = await import('./enemyAIPlayer.js')
          const now = performance.now()
          const occupancyMap = gameState.occupancyMap
          const targetedOreTiles = gameState.targetedOreTiles || {}
          
          updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles)
          resolve()
        } catch (error) {
          console.error('Error processing AI player:', error)
          resolve()
        }
      }

      if (window.requestIdleCallback) {
        window.requestIdleCallback(processPlayer, { timeout: 32 }) // 32ms max for player decisions
      } else {
        setTimeout(processPlayer, 0)
      }
    })
  }

  /**
   * Yield control back to main thread
   */
  async yieldToMainThread() {
    return new Promise(resolve => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve, { timeout: 5 })
      } else {
        setTimeout(resolve, 0)
      }
    })
  }

  /**
   * Process AI asynchronously using time slicing (fallback method)
   */
  async processAIAsync() {
    return new Promise((resolve) => {
      // Use requestIdleCallback if available, otherwise setTimeout
      const processChunk = async () => {
        try {
          await this.processAIMainThread()
          resolve()
        } catch (error) {
          console.error('Error in AI processing chunk:', error)
          resolve()
        }
      }

      if (window.requestIdleCallback) {
        window.requestIdleCallback(processChunk, { timeout: 50 })
      } else {
        setTimeout(processChunk, 0)
      }
    })
  }

  /**
   * Process AI on main thread using the existing AI logic (fallback method)
   */
  async processAIMainThread() {
    // Import and use the existing AI update logic
    const gameState = this.getGameState()
    const units = this.getUnits()
    const factories = this.getFactories()
    const bullets = this.getBullets()
    const mapGrid = this.getMapGrid()

    if (!gameState || !units || !factories || !mapGrid) {
      return
    }

    try {
      // Use async import to avoid circular dependencies
      const { updateEnemyAI } = await import('../enemy.js')
      updateEnemyAI(units, factories, bullets, mapGrid, gameState)
    } catch (error) {
      console.error('Error processing AI on main thread:', error)
    }
  }

  /**
   * Handle iteration metrics from timing worker
   * @param {Object} data - Metrics data
   */
  handleIterationMetrics(data) {
    this.performanceData = {
      ...this.performanceData,
      timing: data
    }

    if (this.debugMode) {
      console.log(`AI iteration ${data.iteration} completed in ${data.iterationTime.toFixed(2)}ms (avg: ${data.averageIterationTime.toFixed(2)}ms, interval: ${data.currentInterval}ms)`)
    }
  }

  /**
   * Fallback AI loop using setInterval (when workers are not available)
   */
  startFallbackAILoop() {
    if (this.fallbackIntervalId) {
      this.stopFallbackAILoop()
    }

    console.log('Starting fallback AI loop with interval:', this.aiInterval + 'ms')
    
    this.fallbackIntervalId = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processAIChunked()
      }
    }, this.aiInterval)
    
    this.aiLoopActive = true
  }

  /**
   * Stop fallback AI loop
   */
  stopFallbackAILoop() {
    if (this.fallbackIntervalId) {
      clearInterval(this.fallbackIntervalId)
      this.fallbackIntervalId = null
    }
    this.aiLoopActive = false
  }

  /**
   * Get current game state (helper function)
   */
  getGameState() {
    return window.gameInstance?.gameState || window.gameState
  }

  /**
   * Get current units (helper function)
   */
  getUnits() {
    return window.gameInstance?.units || window.units
  }

  /**
   * Get current factories (helper function)
   */
  getFactories() {
    return window.gameInstance?.factories || window.factories
  }

  /**
   * Get current bullets (helper function)
   */
  getBullets() {
    return window.gameInstance?.bullets || window.bullets
  }

  /**
   * Get current map grid (helper function)
   */
  getMapGrid() {
    return window.gameInstance?.mapGrid || window.mapGrid
  }

  /**
   * Reset AI for new game
   */
  resetAI() {
    if (this.timingWorker && this.isInitialized) {
      this.timingWorker.postMessage({
        type: 'RESET_AI',
        data: {}
      })
    }
    
    if (this.computeWorker && this.computeWorkerReady) {
      this.computeWorker.postMessage({
        type: 'RESET_STATS',
        data: {}
      })
    }
    
    this.isProcessing = false
    this.lastAIUpdateTime = 0
  }

  /**
   * Update AI configuration
   * @param {Object} config - Configuration object
   */
  updateConfig(config) {
    if (this.timingWorker && this.isInitialized) {
      this.timingWorker.postMessage({
        type: 'CONFIG_UPDATE',
        data: config
      })
    } else {
      // Update local config for fallback mode
      if (config.baseInterval) {
        this.aiInterval = config.baseInterval
        if (this.aiLoopActive) {
          this.stopFallbackAILoop()
          this.startFallbackAILoop()
        }
      }
    }
  }

  /**
   * Get current performance data
   * @returns {Object} Performance metrics
   */
  getPerformanceData() {
    // Request fresh data from computation worker
    if (this.computeWorker && this.computeWorkerReady) {
      this.computeWorker.postMessage({
        type: 'GET_PROCESSING_STATS'
      })
    }
    
    return {
      ...this.performanceData,
      processingMode: this.processingMode,
      workersReady: {
        timing: this.isInitialized,
        computation: this.computeWorkerReady
      }
    }
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Whether debug mode is enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled
    console.log('AI Debug mode:', enabled ? 'enabled' : 'disabled')
  }

  /**
   * Request performance data from workers
   */
  requestPerformanceData() {
    if (this.timingWorker && this.isInitialized) {
      this.timingWorker.postMessage({
        type: 'PERFORMANCE_QUERY',
        data: {}
      })
    }
    
    if (this.computeWorker && this.computeWorkerReady) {
      this.computeWorker.postMessage({
        type: 'GET_PROCESSING_STATS'
      })
    }
  }

  /**
   * Check if AI loop is active
   */
  isAILoopActive() {
    return this.aiLoopActive
  }

  /**
   * Get current AI interval
   */
  getCurrentInterval() {
    return this.aiInterval
  }

  /**
   * Terminate the AI workers
   */
  terminate() {
    this.stopAILoop()
    
    if (this.timingWorker) {
      this.timingWorker.terminate()
      this.timingWorker = null
    }
    
    if (this.computeWorker) {
      this.computeWorker.terminate()
      this.computeWorker = null
    }
    
    if (this.fallbackIntervalId) {
      clearInterval(this.fallbackIntervalId)
      this.fallbackIntervalId = null
    }
    
    this.isInitialized = false
    this.computeWorkerReady = false
    this.aiLoopActive = false
    this.pendingStart = false
    console.log('AI Manager terminated')
  }

  /**
   * Sanitize data for worker transfer by removing DOM elements and non-serializable objects
   * @param {Object} data - Raw game data that may contain DOM elements
   * @returns {Object} - Clean data safe for worker transfer
   */
  sanitizeDataForWorker(data) {
    // List of gameState properties that often contain DOM elements
    const domPropertyKeys = [
      'draggedBuildingButton',
      'chainBuildingButton', 
      'element',
      'domElement',
      'button',
      'canvas',
      'ctx',
      'context',
      'htmlElement'
    ]

    let removedKeys = []

    // Deep clone and clean the data
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
      // Skip DOM elements and functions
      if (value instanceof HTMLElement || 
          value instanceof Element || 
          value instanceof Node ||
          typeof value === 'function') {
        removedKeys.push(key)
        return undefined
      }
      
      // Skip specific problematic properties that contain DOM references
      if (domPropertyKeys.includes(key)) {
        removedKeys.push(key)
        return undefined
      }
      
      // Skip circular references and complex objects
      if (value && typeof value === 'object') {
        // Check for circular references
        try {
          JSON.stringify(value)
        } catch (e) {
          if (e.message.includes('circular') || e.message.includes('Converting circular')) {
            console.warn(`Skipping circular reference in key: ${key}`)
            removedKeys.push(key)
            return undefined
          }
          // Re-throw other JSON errors
          throw e
        }
      }
      
      return value
    }))

    // Log what was removed in debug mode
    if (this.debugMode && removedKeys.length > 0) {
      console.log('AI Manager: Removed non-serializable keys:', [...new Set(removedKeys)])
    }

    return cleanData
  }
}
