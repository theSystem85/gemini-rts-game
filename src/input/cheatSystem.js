// cheatSystem.js
import { gameState } from '../gameState.js'
import { units } from '../main.js'
import { showNotification } from '../ui/notifications.js'
import { playSound } from '../sound.js'
import { productionQueue } from '../productionQueue.js'
import {
  ENABLE_ENEMY_CONTROL,
  setEnemyControlEnabled,
  TILE_SIZE,
  DIRECTIONS,
  MAX_SPAWN_SEARCH_DISTANCE,
  UNIT_PROPERTIES
} from '../config.js'
import { createUnit, updateUnitOccupancy } from '../units.js'
import { updatePowerSupply } from '../buildings.js'
import { updateUnitSpeedModifier } from '../utils.js'

export class CheatSystem {
  constructor() {
    this.isDialogOpen = false
    this.godModeEnabled = false
    this.originalHealthValues = new Map()
    this.godModeUnits = new Set()
    this.selectedUnits = null
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
          width: min(90vw, 500px);
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          font-family: 'Arial', sans-serif;
          box-sizing: border-box;
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
          <li><code>give [amount]</code> or <code>give [party] [amount]</code> - Add money (e.g., <code>give 10000</code>, <code>give red 5000</code>)</li>
          <li><code>money [amount]</code> - Set money to specific amount</li>
          <li><code>hp [amount]</code> or <code>hp [amount]%</code> - Set HP of selected unit(s)</li>
          <li><code>status</code> - Show current cheat status</li>
          <li><code>fuel [amount|percent%]</code> - Set fuel level of selected unit</li>
          <li><code>medics [amount]</code> - Set medic count of selected ambulance(s)</li>
          <li><code>party [color|player]</code> - Change party of selected unit(s)</li>
          <li><code>kill</code> - Destroy all selected units or buildings</li>
          <li><code>enemycontrol on</code> / <code>enemycontrol off</code> - Toggle enemy unit control</li>
          <li><code>driver</code> / <code>commander</code> / <code>loader</code> / <code>gunner</code> - Toggle crew for selected unit</li>
          <li><code>[type] [amount] [party]</code> - Spawn units around the cursor. Defaults to the player's party</li>
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
        const args = normalizedCode.substring(5).trim()
        if (!args) {
          this.showError('Invalid amount. Use: give [number] or give [party] [number]')
          return
        }

        const tokens = args.split(/\s+/)
        let owner = gameState.humanPlayer
        let amountTokens = tokens

        const potentialOwner = this.resolvePartyAlias(tokens[0])
        if (potentialOwner) {
          owner = potentialOwner
          amountTokens = tokens.slice(1)
        }

        const amountStr = amountTokens.join(' ')
        const amount = this.parseAmount(amountStr)

        if (amount !== null && amountTokens.length > 0) {
          const success = this.addMoney(amount, owner)
          if (!success) {
            this.showError('Unable to find the specified party for give command')
          }
        } else {
          this.showError('Invalid amount. Use: give [number] or give [party] [number]')
        }
      } else if (normalizedCode.startsWith('money ')) {
        const amount = this.parseAmount(normalizedCode.substring(6))
        if (amount !== null) {
          this.setMoney(amount)
        } else {
          this.showError('Invalid amount. Use: money [number]')
        }
      } else if (normalizedCode.startsWith('hp ')) {
        let raw = normalizedCode.substring(3).trim()
        let isPercent = false
        if (raw.endsWith('%')) {
          isPercent = true
          raw = raw.slice(0, -1)
        }
        const amount = this.parseAmount(raw)
        if (amount !== null) {
          this.setSelectedUnitsHP(amount, isPercent)
        } else {
          this.showError('Invalid amount. Use: hp [number] or hp [number]%')
        }
      } else if (normalizedCode.startsWith('fuel ')) {
        const parsed = this.parseFuelValue(code.substring(5))
        if (parsed) {
          this.setFuel(parsed)
        } else {
          this.showError('Invalid amount. Use: fuel [number] or fuel [percent%]')
        }
      } else if (normalizedCode.startsWith('medics ')) {
        const amount = this.parseAmount(normalizedCode.substring(7))
        if (amount !== null) {
          this.setSelectedAmbulanceMedics(amount)
        } else {
          this.showError('Invalid amount. Use: medics [number]')
        }
      } else if (normalizedCode === 'kill') {
        this.killSelectedTargets()
      } else {
        const spawn = this.parseSpawnCommand(code)
        if (spawn) {
          this.spawnUnitsAroundCursor(spawn.unitType, spawn.count, spawn.owner)
        } else if (normalizedCode.startsWith('party ')) {
          const target = normalizedCode.substring(6).trim()
          const owner = this.resolvePartyAlias(target)
          if (owner) {
            this.setSelectedParty(owner)
          } else {
            this.showError('Invalid party. Use: party [green|red|blue|yellow|player1|player2|player3|player4]')
          }
        } else if (normalizedCode === 'enemycontrol on') {
          this.enableEnemyControl()
        } else if (normalizedCode === 'enemycontrol off') {
          this.disableEnemyControl()
        } else if (['driver', 'commander', 'loader', 'gunner'].includes(normalizedCode)) {
          this.toggleCrewMember(normalizedCode)
        } else if (normalizedCode === 'status') {
          this.showStatus()
        } else {
          this.showError(`Unknown cheat code: "${code}"`)
        }
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

  parseFuelValue(input) {
    if (!input) return null
    const trimmed = input.trim()
    if (trimmed.endsWith('%')) {
      const percent = parseFloat(trimmed.slice(0, -1))
      if (isNaN(percent)) return null
      return { value: percent / 100, isPercent: true, display: `${percent}%` }
    }
    const amount = this.parseAmount(trimmed)
    if (amount === null) return null
    return { value: amount, isPercent: false, display: `${amount}` }
  }

  parseSpawnCommand(input) {
    if (!input) return null
    const tokens = input.trim().split(/\s+/)
    if (tokens.length === 0) return null
    const rawType = tokens[0]

    // Create a case-insensitive map of allowed unit types on first use
    if (!this.unitTypeMap) {
      this.unitTypeMap = Object.keys(UNIT_PROPERTIES).reduce((acc, key) => {
        acc[key.toLowerCase()] = key
        return acc
      }, {})
    }

    const unitType = this.unitTypeMap[rawType.toLowerCase()]
    if (!unitType) return null

    let count = 1
    let owner = gameState.humanPlayer
    if (tokens.length >= 2) {
      const maybeNum = parseInt(tokens[1], 10)
      if (!isNaN(maybeNum)) {
        count = Math.max(1, maybeNum)
        if (tokens.length >= 3) {
          owner = this.resolvePartyAlias(tokens[2]) || owner
        }
      } else {
        owner = this.resolvePartyAlias(tokens[1]) || owner
      }
    }
    return { unitType, count, owner }
  }

  resolvePartyAlias(alias) {
    if (!alias) return null
    const map = {
      player1: 'player1',
      player2: 'player2',
      player3: 'player3',
      player4: 'player4',
      green: 'player1',
      red: 'player2',
      blue: 'player3',
      yellow: 'player4',
      player: 'player1',
      enemy: 'player2'
    }
    return map[alias.toLowerCase()] || null
  }

  getPartyDisplayName(owner) {
    const displayNames = {
      player1: 'Green (Player 1)',
      player2: 'Red (Player 2)',
      player3: 'Blue (Player 3)',
      player4: 'Yellow (Player 4)',
      player: 'Green (Player 1)',
      enemy: 'Red (Player 2)'
    }
    return displayNames[owner] || owner
  }

  isValidSpawnPosition(x, y) {
    const mapGrid = gameState.mapGrid
    if (
      x < 0 ||
      y < 0 ||
      y >= mapGrid.length ||
      x >= mapGrid[0].length
    ) {
      return false
    }

    const tile = mapGrid[y][x]
    if (tile.type !== 'land' && tile.type !== 'street') return false
    if (tile.seedCrystal) return false

    const occupied = units.some(
      u => Math.floor(u.x / TILE_SIZE) === x && Math.floor(u.y / TILE_SIZE) === y
    )
    return !occupied
  }

  findSpawnPositionNear(x, y) {
    if (this.isValidSpawnPosition(x, y)) return { x, y }

    for (let distance = 1; distance <= 5; distance++) {
      for (const dir of DIRECTIONS) {
        const nx = x + dir.x * distance
        const ny = y + dir.y * distance
        if (this.isValidSpawnPosition(nx, ny)) return { x: nx, y: ny }
      }
    }

    for (let distance = 6; distance <= MAX_SPAWN_SEARCH_DISTANCE; distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        for (let dy = -distance; dy <= distance; dy++) {
          if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue
          const nx = x + dx
          const ny = y + dy
          if (this.isValidSpawnPosition(nx, ny)) return { x: nx, y: ny }
        }
      }
    }
    return null
  }

