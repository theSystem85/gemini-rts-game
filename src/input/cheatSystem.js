// cheatSystem.js
import { gameState } from '../gameState.js'
import { units } from '../main.js'
import { showNotification } from '../ui/notifications.js'
import { playSound } from '../sound.js'

export class CheatSystem {
  constructor() {
    this.isDialogOpen = false
    this.godModeEnabled = false
    this.originalHealthValues = new Map()
    this.godModeUnits = new Set()
    this.setupStyles()
  }

  setupStyles() {
    // Inject CSS styles for the cheat dialog
    if (!document.getElementById('cheat-dialog-styles')) {
      const style = document.createElement('style')
      style.id = 'cheat-dialog-styles'
      style.textContent = `
        .cheat-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          backdrop-filter: blur(2px);
        }

        .cheat-dialog {
          background: linear-gradient(135deg, #2c3e50, #34495e);
          border: 2px solid #3498db;
          border-radius: 8px;
          padding: 20px;
          min-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          font-family: 'Arial', sans-serif;
        }

        .cheat-dialog h2 {
          color: #ecf0f1;
          margin: 0 0 15px 0;
          text-align: center;
          font-size: 18px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .cheat-input-container {
          margin-bottom: 15px;
        }

        .cheat-input {
          width: 100%;
          padding: 10px;
          font-size: 14px;
          border: 1px solid #5d6d7e;
          border-radius: 4px;
          background: #34495e;
          color: #ecf0f1;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.3s ease;
        }

        .cheat-input:focus {
          border-color: #3498db;
          box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
        }

        .cheat-input::placeholder {
          color: #95a5a6;
        }

        .cheat-buttons {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .cheat-button {
          padding: 8px 16px;
          font-size: 14px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: bold;
          text-transform: uppercase;
        }

        .cheat-button.submit {
          background: #27ae60;
          color: white;
          flex: 1;
        }

        .cheat-button.submit:hover {
          background: #2ecc71;
          transform: translateY(-1px);
        }

        .cheat-button.close {
          background: #e74c3c;
          color: white;
          flex: 1;
        }

        .cheat-button.close:hover {
          background: #c0392b;
          transform: translateY(-1px);
        }

        .cheat-help {
          margin-top: 15px;
          padding: 10px;
          background: rgba(52, 73, 94, 0.5);
          border-radius: 4px;
          font-size: 12px;
          color: #bdc3c7;
          line-height: 1.4;
        }

        .cheat-help h3 {
          margin: 0 0 8px 0;
          color: #3498db;
          font-size: 13px;
        }

        .cheat-help ul {
          margin: 0;
          padding-left: 16px;
        }

        .cheat-help li {
          margin-bottom: 4px;
        }

        .cheat-help code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 4px;
          border-radius: 2px;
          font-family: 'Courier New', monospace;
          color: #f39c12;
        }
      `
      document.head.appendChild(style)
    }
  }

  openDialog() {
    if (this.isDialogOpen) return

    this.isDialogOpen = true

    // Create dialog overlay
    const overlay = document.createElement('div')
    overlay.className = 'cheat-dialog-overlay'
    overlay.id = 'cheat-dialog-overlay'

    // Create dialog
    const dialog = document.createElement('div')
    dialog.className = 'cheat-dialog'

    dialog.innerHTML = `
      <h2>🎮 Cheat Console</h2>
      <div class="cheat-input-container">
        <input 
          type="text" 
          class="cheat-input" 
          id="cheat-input" 
          placeholder="Enter cheat code..."
          autocomplete="off"
          spellcheck="false"
        >
      </div>
      <div class="cheat-buttons">
        <button class="cheat-button submit" id="cheat-submit">Execute</button>
        <button class="cheat-button close" id="cheat-close">Close</button>
      </div>
      <div class="cheat-help">
        <h3>Available Cheat Codes:</h3>
        <ul>
          <li><code>godmode on</code> / <code>godmode off</code> - Toggle invincibility for all units</li>
          <li><code>give [amount]</code> - Add money (e.g., <code>give 10000</code>)</li>
          <li><code>money [amount]</code> - Set money to specific amount</li>
          <li><code>status</code> - Show current cheat status</li>
        </ul>
      </div>
    `

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    // Focus input field
    const input = document.getElementById('cheat-input')
    input.focus()

    // Add event listeners
    this.setupDialogEventListeners(overlay, input)

    // Prevent game inputs while dialog is open
    this.pauseGameInput(true)
  }

