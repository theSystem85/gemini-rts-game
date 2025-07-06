// AI Event System - Triggers AI updates based on events rather than frames
// This reduces unnecessary calculations and improves performance

class AIEventSystem {
  constructor() {
    this.eventListeners = new Map()
    this.pendingEvents = []
    this.lastEventProcessTime = 0
    this.eventProcessInterval = 100 // Process events every 100ms max
  }
  
  /**
   * Register an event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType).push(callback)
  }
  
  /**
   * Emit an event
   */
  emit(eventType, data) {
    this.pendingEvents.push({ type: eventType, data, timestamp: performance.now() })
  }
  
  /**
   * Process pending events with throttling
   */
  processEvents(now) {
    if (now - this.lastEventProcessTime < this.eventProcessInterval) {
      return
    }
    
    this.lastEventProcessTime = now
    
    // Process up to 10 events per cycle to avoid frame drops
    const eventsToProcess = this.pendingEvents.splice(0, 10)
    
    eventsToProcess.forEach(event => {
      const listeners = this.eventListeners.get(event.type)
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(event.data, event.timestamp)
          } catch (error) {
            console.warn(`AI Event error for ${event.type}:`, error)
          }
        })
      }
    })
  }
  
  /**
   * Clear all pending events (useful for cleanup)
   */
  clearEvents() {
    this.pendingEvents = []
  }
}

// Global AI event system
export const aiEventSystem = new AIEventSystem()

// Common AI events
export const AI_EVENTS = {
  UNIT_DAMAGED: 'unit_damaged',
  UNIT_DESTROYED: 'unit_destroyed', 
  ENEMY_SPOTTED: 'enemy_spotted',
  TARGET_LOST: 'target_lost',
  HARVEST_COMPLETE: 'harvest_complete',
  BUILDING_ATTACKED: 'building_attacked',
  GROUP_FORMED: 'group_formed',
  RETREAT_TRIGGERED: 'retreat_triggered'
}

// Setup default AI event listeners
aiEventSystem.on(AI_EVENTS.UNIT_DAMAGED, (data) => {
  const { unit, attacker } = data
  if (unit && attacker) {
    unit.isBeingAttacked = true
    unit.lastAttacker = attacker
    unit.lastDamageTime = performance.now()
    
    // Trigger immediate defensive response with faster targeting
    import('./aiScheduler.js').then(({ aiScheduler }) => {
      aiScheduler.scheduleTargetingUpdate(unit, 200) // Immediate defensive response (0.2 seconds)
    })
  }
})

aiEventSystem.on(AI_EVENTS.ENEMY_SPOTTED, (data) => {
  const { spotter, enemy } = data
  if (spotter && enemy) {
    // Alert nearby allied units
    import('./aiScheduler.js').then(({ aiScheduler }) => {
      aiScheduler.scheduleTargetingUpdate(spotter)
    })
  }
})

aiEventSystem.on(AI_EVENTS.TARGET_LOST, (data) => {
  const { unit } = data
  if (unit) {
    unit.target = null
    unit.path = []
    // Schedule new target search
    import('./aiScheduler.js').then(({ aiScheduler }) => {
      aiScheduler.scheduleTargetingUpdate(unit)
    })
  }
})

aiEventSystem.on(AI_EVENTS.GROUP_FORMED, (data) => {
  const { units } = data
  if (units && units.length > 0) {
    // Schedule strategy updates for all units in the group
    import('./aiScheduler.js').then(({ aiScheduler }) => {
      units.forEach(unit => {
        aiScheduler.scheduleStrategyUpdate(unit)
      })
    })
  }
})
