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

  const energyTrack = document.createElement('div')
  energyTrack.id = 'energyBarTrack'
  energyTrack.className = 'energy-bar-track'
  energyTrack.style.position = 'absolute'
  energyTrack.style.left = '0'
  energyTrack.style.bottom = '0'
  energyTrack.style.width = '100%'
  energyTrack.style.height = '14px' // 2px higher than before
  energyTrack.style.backgroundColor = 'rgba(12, 12, 12, 0.85)'
  energyTrack.style.borderRadius = '0'
  energyTrack.style.overflow = 'hidden'

  // Create energy bar
  const energyBar = document.createElement('div')
  energyBar.id = 'energyBar'
  energyBar.style.position = 'absolute'
  energyBar.style.top = '0'
  energyBar.style.left = '0'
  energyBar.style.height = '100%'
  energyBar.style.width = '100%'
  energyBar.style.backgroundColor = '#4CAF50'

  // Create energy text/value overlay
  const energyText = document.createElement('div')
  energyText.id = 'energyText'
  energyText.className = 'energy-bar-value'
  energyText.style.position = 'absolute'
  energyText.style.top = '0'
  energyText.style.left = '0'
  energyText.style.width = '100%'
  energyText.style.height = '100%'
  energyText.style.display = 'flex'
  energyText.style.alignItems = 'center'
  energyText.style.justifyContent = 'center'
  energyText.style.fontSize = '12px'
  energyText.style.fontWeight = '600'
  energyText.style.textShadow = '0 0 3px #000'
  energyText.style.color = '#fff'
  energyText.textContent = '0 MW'

  energyTrack.appendChild(energyBar)
  energyTrack.appendChild(energyText)

  // Add elements to container
  energyBarContainer.appendChild(energyTrack)

  // Make sure the container itself is visible and properly styled
  energyBarContainer.style.display = 'block'
  energyBarContainer.style.visibility = 'visible'
  energyBarContainer.style.position = 'relative'
  energyBarContainer.style.overflow = 'visible'
  energyBarContainer.style.margin = '0'
  energyBarContainer.style.padding = '0'

  // Initialize energy stats in gameState with default values
  gameState.totalPowerProduction = 50
  gameState.powerConsumption = 0
  gameState.playerTotalPowerProduction = 50
  gameState.playerPowerConsumption = 0

  // Force an immediate update
  setTimeout(() => updateEnergyBar(), 100)
}

// Update the energy bar display
export function updateEnergyBar() {
  const energyBar = document.getElementById('energyBar')
  const energyText = document.getElementById('energyText')
  const mobileEnergyBar = document.getElementById('mobileEnergyBar')
  const mobileEnergyValue = document.getElementById('mobileEnergyValue')

  if (!energyBar || !energyText) {
    // Try to recreate the energy bar if not found
    addPowerIndicator()
    return
  }

  // Use player-specific power values
  const totalProduction = gameState.playerTotalPowerProduction || 0
  const totalConsumption = gameState.playerPowerConsumption || 0

  // Display energy production value
  energyText.textContent = `${totalProduction - totalConsumption} MW`
  if (mobileEnergyValue) {
    mobileEnergyValue.textContent = `${totalProduction - totalConsumption} MW`
  }

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
  if (mobileEnergyBar) {
    const isPortraitCondensed = document?.body?.classList.contains('mobile-portrait')
      && document.body.classList.contains('sidebar-condensed')
    const isPwaStandalone = document?.body?.classList.contains('pwa-standalone')
    if (isPortraitCondensed && !isPwaStandalone) {
      mobileEnergyBar.style.height = `${energyPercentage}%`
      mobileEnergyBar.style.width = '100%'
      mobileEnergyBar.style.top = 'auto'
      mobileEnergyBar.style.bottom = '0'
    } else {
      mobileEnergyBar.style.width = `${energyPercentage}%`
      mobileEnergyBar.style.height = '100%'
      mobileEnergyBar.style.top = '0'
      mobileEnergyBar.style.bottom = '0'
    }
  }

  // Update bar color based on percentage thresholds
  if (energyPercentage <= 10) {
    // Below 10% - Red
    energyBar.style.backgroundColor = '#F44336'
    if (mobileEnergyBar) {
      mobileEnergyBar.style.backgroundColor = '#F44336'
    }
  } else if (energyPercentage <= 25) {
    // Below 25% - Orange
    energyBar.style.backgroundColor = '#FF9800'
    if (mobileEnergyBar) {
      mobileEnergyBar.style.backgroundColor = '#FF9800'
    }
  } else if (energyPercentage <= 50) {
    // Below 50% - Yellow
    energyBar.style.backgroundColor = '#FFEB3B'
    if (mobileEnergyBar) {
      mobileEnergyBar.style.backgroundColor = '#FFEB3B'
    }
  } else {
    // Above 50% - Green
    energyBar.style.backgroundColor = '#4CAF50'
    if (mobileEnergyBar) {
      mobileEnergyBar.style.backgroundColor = '#4CAF50'
    }
  }

  // Check if energy is below 10% for production slowdown only (not game speed)
  if (energyPercentage <= 10) {
    gameState.lowEnergyMode = true
  } else {
    gameState.lowEnergyMode = false
  }
}
