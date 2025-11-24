const listeners = new Set()

export function showHostNotification(message) {
  listeners.forEach(handler => handler(message))
  console.info('[Host Notification]', message)
}

export function subscribeToHostNotifications(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}
