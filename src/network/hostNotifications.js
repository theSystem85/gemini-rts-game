import { showNotification } from '../ui/notifications.js'

const listeners = new Set()

export function showHostNotification(message) {
  listeners.forEach(handler => handler(message))
  console.info('[Host Notification]', message)
  if (typeof document !== 'undefined') {
    showNotification(message, 3200)
  }
}

export function subscribeToHostNotifications(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}
