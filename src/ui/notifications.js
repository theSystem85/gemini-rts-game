// notifications.js
// Handle notification display system

export function showNotification(message, duration = 3000) {
  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.textContent = message
  notification.style.position = 'absolute'
  notification.style.top = '10px'
  notification.style.left = '50%'
  notification.style.transform = 'translateX(-50%)'
  notification.style.backgroundColor = 'rgba(0,0,0,0.7)'
  notification.style.color = 'white'
  notification.style.padding = '10px 15px'
  notification.style.borderRadius = '5px'
  notification.style.zIndex = '1000'

  document.body.appendChild(notification)

  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transition = 'opacity 0.5s ease'
    setTimeout(() => notification.remove(), 500)
  }, duration)
}
