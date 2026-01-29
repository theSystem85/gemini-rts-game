import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '../setup.js'

// Mock the sound module
vi.mock('../../src/sound.js', () => ({
  playSound: vi.fn()
}))

import {
  markWaypointsAdded,
  handleAltKeyRelease,
  resetWaypointTracking
} from '../../src/game/waypointSounds.js'
import { playSound } from '../../src/sound.js'

describe('waypointSounds.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the internal state before each test
    resetWaypointTracking()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('markWaypointsAdded', () => {
    it('should mark that waypoints were added', () => {
      markWaypointsAdded()

      // Verify by checking that handleAltKeyRelease plays sound
      handleAltKeyRelease()
      expect(playSound).toHaveBeenCalled()
    })

    it('should not throw when called multiple times', () => {
      expect(() => {
        markWaypointsAdded()
        markWaypointsAdded()
        markWaypointsAdded()
      }).not.toThrow()
    })

    it('should set state that persists until Alt key is released', () => {
      markWaypointsAdded()

      // State should persist
      handleAltKeyRelease()
      expect(playSound).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleAltKeyRelease', () => {
    it('should not play sound if no waypoints were added', () => {
      handleAltKeyRelease()

      expect(playSound).not.toHaveBeenCalled()
    })

    it('should play sound when waypoints were added', () => {
      markWaypointsAdded()

      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledWith(
        'chainOfCommandsReceived',
        1.0,
        0,
        true
      )
    })

    it('should reset state after playing sound', () => {
      markWaypointsAdded()
      handleAltKeyRelease()

      // Second release should not play sound
      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledTimes(1)
    })

    it('should use stackable sound queue (true parameter)', () => {
      markWaypointsAdded()
      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        true // stackable = true
      )
    })

    it('should use correct volume (1.0)', () => {
      markWaypointsAdded()
      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledWith(
        expect.any(String),
        1.0,
        expect.any(Number),
        expect.any(Boolean)
      )
    })

    it('should use correct pan value (0)', () => {
      markWaypointsAdded()
      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        0,
        expect.any(Boolean)
      )
    })

    it('should play the chainOfCommandsReceived sound', () => {
      markWaypointsAdded()
      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledWith(
        'chainOfCommandsReceived',
        expect.any(Number),
        expect.any(Number),
        expect.any(Boolean)
      )
    })
  })

  describe('resetWaypointTracking', () => {
    it('should clear waypoint added state', () => {
      markWaypointsAdded()
      resetWaypointTracking()

      handleAltKeyRelease()

      expect(playSound).not.toHaveBeenCalled()
    })

    it('should not throw when called with no state', () => {
      expect(() => resetWaypointTracking()).not.toThrow()
    })

    it('should not throw when called multiple times', () => {
      expect(() => {
        resetWaypointTracking()
        resetWaypointTracking()
        resetWaypointTracking()
      }).not.toThrow()
    })

    it('should allow new waypoints to be tracked after reset', () => {
      markWaypointsAdded()
      resetWaypointTracking()
      markWaypointsAdded()

      handleAltKeyRelease()

      expect(playSound).toHaveBeenCalledTimes(1)
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical Alt+click waypoint workflow', () => {
      // User presses Alt and clicks to add waypoints
      markWaypointsAdded()
      markWaypointsAdded()
      markWaypointsAdded()

      // User releases Alt key
      handleAltKeyRelease()

      // Sound should play once
      expect(playSound).toHaveBeenCalledTimes(1)
      expect(playSound).toHaveBeenCalledWith('chainOfCommandsReceived', 1.0, 0, true)
    })

    it('should handle Alt press without adding waypoints', () => {
      // User presses Alt but doesn't add any waypoints
      resetWaypointTracking() // Alt key pressed

      // User releases Alt key
      handleAltKeyRelease()

      // No sound should play
      expect(playSound).not.toHaveBeenCalled()
    })

    it('should handle multiple Alt key press/release cycles', () => {
      // First cycle - add waypoints
      markWaypointsAdded()
      handleAltKeyRelease()

      // Second cycle - add waypoints again
      markWaypointsAdded()
      handleAltKeyRelease()

      // Third cycle - no waypoints
      resetWaypointTracking()
      handleAltKeyRelease()

      // Sound should have played twice
      expect(playSound).toHaveBeenCalledTimes(2)
    })

    it('should properly reset between Alt key sessions', () => {
      // First session
      markWaypointsAdded()
      handleAltKeyRelease()
      expect(playSound).toHaveBeenCalledTimes(1)

      // Prepare for new session
      resetWaypointTracking()

      // Second session without waypoints
      handleAltKeyRelease()
      expect(playSound).toHaveBeenCalledTimes(1) // Still 1, no new sound

      // Third session with waypoints
      markWaypointsAdded()
      handleAltKeyRelease()
      expect(playSound).toHaveBeenCalledTimes(2) // Now 2
    })
  })
})
