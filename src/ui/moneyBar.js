// moneyBar.js
// Handle money bar display and management

import { gameState } from '../gameState.js'

// Add money indicator to sidebar with money bar
export function addMoneyIndicator() {
  // Get the money bar container that's already in the HTML
  const moneyBarContainer = document.getElementById('moneyBarContainer')
  if (!moneyBarContainer) {
    console.warn('Money bar container not found!')
    return
  }

  // Clear any existing content to prevent duplicates
  moneyBarContainer.innerHTML = ''

  const moneyTrack = document.createElement('div')
  moneyTrack.id = 'moneyBarTrack'
  moneyTrack.className = 'money-bar-track'
  moneyTrack.style.position = 'absolute'
  moneyTrack.style.left = '0'
  moneyTrack.style.bottom = '0'
  moneyTrack.style.width = '100%'
  moneyTrack.style.height = '14px' // 2px higher than energy bar
  moneyTrack.style.backgroundColor = 'rgba(12, 12, 12, 0.85)'
  moneyTrack.style.borderRadius = '0'
  moneyTrack.style.overflow = 'hidden'

  // Create money bar
  const moneyBar = document.createElement('div')
  moneyBar.id = 'moneyBar'
  moneyBar.style.position = 'absolute'
  moneyBar.style.top = '0'
  moneyBar.style.left = '0'
  moneyBar.style.height = '100%'
  moneyBar.style.width = '100%'
  moneyBar.style.backgroundColor = '#FFA500' // Orange color

  // Create money text/value overlay
  const moneyText = document.createElement('div')
  moneyText.id = 'moneyText'
  moneyText.className = 'money-bar-value'
  moneyText.style.position = 'absolute'
  moneyText.style.top = '0'
  moneyText.style.left = '0'
  moneyText.style.width = '100%'
  moneyText.style.height = '100%'
  moneyText.style.display = 'flex'
  moneyText.style.alignItems = 'center'
  moneyText.style.justifyContent = 'center'
  moneyText.style.fontSize = '12px'
  moneyText.style.fontWeight = '600'
  moneyText.style.textShadow = '0 0 3px #000'
  moneyText.style.color = '#fff' // White text for orange background
  moneyText.textContent = '$0'

  moneyTrack.appendChild(moneyBar)
  moneyTrack.appendChild(moneyText)

  // Add elements to container
  moneyBarContainer.appendChild(moneyTrack)

  // Make sure the container itself is visible and properly styled
  moneyBarContainer.style.display = 'block'
  moneyBarContainer.style.visibility = 'visible'
  moneyBarContainer.style.position = 'relative'
  moneyBarContainer.style.overflow = 'visible'
  moneyBarContainer.style.margin = '0'
  moneyBarContainer.style.padding = '0'

  // Force an immediate update
  setTimeout(() => updateMoneyBar(), 100)
}

// Update the money bar display
export function updateMoneyBar() {
  const moneyBar = document.getElementById('moneyBar')
  const moneyText = document.getElementById('moneyText')

  if (!moneyBar || !moneyText) {
    // Try to recreate the money bar if not found
    addMoneyIndicator()
    return
  }

  // Calculate percentage based on 100k cap
  const currentMoney = Math.max(0, Math.floor(gameState.money || 0))
  const maxMoney = 100000 // 100k cap
  const moneyPercentage = Math.min(100, (currentMoney / maxMoney) * 100)

  // Update bar width
  moneyBar.style.width = `${moneyPercentage}%`

  // Update text to show current money
  moneyText.textContent = `$${currentMoney.toLocaleString()}`
}
