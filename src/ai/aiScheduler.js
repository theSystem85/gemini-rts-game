// AI Scheduler - Manages AI updates to prevent performance spikes
// Spreads AI calculations across multiple frames and uses event-based triggers

class AIScheduler {
  constructor() {
    this.unitQueues = {
      strategy: [], // Heavy strategy calculations
      targeting: [], // Target selection
      pathfinding: [] // Path calculations
    }
    
    this.lastProcessTime = {
      strategy: 0,
      targeting: 0,
      pathfinding: 0
    }
    
    this.processIntervals = {
      strategy: 3000, // Every 3 seconds for heavy strategy
      targeting: 2000, // Every 2 seconds for targeting
      pathfinding: 1500 // Every 1.5 seconds for pathfinding
    }
    
    this.maxProcessPerFrame = {
      strategy: 2, // Max 2 strategy updates per frame
      targeting: 3, // Max 3 targeting updates per frame
      pathfinding: 4 // Max 4 pathfinding updates per frame
    }
    
    this.cache = {
      groupData: new Map(), // Cache group calculations
      defenseData: new Map(), // Cache defense evaluations
      cacheExpiry: 5000 // Cache expires after 5 seconds
    }
  }
  
  /**
   * Schedule a unit for strategy update with random delay
   */
  scheduleStrategyUpdate(unit) {
    const now = performance.now()
    const baseDelay = this.processIntervals.strategy
    const randomDelay = Math.random() * 1000 // Random 0-1 second delay
    const scheduledTime = now + baseDelay + randomDelay
    
    if (!unit.nextStrategyUpdate || now >= unit.nextStrategyUpdate) {
      unit.nextStrategyUpdate = scheduledTime
      if (!this.unitQueues.strategy.includes(unit)) {
        this.unitQueues.strategy.push(unit)
      }
    }
  }
  
  /**
   * Schedule a unit for targeting update with random delay
   */
  scheduleTargetingUpdate(unit, customInterval = null) {
    const now = performance.now()
    const baseDelay = customInterval || this.processIntervals.targeting
    const randomDelay = Math.random() * 500 // Random 0-0.5 second delay
    const scheduledTime = now + baseDelay + randomDelay
    
    if (!unit.nextTargetingUpdate || now >= unit.nextTargetingUpdate) {
      unit.nextTargetingUpdate = scheduledTime
      if (!this.unitQueues.targeting.includes(unit)) {
        this.unitQueues.targeting.push(unit)
      }
    }
  }
  
  /**
   * Schedule a unit for pathfinding update with random delay
   */
  schedulePathfindingUpdate(unit) {
    const now = performance.now()
    const baseDelay = this.processIntervals.pathfinding
    const randomDelay = Math.random() * 750 // Random 0-0.75 second delay
    const scheduledTime = now + baseDelay + randomDelay
    
    if (!unit.nextPathfindingUpdate || now >= unit.nextPathfindingUpdate) {
      unit.nextPathfindingUpdate = scheduledTime
      if (!this.unitQueues.pathfinding.includes(unit)) {
        this.unitQueues.pathfinding.push(unit)
      }
    }
  }
  
  /**
   * Process scheduled AI updates with frame budget limits
   */
  processScheduledUpdates(now, units, gameState, mapGrid) {
    // Process strategy updates
    this.processQueue('strategy', now, (unit) => {
      this.processStrategyUpdate(unit, units, gameState, mapGrid, now)
    })
    
    // Process targeting updates  
    this.processQueue('targeting', now, (unit) => {
      this.processTargetingUpdate(unit, units, gameState, now)
    })
    
    // Process pathfinding updates
    this.processQueue('pathfinding', now, (unit) => {
      this.processPathfindingUpdate(unit, gameState, mapGrid, now)
    })
    
    // Clean up expired cache entries
    this.cleanupCache(now)
  }
  
  /**
   * Process a specific queue with frame budget limits
   */
  processQueue(queueType, now, processor) {
    const queue = this.unitQueues[queueType]
    const maxProcess = this.maxProcessPerFrame[queueType]
    let processed = 0
    
    for (let i = queue.length - 1; i >= 0 && processed < maxProcess; i--) {
      const unit = queue[i]
      
      // Check if unit is still valid
      if (!unit || unit.health <= 0) {
        queue.splice(i, 1)
        continue
      }
      
      // Check if it's time to process this unit
      const nextUpdateKey = `next${queueType.charAt(0).toUpperCase() + queueType.slice(1)}Update`
      if (unit[nextUpdateKey] && now >= unit[nextUpdateKey]) {
        processor(unit)
        queue.splice(i, 1)
        processed++
      }
    }
  }
  
