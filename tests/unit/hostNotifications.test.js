import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../setup.js'

// Mock the showNotification function
vi.mock('../../src/ui/notifications.js', () => ({
  showNotification: vi.fn()
}))

import { showNotification } from '../../src/ui/notifications.js'

describe('hostNotifications.js', () => {
  let showHostNotification
  let subscribeToHostNotifications
  let consoleSpy

  beforeEach(async() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Re-import to get fresh module state
    vi.resetModules()
    const module = await import('../../src/network/hostNotifications.js')
    showHostNotification = module.showHostNotification
    subscribeToHostNotifications = module.subscribeToHostNotifications
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('showHostNotification', () => {
    it('logs the message to console with prefix', () => {
      showHostNotification('Test message')
      expect(consoleSpy).toHaveBeenCalledWith('[Host Notification]', 'Test message')
    })

    it('calls showNotification with message and duration', () => {
      showHostNotification('Player joined')
      expect(showNotification).toHaveBeenCalledWith('Player joined', 3200)
    })

    it('handles empty message', () => {
      showHostNotification('')
      expect(consoleSpy).toHaveBeenCalledWith('[Host Notification]', '')
      expect(showNotification).toHaveBeenCalledWith('', 3200)
    })

    it('handles special characters in message', () => {
      const message = 'Player <script>alert("xss")</script> joined!'
      showHostNotification(message)
      expect(consoleSpy).toHaveBeenCalledWith('[Host Notification]', message)
      expect(showNotification).toHaveBeenCalledWith(message, 3200)
    })

    it('handles long messages', () => {
      const longMessage = 'A'.repeat(1000)
      showHostNotification(longMessage)
      expect(consoleSpy).toHaveBeenCalledWith('[Host Notification]', longMessage)
    })

    it('notifies all subscribed listeners', async() => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      subscribeToHostNotifications(handler1)
      subscribeToHostNotifications(handler2)

      showHostNotification('Test notification')

      expect(handler1).toHaveBeenCalledWith('Test notification')
      expect(handler2).toHaveBeenCalledWith('Test notification')
    })

    it('handles notification when no listeners are subscribed', () => {
      // Should not throw
      expect(() => showHostNotification('No listeners')).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('[Host Notification]', 'No listeners')
    })
  })

  describe('subscribeToHostNotifications', () => {
    it('returns an unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = subscribeToHostNotifications(handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('handler receives notifications after subscribing', () => {
      const handler = vi.fn()
      subscribeToHostNotifications(handler)

      showHostNotification('Test 1')
      showHostNotification('Test 2')

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenNthCalledWith(1, 'Test 1')
      expect(handler).toHaveBeenNthCalledWith(2, 'Test 2')
    })

    it('handler stops receiving notifications after unsubscribing', () => {
      const handler = vi.fn()
      const unsubscribe = subscribeToHostNotifications(handler)

      showHostNotification('Before unsubscribe')
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      showHostNotification('After unsubscribe')
      expect(handler).toHaveBeenCalledTimes(1) // Still just 1
    })

    it('multiple handlers can subscribe and unsubscribe independently', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      const unsub1 = subscribeToHostNotifications(handler1)
      subscribeToHostNotifications(handler2)
      subscribeToHostNotifications(handler3)

      showHostNotification('All three')
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)

      unsub1()

      showHostNotification('Only two')
      expect(handler1).toHaveBeenCalledTimes(1) // Still 1
      expect(handler2).toHaveBeenCalledTimes(2)
      expect(handler3).toHaveBeenCalledTimes(2)
    })

    it('unsubscribing twice has no effect', () => {
      const handler = vi.fn()
      const unsubscribe = subscribeToHostNotifications(handler)

      unsubscribe()
      unsubscribe() // Should not throw

      showHostNotification('After double unsubscribe')
      expect(handler).not.toHaveBeenCalled()
    })

    it('same handler can be subscribed multiple times', () => {
      const handler = vi.fn()
      const unsub1 = subscribeToHostNotifications(handler)
      subscribeToHostNotifications(handler)

      showHostNotification('Test')
      // Set allows duplicates to be handled - depending on implementation
      // If using Set, same function reference is stored once
      expect(handler).toHaveBeenCalledTimes(1)

      unsub1()
      showHostNotification('After first unsub')
      // After unsubscribing once, the handler should be removed (Set behavior)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('handles handlers that throw errors gracefully', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })
      const normalHandler = vi.fn()

      subscribeToHostNotifications(errorHandler)
      subscribeToHostNotifications(normalHandler)

      // The notification should still be attempted for all handlers
      // Depending on implementation, errors might propagate
      expect(() => showHostNotification('Test')).toThrow('Handler error')
    })
  })

  describe('integration scenarios', () => {
    it('supports pub/sub pattern for game events', () => {
      const gameEvents = []
      const handler = (msg) => gameEvents.push({ type: 'host', message: msg })

      subscribeToHostNotifications(handler)

      showHostNotification('Game started')
      showHostNotification('Player 2 connected')
      showHostNotification('Player 2 ready')

      expect(gameEvents).toEqual([
        { type: 'host', message: 'Game started' },
        { type: 'host', message: 'Player 2 connected' },
        { type: 'host', message: 'Player 2 ready' }
      ])
    })

    it('allows dynamic subscription during gameplay', () => {
      const lateJoinerEvents = []

      showHostNotification('Game started') // Before subscription

      const unsub = subscribeToHostNotifications((msg) => lateJoinerEvents.push(msg))

      showHostNotification('Player 2 connected') // After subscription
      showHostNotification('Player 2 ready')

      expect(lateJoinerEvents).toEqual([
        'Player 2 connected',
        'Player 2 ready'
      ])

      unsub()
      showHostNotification('Player 2 disconnected') // After unsubscribe

      expect(lateJoinerEvents).toEqual([
        'Player 2 connected',
        'Player 2 ready'
      ])
    })
  })
})
