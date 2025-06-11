// game/milestoneSystem.js
import { playSyncedVideoAudio } from '../ui/videoOverlay.js'
import { showNotification } from '../ui/notifications.js'

/**
 * Milestone detection and trigger system
 * Tracks game achievements and triggers audio-visual events
 */
export class MilestoneSystem {
  constructor() {
    this.achievedMilestones = new Set()
    this.milestoneConfig = {
      firstRefinery: {
        id: 'firstRefinery',
        displayName: 'First Refinery Built',
        description: 'The first ore refinery has been constructed',
        videoFilename: 'tank_over_crystals',
        priority: 'high'
      },
      firstFactory: {
        id: 'firstFactory',
        displayName: 'First Factory Built',
        description: 'Your industrial capabilities are expanding',
        priority: 'medium'
      },
      tenBuildings: {
        id: 'tenBuildings',
        displayName: 'Industrial Complex',
        description: 'Ten buildings have been constructed',
        priority: 'low'
      },
      firstUnit: {
        id: 'firstUnit',
        displayName: 'First Unit Produced',
        description: 'Your first military unit is ready',
        priority: 'medium'
      }
    }
  }

  /**
   * Check if a milestone should be triggered based on game state
   */
  checkMilestones(gameState) {
    
    // Check for first refinery
    if (!this.achievedMilestones.has('firstRefinery')) {
      const hasRefinery = gameState.buildings?.some(building => 
        building.type === 'oreRefinery' && building.owner === 'player'
      )
      if (hasRefinery) {
        this.triggerMilestone('firstRefinery')
      }
    }

    // Check for first factory
    if (!this.achievedMilestones.has('firstFactory')) {
      const hasFactory = gameState.buildings?.some(building => 
        building.type === 'vehicleFactory' && building.owner === 'player'
      )
      if (hasFactory) {
        this.triggerMilestone('firstFactory')
      }
    }

    // Check for ten buildings
    if (!this.achievedMilestones.has('tenBuildings')) {
      const playerBuildings = gameState.buildings?.filter(building => 
        building.owner === 'player'
      )
      if (playerBuildings && playerBuildings.length >= 10) {
        this.triggerMilestone('tenBuildings')
      }
    }

    // Check for first unit
    if (!this.achievedMilestones.has('firstUnit')) {
      const hasUnit = gameState.units?.some(unit => 
        unit.owner === 'player' && unit.type !== 'harvester'
      )
      if (hasUnit) {
        this.triggerMilestone('firstUnit')
      }
    }
  }

  /**
   * Trigger a specific milestone
   */
  triggerMilestone(milestoneId) {
    
    if (this.achievedMilestones.has(milestoneId)) {
      return // Already achieved
    }

    const milestone = this.milestoneConfig[milestoneId]
    if (!milestone) {
      console.warn(`Unknown milestone: ${milestoneId}`)
      return
    }

    this.achievedMilestones.add(milestoneId)

    // Show notification
    showNotification(milestone.displayName, 'achievement')

    // Play video if available
    if (milestone.videoFilename) {
      playSyncedVideoAudio(milestone.videoFilename, {
        title: milestone.displayName,
        description: milestone.description,
        priority: milestone.priority
      })
    }

    // Dispatch custom event for other systems to listen to
    document.dispatchEvent(new CustomEvent('milestoneAchieved', {
      detail: {
        milestone: milestoneId,
        config: milestone
      }
    }))
  }

  /**
   * Get all achieved milestones
   */
  getAchievedMilestones() {
    return Array.from(this.achievedMilestones)
  }

  /**
   * Reset all milestones (for game restart)
   */
  reset() {
    this.achievedMilestones.clear()
  }

  /**
   * Get milestone configuration
   */
  getMilestoneConfig(milestoneId) {
    return this.milestoneConfig[milestoneId]
  }

  /**
   * Check if a milestone is achieved
   */
  isAchieved(milestoneId) {
    return this.achievedMilestones.has(milestoneId)
  }

  /**
   * Set achieved milestones (used for loading saved games)
   */
  setAchievedMilestones(milestoneIds) {
    this.achievedMilestones.clear()
    if (Array.isArray(milestoneIds)) {
      milestoneIds.forEach(id => this.achievedMilestones.add(id))
    }
  }
}

// Create global instance
export const milestoneSystem = new MilestoneSystem()