  setupDialogEventListeners(overlay, input) {
    const submitBtn = document.getElementById('cheat-submit')
    const closeBtn = document.getElementById('cheat-close')

    // Submit cheat code
    const submitCheat = () => {
      const code = input.value.trim()
      if (code) {
        this.processCheatCode(code)
        input.value = ''
      }
    }

    // Close dialog
    const closeDialog = () => {
      this.closeDialog()
    }

    // Event listeners
    submitBtn.addEventListener('click', submitCheat)
    closeBtn.addEventListener('click', closeDialog)

    // Enter key to submit
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitCheat()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeDialog()
      }
    })

    // Click overlay to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog()
      }
    })
  }

  closeDialog() {
    if (!this.isDialogOpen) return

    const overlay = document.getElementById('cheat-dialog-overlay')
    if (overlay) {
      overlay.remove()
    }

    this.isDialogOpen = false
    this.pauseGameInput(false)
  }

  pauseGameInput(paused) {
    // Store the original paused state and set our own
    if (paused) {
      this.originalPauseState = gameState.gamePaused
      gameState.cheatDialogOpen = true
    } else {
      gameState.cheatDialogOpen = false
    }
  }

  processCheatCode(code) {
    const normalizedCode = code.toLowerCase().trim()
    
    try {
      // God mode commands
      if (normalizedCode === 'godmode on' || normalizedCode === 'god on' || normalizedCode === 'invincible on') {
        this.enableGodMode()
      } else if (normalizedCode === 'godmode off' || normalizedCode === 'god off' || normalizedCode === 'invincible off') {
        this.disableGodMode()
      }
      // Money commands
      else if (normalizedCode.startsWith('give ')) {
        const amount = this.parseAmount(normalizedCode.substring(5))
        if (amount !== null) {
          this.addMoney(amount)
        } else {
          this.showError('Invalid amount. Use: give [number]')
        }
      } else if (normalizedCode.startsWith('money ')) {
        const amount = this.parseAmount(normalizedCode.substring(6))
        if (amount !== null) {
          this.setMoney(amount)
        } else {
          this.showError('Invalid amount. Use: money [number]')
        }
      }
      // Status command
      else if (normalizedCode === 'status') {
        this.showStatus()
      }
      // Unknown command
      else {
        this.showError(`Unknown cheat code: "${code}"`)
      }
    } catch (error) {
      console.error('Cheat system error:', error)
      this.showError('Error processing cheat code')
    }
  }

  parseAmount(amountStr) {
    const cleaned = amountStr.replace(/[,$]/g, '').trim()
    const amount = parseInt(cleaned, 10)
    return isNaN(amount) ? null : Math.max(0, amount)
  }

  enableGodMode() {
    if (this.godModeEnabled) {
      showNotification('🛡️ God mode is already enabled', 3000)
      return
    }

    this.godModeEnabled = true
    this.originalHealthValues.clear()
    this.godModeUnits.clear()

    // Store original health values and set all units to invincible
    units.forEach(unit => {
      if (unit.owner === 'player') {
        this.originalHealthValues.set(unit.id, {
          health: unit.health,
          maxHealth: unit.maxHealth
        })
        
        this.godModeUnits.add(unit.id)
        
        // Set to maximum health and make effectively invincible
        unit.health = unit.maxHealth
        unit.isInvincible = true
      }
    })

    showNotification('🛡️ God mode ENABLED - All player units are now invincible!', 4000)
    playSound('constructionComplete', 0.7)
  }

  disableGodMode() {
    if (!this.godModeEnabled) {
      showNotification('🛡️ God mode is already disabled', 3000)
      return
    }

    this.godModeEnabled = false

    // Restore original health values
    units.forEach(unit => {
      if (unit.owner === 'player') {
        const originalValues = this.originalHealthValues.get(unit.id)
        if (originalValues) {
          unit.health = Math.min(originalValues.health, unit.maxHealth)
        }
        unit.isInvincible = false
      }
    })

    this.originalHealthValues.clear()
    this.godModeUnits.clear()
    showNotification('🛡️ God mode DISABLED - Units are now vulnerable', 4000)
    playSound('construction_cancelled', 0.7)
  }

  addMoney(amount) {
    const oldMoney = gameState.money
    gameState.money += amount
    gameState.totalMoneyEarned += amount

    showNotification(`💰 Added $${amount.toLocaleString()} (Total: $${gameState.money.toLocaleString()})`, 3000)
    playSound('deposit', 0.8)
  }

  setMoney(amount) {
    const oldMoney = gameState.money
    gameState.money = amount

    showNotification(`💰 Money set to $${amount.toLocaleString()}`, 3000)
    playSound('deposit', 0.8)
  }

  showStatus() {
    const statusLines = [
      `💰 Money: $${gameState.money.toLocaleString()}`,
      `🛡️ God Mode: ${this.godModeEnabled ? 'ENABLED' : 'DISABLED'}`,
      `👥 Player Units: ${units.filter(u => u.owner === 'player').length}`,
      `🤖 Enemy Units: ${units.filter(u => u.owner === 'enemy').length}`,
      `🏭 Player Buildings: ${gameState.buildings.filter(b => b.owner === 'player').length}`
    ]

    showNotification(statusLines.join('\n'), 5000)
  }

  showError(message) {
    showNotification(`❌ ${message}`, 3000)
    playSound('error', 0.5)
  }

  // Hook into unit damage to prevent damage when god mode is enabled
  preventDamage(target, damage) {
    if (!this.godModeEnabled) return damage
    
    // Handle units
    if (target.owner === 'player' && target.id && this.godModeUnits.has(target.id)) {
      return 0 // Prevent all damage to player units
    }
    
    // Handle buildings (buildings have owner but different structure)
    if (target.owner === 'player' && target.type && !target.id) {
      return 0 // Prevent all damage to player buildings
    }
    
    // Handle factories (factories use id as 'player' or 'enemy')
    if (target.id === 'player') {
      return 0 // Prevent all damage to player factory
    }
    
    return damage // Allow normal damage
  }

  // Update god mode for new units
  updateNewUnit(unit) {
    if (this.godModeEnabled && unit.owner === 'player') {
      unit.isInvincible = true
      this.godModeUnits.add(unit.id)
      this.originalHealthValues.set(unit.id, {
        health: unit.health,
        maxHealth: unit.maxHealth
      })
    }
  }

  // Clean up dead units from tracking
  cleanupDestroyedUnit(unitId) {
    this.originalHealthValues.delete(unitId)
    this.godModeUnits.delete(unitId)
  }

  /**
   * Remove a unit from god mode tracking when it's destroyed
   * @param {string} unitId - The ID of the unit to remove
   */
  removeUnitFromTracking(unitId) {
    this.godModeUnits.delete(unitId)
    this.originalHealthValues.delete(unitId)
  }

  /**
   * Check if god mode is currently active
   * @returns {boolean} True if god mode is active
   */
  isGodModeActive() {
    return this.godModeEnabled
  }

  /**
   * Add a unit to god mode protection
   * @param {Object} unit - The unit to add to god mode
   */
  addUnitToGodMode(unit) {
    if (this.godModeEnabled && unit.id) {
      this.godModeUnits.add(unit.id)
      // Store original health if not already stored
      if (!this.originalHealthValues.has(unit.id)) {
        this.originalHealthValues.set(unit.id, {
          health: unit.health,
          maxHealth: unit.maxHealth
        })
      }
      unit.isInvincible = true
    }
  }
}