  /**
   * Get cached group data or calculate if needed
   */
  getCachedGroupData(unit, units, now) {
    const cacheKey = `${unit.owner}-${Math.floor(unit.x / 64)}-${Math.floor(unit.y / 64)}`
    const cached = this.cache.groupData.get(cacheKey)
    
    if (cached && (now - cached.timestamp) < this.cache.cacheExpiry) {
      return cached.data
    }
    
    // Calculate fresh group data
    const maxDistanceSquared = (8 * 32) ** 2 // 8 tiles in pixels, squared
    const allies = units.filter(u => 
      u.owner === unit.owner &&
      u !== unit &&
      u.health > 0 &&
      (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
      ((u.x - unit.x) ** 2 + (u.y - unit.y) ** 2) < maxDistanceSquared
    )
    
    const groupData = {
      nearbyAllies: allies,
      groupSize: allies.length + 1,
      timestamp: now
    }
    
    this.cache.groupData.set(cacheKey, { data: groupData, timestamp: now })
    return groupData
  }
  
  /**
   * Get cached defense data or calculate if needed
   */
  getCachedDefenseData(position, gameState, now) {
    const cacheKey = `defense-${Math.floor(position.x / 64)}-${Math.floor(position.y / 64)}`
    const cached = this.cache.defenseData.get(cacheKey)
    
    if (cached && (now - cached.timestamp) < this.cache.cacheExpiry) {
      return cached.data
    }
    
    // Calculate fresh defense data
    let defenseStrength = 0
    if (gameState.buildings) {
      const nearbyDefenses = gameState.buildings.filter(b => 
        b.owner === gameState.humanPlayer &&
        (b.type.includes('turret') || b.type === 'teslaCoil') &&
        Math.abs(b.x * 32 - position.x) < 8 * 32 &&
        Math.abs(b.y * 32 - position.y) < 8 * 32
      )
      defenseStrength = nearbyDefenses.length
    }
    
    this.cache.defenseData.set(cacheKey, { data: defenseStrength, timestamp: now })
    return defenseStrength
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache(now) {
    // Clean up group data cache
    for (const [key, value] of this.cache.groupData.entries()) {
      if (now - value.timestamp > this.cache.cacheExpiry) {
        this.cache.groupData.delete(key)
      }
    }
    
    // Clean up defense data cache
    for (const [key, value] of this.cache.defenseData.entries()) {
      if (now - value.timestamp > this.cache.cacheExpiry) {
        this.cache.defenseData.delete(key)
      }
    }
  }
  
  /**
   * Process strategy update for a single unit
   */
  processStrategyUpdate(unit, units, gameState, mapGrid, now) {
    import('./enemyStrategies.js').then(({ applyEnemyStrategies }) => {
      applyEnemyStrategies(unit, units, gameState, mapGrid, now)
      // Schedule next strategy update
      this.scheduleStrategyUpdate(unit)
    })
  }
  
  /**
   * Process targeting update for a single unit
   */
  processTargetingUpdate(unit, units, gameState, now) {
    // First check if defensive policy should override targeting
    import('./defensivePolicy.js').then(({ applyDefensivePolicy, canDefendAgainstTarget }) => {
      const defensiveTarget = applyDefensivePolicy(unit, units, gameState, now)
      
      if (defensiveTarget && canDefendAgainstTarget(unit, defensiveTarget)) {
        // Defensive target takes priority
        unit.target = defensiveTarget
        unit.targetType = 'defensive'
        // Schedule next targeting update sooner for defensive units
        this.scheduleTargetingUpdate(unit, 500) // Check every 0.5 seconds in defensive mode
      } else {
        // No defensive target, use normal targeting logic
        import('./enemyUnitBehavior.js').then(({ selectTargetForUnit }) => {
          if (selectTargetForUnit) {
            const strategicTarget = selectTargetForUnit(unit, units, gameState)
            if (strategicTarget) {
              unit.target = strategicTarget
              unit.targetType = 'strategic'
            }
          }
          // Schedule next targeting update
          this.scheduleTargetingUpdate(unit)
        })
      }
    })
  }
  
  /**
   * Process pathfinding update for a single unit
   */
  processPathfindingUpdate(unit, gameState, mapGrid, now) {
    if (unit.target && (!unit.path || unit.path.length < 2)) {
      import('../units.js').then(({ findPath }) => {
        let targetPos = null
        if (unit.target.tileX !== undefined) {
          targetPos = { x: unit.target.tileX, y: unit.target.tileY }
        } else {
          targetPos = { x: unit.target.x, y: unit.target.y }
        }
        
        // Only pathfind if unit is far enough from target
        const distanceToTarget = Math.hypot(targetPos.x - unit.tileX, targetPos.y - unit.tileY)
        if (distanceToTarget > 2) {
          const occupancyMap = gameState.occupancyMap
          const path = findPath(
            { x: unit.tileX, y: unit.tileY },
            targetPos,
            mapGrid,
            occupancyMap
          )
          if (path.length > 1) {
            unit.path = path.slice(1)
            unit.lastPathCalcTime = now
          }
        }
        
        // Schedule next pathfinding update
        this.schedulePathfindingUpdate(unit)
      })
    }
  }
  
  /**
   * Remove unit from all queues (call when unit is destroyed)
   */
  removeUnit(unit) {
    Object.values(this.unitQueues).forEach(queue => {
      const index = queue.indexOf(unit)
      if (index !== -1) {
        queue.splice(index, 1)
      }
    })
  }
}

// Global AI scheduler instance
export const aiScheduler = new AIScheduler()
