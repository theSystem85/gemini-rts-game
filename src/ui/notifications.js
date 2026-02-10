// notifications.js
// Handle notification display system

import { pushNotification } from './notificationHistory.js'
import { PARTY_COLORS } from '../config.js'

function resolvePartyColor(partyId, fallbackColor) {
  if (fallbackColor) return fallbackColor
  if (partyId && PARTY_COLORS[partyId]) return PARTY_COLORS[partyId]
  return '#6b7280'
}

export function showNotification(message, duration = 3000, options = {}) {
  // Remove any existing notifications immediately
  document.querySelectorAll('.notification').forEach((el) => el.remove())

  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.style.position = 'absolute'
  notification.style.top = '10px'
  notification.style.left = '50%'
  notification.style.transform = 'translateX(-50%)'
  notification.style.backgroundColor = 'rgba(0,0,0,0.7)'
  notification.style.color = 'white'
  notification.style.padding = '10px 15px'
  notification.style.borderRadius = '5px'
  notification.style.zIndex = '1000'

  if (options.llmPartyIndicator) {
    notification.style.display = 'flex'
    notification.style.alignItems = 'center'
    notification.style.gap = '10px'

    const robotBubble = document.createElement('span')
    robotBubble.setAttribute('aria-hidden', 'true')
    robotBubble.textContent = '🤖'
    robotBubble.style.display = 'inline-flex'
    robotBubble.style.alignItems = 'center'
    robotBubble.style.justifyContent = 'center'
    robotBubble.style.width = '28px'
    robotBubble.style.height = '28px'
    robotBubble.style.borderRadius = '999px'
    robotBubble.style.flex = '0 0 28px'
    robotBubble.style.backgroundColor = resolvePartyColor(options.partyId, options.partyColor)
    robotBubble.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)'

    const messageText = document.createElement('span')
    messageText.textContent = message

    notification.append(robotBubble, messageText)
  } else {
    notification.textContent = message
  }

  document.body.appendChild(notification)

  // Push to persistent notification history
  pushNotification(message)

  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transition = 'opacity 0.5s ease'
    setTimeout(() => notification.remove(), 500)
  }, duration)
}