  spawnUnitsAroundCursor(unitType, count, owner) {
    const baseX = Math.floor(gameState.cursorX / TILE_SIZE)
    const baseY = Math.floor(gameState.cursorY / TILE_SIZE)

    let spawned = 0
    const spawnedRecoveryTanks = []

    for (let i = 0; i < count; i++) {
      const pos = this.findSpawnPositionNear(baseX, baseY)
      if (!pos) break
      const newUnit = createUnit({ id: owner }, unitType, pos.x, pos.y)
      units.push(newUnit)

      // Update the occupancy map for the newly spawned unit
      // Avoid double incrementing the spawn tile by letting
      // updateUnitOccupancy handle the addition.
      updateUnitOccupancy(newUnit, -1, -1, gameState.occupancyMap)
      this.updateNewUnit(newUnit)

      // Special initialization for recovery tanks
      if (unitType === 'recoveryTank' && owner !== gameState.humanPlayer) {
        newUnit.lastRecoveryCommandTime = 0
        newUnit.freshlySpawned = true
        newUnit.holdInFactory = false
        newUnit.spawnedInFactory = false
        spawnedRecoveryTanks.push(newUnit)
      }

      spawned++
    }

    if (spawned > 0) {
      showNotification(
        `🚀 Spawned ${spawned} ${unitType}${spawned > 1 ? 's' : ''} for ${owner}`,
        3000
      )

      // Trigger immediate assignment for enemy recovery tanks
      if (spawnedRecoveryTanks.length > 0) {
        // Dynamically import and call the recovery tank management
        import('../ai/enemyStrategies.js').then(module => {
          const { manageAIRecoveryTanks } = module
          const now = performance?.now ? performance.now() : Date.now()

          // Multiple attempts to ensure assignment
          setTimeout(() => manageAIRecoveryTanks(units, gameState, gameState.mapGrid, now), 50)
          setTimeout(() => manageAIRecoveryTanks(units, gameState, gameState.mapGrid, now), 200)
          setTimeout(() => manageAIRecoveryTanks(units, gameState, gameState.mapGrid, now), 500)

          console.log(`✓ Triggered immediate recovery tank assignment for ${spawnedRecoveryTanks.length} cheat-spawned tanks`)
        }).catch(err => {
          console.error('Failed to load recovery tank management:', err)
        })
      }
    } else {
      this.showError('No valid spawn position found')
    }
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
      if (unit.owner === gameState.humanPlayer) {
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
  }

  disableGodMode() {
    if (!this.godModeEnabled) {
      showNotification('🛡️ God mode is already disabled', 3000)
      return
    }

    this.godModeEnabled = false

    // Restore original health values
    units.forEach(unit => {
      if (unit.owner === gameState.humanPlayer) {
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
  }

  addMoney(amount, owner = gameState.humanPlayer) {
    if (!owner || owner === gameState.humanPlayer) {
      gameState.money += amount
      gameState.totalMoneyEarned += amount

      showNotification(`💰 Added $${amount.toLocaleString()} (Total: $${gameState.money.toLocaleString()})`, 3000)
      playSound('deposit', 0.8)
      if (productionQueue && typeof productionQueue.tryResumeProduction === 'function') {
        productionQueue.tryResumeProduction()
      }
      return true
    }

    const targetFactory = Array.isArray(gameState.factories)
      ? gameState.factories.find(factory => (factory.owner || factory.id) === owner)
      : null

    if (targetFactory && typeof targetFactory.budget === 'number') {
      targetFactory.budget += amount

      showNotification(
        `💰 Added $${amount.toLocaleString()} to ${this.getPartyDisplayName(owner)} ` +
        `(Total: $${Math.round(targetFactory.budget).toLocaleString()})`,
        3000
      )
      playSound('deposit', 0.8)
      return true
    }

    return false
  }

  setMoney(amount) {
    gameState.money = amount

    showNotification(`💰 Money set to $${amount.toLocaleString()}`, 3000)
    playSound('deposit', 0.8)
    if (productionQueue && typeof productionQueue.tryResumeProduction === 'function') {
      productionQueue.tryResumeProduction()
    }
  }

  setFuel(parsed) {
    const { value, isPercent, display } = parsed

    let selected = []
    if (typeof window !== 'undefined' && window.debugGetSelectedUnits) {
      try {
        selected = window.debugGetSelectedUnits()
      } catch {
        selected = []
      }
    }

    if (!selected || selected.length === 0) {
      this.showError('No unit selected')
      return
    }

    selected.forEach(unit => {
      if (typeof unit.maxGas === 'number') {
        const target = isPercent ? unit.maxGas * value : value
        const clamped = Math.max(0, Math.min(target, unit.maxGas))
        unit.gas = clamped
        if (clamped > 0) unit.outOfGasPlayed = false
      }
    })

    showNotification(`⛽ Fuel set to ${display} for ${selected.length} unit${selected.length > 1 ? 's' : ''}`,
      3000)
    playSound('confirmed', 0.5)
  }

  setSelectedAmbulanceMedics(amount) {
    let selected = []
    if (typeof window !== 'undefined' && window.debugGetSelectedUnits) {
      try {
        selected = window.debugGetSelectedUnits()
      } catch {
        selected = []
      }
    }

    if (!selected || selected.length === 0) {
      this.showError('No unit selected')
      return
    }

    let appliedCount = 0
    selected.forEach(unit => {
      if (unit.type === 'ambulance' && typeof unit.maxMedics === 'number') {
        const clamped = Math.min(Math.max(amount, 0), unit.maxMedics)
        unit.medics = clamped
        appliedCount++
      }
    })

    if (appliedCount > 0) {
      showNotification(`🚑 Medics set to ${amount} for ${appliedCount} ambulance${appliedCount > 1 ? 's' : ''}`, 3000)
      playSound('confirmed', 0.5)
    } else {
      this.showError('No ambulances selected')
    }
  }

  enableEnemyControl() {
    if (ENABLE_ENEMY_CONTROL) {
      showNotification('Enemy control already enabled', 3000)
      return
    }
    setEnemyControlEnabled(true)
    showNotification('Enemy control ENABLED', 3000)
  }

  disableEnemyControl() {
    if (!ENABLE_ENEMY_CONTROL) {
      showNotification('Enemy control already disabled', 3000)
      return
    }
    setEnemyControlEnabled(false)
    showNotification('Enemy control DISABLED', 3000)
  }

  showStatus() {
    const statusLines = [
      `💰 Money: $${gameState.money.toLocaleString()}`,
      `🛡️ God Mode: ${this.godModeEnabled ? 'ENABLED' : 'DISABLED'}`,
      `👥 Player Units: ${units.filter(u => u.owner === gameState.humanPlayer).length}`,
      `🤖 AI Units: ${units.filter(u => u.owner !== gameState.humanPlayer).length}`,
      `🏭 Player Buildings: ${gameState.buildings.filter(b => b.owner === gameState.humanPlayer).length}`,
      `🎮 Enemy Control: ${ENABLE_ENEMY_CONTROL ? 'ENABLED' : 'DISABLED'}`
    ]

    showNotification(statusLines.join('\n'), 5000)
  }

  setSelectedUnitsRef(selectedUnits) {
    this.selectedUnits = selectedUnits
  }

  setSelectedUnitsHP(amount, isPercent = false) {
    if (!this.selectedUnits || this.selectedUnits.length === 0) {
      this.showError('No unit selected')
      return
    }

    let appliedCount = 0
    this.selectedUnits.forEach(unit => {
      if (!unit || unit.maxHealth === undefined) return
      let newHp = amount
      if (isPercent) {
        newHp = Math.round(unit.maxHealth * (amount / 100))
      }
      const clamped = Math.min(Math.max(newHp, 0), unit.maxHealth)
      unit.health = clamped
      updateUnitSpeedModifier(unit)
      appliedCount++
    })

    if (appliedCount > 0) {
      const label = isPercent ? `${amount}%` : `${amount}`
      showNotification(`❤ Set HP to ${label} for ${appliedCount} unit(s)`, 3000)
    }
  }

  setSelectedParty(owner) {
    if (!this.selectedUnits || this.selectedUnits.length === 0) {
      this.showError('No unit selected')
      return
    }

    let changed = 0
    this.selectedUnits.forEach(unit => {
      if (!unit || unit.owner === undefined) return
      unit.owner = owner
      // Update god mode tracking when ownership changes
      if (this.godModeEnabled && unit.id) {
        if (owner === gameState.humanPlayer) {
          this.godModeUnits.add(unit.id)
        } else {
          this.godModeUnits.delete(unit.id)
        }
      }
      changed++
    })

    if (changed > 0) {
      if (Array.isArray(gameState.buildings) && gameState.buildings.length > 0) {
        updatePowerSupply(gameState.buildings, gameState)
      }
      showNotification(`🎨 Changed party to ${owner} for ${changed} item(s)`, 3000)
    }
  }

  killSelectedTargets() {
    if (!this.selectedUnits || this.selectedUnits.length === 0) {
      this.showError('No unit selected')
      return
    }

    const targets = [...this.selectedUnits]
    let destroyedUnits = 0
    let destroyedBuildings = 0

    targets.forEach(target => {
      if (!target || typeof target.health !== 'number') return

      const alreadyDestroyed = target.health <= 0 || target.destroyed === true
      if (alreadyDestroyed) return

      if (target.isBuilding) {
        destroyedBuildings++
      } else {
        destroyedUnits++
      }

      target.health = 0
      target.destroyed = true
      if (target.selected) {
        target.selected = false
      }
    })

    const totalDestroyed = destroyedUnits + destroyedBuildings
    if (totalDestroyed === 0) {
      this.showError('No valid targets selected')
      return
    }

    this.selectedUnits.length = 0

    if (gameState) {
      gameState.selectionActive = false
      gameState.selectionStart = { x: 0, y: 0 }
      gameState.selectionEnd = { x: 0, y: 0 }
    }

    const parts = []
    if (destroyedUnits > 0) {
      parts.push(`${destroyedUnits} unit${destroyedUnits === 1 ? '' : 's'}`)
    }
    if (destroyedBuildings > 0) {
      parts.push(`${destroyedBuildings} building${destroyedBuildings === 1 ? '' : 's'}`)
    }

    showNotification(`💥 Destroyed ${parts.join(' and ')}`, 4000)
    playSound('explosion', 0.7)
  }

  showError(message) {
    showNotification(`❌ ${message}`, 3000)
    playSound('error', 0.5)
  }

  // Hook into unit damage to prevent damage when god mode is enabled
  preventDamage(target, damage) {
    if (!this.godModeEnabled) return damage

    // Handle units
    if (target.owner === gameState.humanPlayer && target.id && this.godModeUnits.has(target.id)) {
      return 0 // Prevent all damage to player units
    }

    // Handle buildings (buildings have owner but different structure)
    if (target.owner === gameState.humanPlayer && target.type && !target.id) {
      return 0 // Prevent all damage to player buildings
    }

    // Handle factories (factories use id as human player ID)
    if (target.id === gameState.humanPlayer) {
      return 0 // Prevent all damage to player factory
    }

    return damage // Allow normal damage
  }

  // Update god mode for new units
  updateNewUnit(unit) {
    if (this.godModeEnabled && unit.owner === gameState.humanPlayer) {
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

  toggleCrewMember(role) {
    let selected = []
    try {
      if (typeof window !== 'undefined' && window.debugGetSelectedUnits) {
        selected = window.debugGetSelectedUnits()
      }
    } catch {
      selected = []
    }

    if (!selected || selected.length === 0) {
      this.showError('No unit selected')
      return
    }

    selected.forEach(unit => {
      if (unit.crew && typeof unit.crew === 'object' && role in unit.crew) {
        unit.crew[role] = !unit.crew[role]

        if (!unit.crew[role] && unit.owner === gameState.humanPlayer) {
          playSound('our' + role.charAt(0).toUpperCase() + role.slice(1) + 'IsOut')
        }

        const state = unit.crew[role] ? 'restored' : 'removed'
        showNotification(`${role} ${state}`, 2000)
      }
    })
  }
}
