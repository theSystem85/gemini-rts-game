// energyBar.js
// Handle energy bar display and management

import { gameState } from '../gameState.js'

// Add power indicator to sidebar with energy bar
export function addPowerIndicator() {
  // Get the energy bar container that's already in the HTML
  const energyBarContainer = document.getElementById('energyBarContainer')
  if (!energyBarContainer) {
    return
  }

  // Clear any existing content to prevent duplicates
  energyBarContainer.innerHTML = ''

  // Create energy bar
  const energyBar = document.createElement('div')
  energyBar.id = 'energyBar'

  // Set explicit styles for the energy bar to ensure it's visible
  energyBar.style.width = '100%'
  energyBar.style.height = '100%'
  energyBar.style.backgroundColor = '#4CAF50' // Green
  energyBar.style.position = 'absolute'
  energyBar.style.top = '0'
  energyBar.style.left = '0'
  energyBar.style.zIndex = '0'

  // Create energy text
  const energyText = document.createElement('div')
  energyText.id = 'energyText'
  energyText.className = 'energyBarLabel'
  energyText.style.position = 'absolute'
  energyText.style.width = '100%'
  energyText.style.textAlign = 'center'
  energyText.style.fontSize = '12px'
  energyText.style.lineHeight = '20px'
  energyText.style.zIndex = '1'
  energyText.style.textShadow = '0 0 3px #000'
  energyText.style.color = '#fff' // White text
  energyText.textContent = 'Energy: 100'

  // Add elements to container
  energyBarContainer.appendChild(energyBar)
  energyBarContainer.appendChild(energyText)

  // Make sure the container itself is visible and properly styled
  energyBarContainer.style.display = 'block'
  energyBarContainer.style.visibility = 'visible'
  energyBarContainer.style.height = '20px'
  energyBarContainer.style.position = 'relative'
  energyBarContainer.style.overflow = 'hidden'
  energyBarContainer.style.margin = '0 0 10px 0'

  // Initialize energy stats in gameState with default values
  gameState.totalPowerProduction = 100
  gameState.powerConsumption = 0
  gameState.playerTotalPowerProduction = 100
  gameState.playerPowerConsumption = 0

  // Force an immediate update
  setTimeout(() => updateEnergyBar(), 100)
}

// Update the energy bar display
export function updateEnergyBar() {
  const energyBar = document.getElementById('energyBar')
  const energyText = document.getElementById('energyText')

  if (!energyBar || !energyText) {
    // Try to recreate the energy bar if not found
    addPowerIndicator()
    return
  }

  // Use player-specific power values
  const totalProduction = gameState.playerTotalPowerProduction || 0
  const totalConsumption = gameState.playerPowerConsumption || 0

  // Display energy production value
  energyText.textContent = `Energy: ${totalProduction - totalConsumption}`

  // Calculate percentage of energy remaining
  let energyPercentage = 100
  if (totalProduction > 0) {
    energyPercentage = Math.max(0, 100 - (totalConsumption / totalProduction) * 100)
  } else if (totalConsumption > 0) {
    // If no production but consumption exists
    energyPercentage = 0
  }

  // Update bar width
  energyBar.style.width = `${energyPercentage}%`

  // Update bar color based on percentage thresholds
  if (energyPercentage <= 10) {
    // Below 10% - Red
    energyBar.style.backgroundColor = '#F44336'
  } else if (energyPercentage <= 25) {
    // Below 25% - Orange
    energyBar.style.backgroundColor = '#FF9800'
  } else if (energyPercentage <= 50) {
    // Below 50% - Yellow
    energyBar.style.backgroundColor = '#FFEB3B'
  } else {
    // Above 50% - Green
    energyBar.style.backgroundColor = '#4CAF50'
  }

  // Check if energy is below 10% for production slowdown only (not game speed)
  if (energyPercentage <= 10) {
    gameState.lowEnergyMode = true
  } else {
    gameState.lowEnergyMode = false
  }
}
