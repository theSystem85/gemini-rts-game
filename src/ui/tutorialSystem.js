import { gameState } from '../gameState.js'
import { productionQueue } from '../productionQueue.js'
import { buildingData, canPlaceBuilding } from '../buildings.js'
import { selectedUnits, getUnitCommandsHandler } from '../inputHandler.js'
import { unitCosts } from '../units.js'
import { setRemoteControlAction, clearRemoteControlSource } from '../input/remoteControlState.js'
import { TILE_SIZE } from '../config.js'
import { getPlayableViewportHeight, getPlayableViewportWidth } from '../utils/layoutMetrics.js'

const TUTORIAL_SETTINGS_KEY = 'rts_tutorial_settings'
const TUTORIAL_PROGRESS_KEY = 'rts_tutorial_progress'
const TUTORIAL_POSITION_KEY = 'rts_tutorial_position'
const TUTORIAL_REMOTE_SOURCE = 'tutorial'

const DEFAULT_SETTINGS = {
  showTutorial: true,
  speechEnabled: true,
  selectedVoice: null
}

const DEFAULT_PROGRESS = {
  completed: false,
  stepIndex: 0
}

function readFromStorage(key, fallback) {
  if (typeof localStorage === 'undefined') {
    return fallback
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch (err) {
    window.logger?.warn?.('Failed to read tutorial storage:', err)
    return fallback
  }
}

function writeToStorage(key, payload) {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (err) {
    window.logger?.warn?.('Failed to write tutorial storage:', err)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getIsTouchLayout() {
  return Boolean(document.body?.classList.contains('is-touch'))
}

function getTextForDevice(step) {
  if (!step?.text) return ''
  if (typeof step.text === 'string') return step.text
  return getIsTouchLayout() ? step.text.mobile : step.text.desktop
}

function getSpokenTextForStep(step) {
  const mainText = getTextForDevice(step).trim()
  const hintText = (step?.hint || '').trim()
  if (mainText && hintText) {
    return `${mainText} ${hintText}`
  }
  return mainText || hintText
}

function getBoundingCenter(element) {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
}

function getCanvasPointForTile(tileX, tileY) {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const clientX = rect.left + (tileX * 32) - gameState.scrollOffset.x + 16
  const clientY = rect.top + (tileY * 32) - gameState.scrollOffset.y + 16
  return { x: clientX, y: clientY }
}

function getPlayerCrewSnapshot() {
  return new Map((gameState.units || [])
    .filter(unit => unit.crew && typeof unit.crew === 'object' && isHumanOwner(unit.owner))
    .map(unit => [unit.id, { ...unit.crew }]))
}

function focusCameraOnPoint(point) {
  if (!point) return
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) return
  const mapGrid = gameState.mapGrid
  if (!mapGrid || mapGrid.length === 0) return
  const viewportWidth = getPlayableViewportWidth(canvas)
  const viewportHeight = getPlayableViewportHeight(canvas)
  if (!viewportWidth || !viewportHeight) return
  const mapWidth = mapGrid[0].length * TILE_SIZE
  const mapHeight = mapGrid.length * TILE_SIZE
  const maxScrollX = Math.max(0, mapWidth - viewportWidth)
  const maxScrollY = Math.max(0, mapHeight - viewportHeight)
  const targetX = Math.max(0, Math.min(point.x - viewportWidth / 2, maxScrollX))
  const targetY = Math.max(0, Math.min(point.y - viewportHeight / 2, maxScrollY))

  gameState.dragVelocity.x = 0
  gameState.dragVelocity.y = 0

  if (gameState.smoothScroll) {
    gameState.smoothScroll.targetX = targetX
    gameState.smoothScroll.targetY = targetY
    gameState.smoothScroll.active = true
  } else {
    gameState.scrollOffset.x = targetX
    gameState.scrollOffset.y = targetY
  }
}

function focusCameraOnUnit(unit) {
  if (!unit) return
  const centerX = unit.x + TILE_SIZE / 2
  const centerY = unit.y + TILE_SIZE / 2
  focusCameraOnPoint({ x: centerX, y: centerY })
}

function dispatchMouseEvent(target, type, point, options = {}) {
  if (!target || !point) return
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: options.button || 0,
    buttons: options.buttons || 1,
    shiftKey: options.shiftKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false
  })
  target.dispatchEvent(event)
}

function dispatchClick(target) {
  if (!target) return
  const point = getBoundingCenter(target)
  dispatchMouseEvent(target, 'mousedown', point, { button: 0 })
  dispatchMouseEvent(target, 'mouseup', point, { button: 0, buttons: 0 })
  target.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y
  }))
}

function dispatchCanvasDrag(start, end) {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas || !start || !end) return
  dispatchMouseEvent(canvas, 'mousedown', start, { button: 0 })
  dispatchMouseEvent(canvas, 'mousemove', end, { button: 0, buttons: 1 })
  dispatchMouseEvent(canvas, 'mouseup', end, { button: 0, buttons: 0 })
}

function dispatchCanvasClick(point, options = {}) {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas || !point) return
  dispatchMouseEvent(canvas, 'mousedown', point, { button: options.button || 0 })
  dispatchMouseEvent(canvas, 'mouseup', point, { button: options.button || 0, buttons: 0 })
}

function getHumanPlayer() {
  return gameState.humanPlayer || 'player1'
}

function isHumanOwner(owner) {
  const human = getHumanPlayer()
  return owner === human || (human === 'player1' && owner === 'player')
}

function countPlayerBuildings(type) {
  return (gameState.buildings || []).filter(building => building.type === type && isHumanOwner(building.owner)).length
}

function countPlayerUnits(type) {
  return (gameState.units || []).filter(unit => unit.type === type && isHumanOwner(unit.owner)).length
}

function findPlayerBuilding(type) {
  return (gameState.buildings || []).find(building => building.type === type && isHumanOwner(building.owner))
}

function findPlayerUnit(type) {
  return (gameState.units || []).find(unit => unit.type === type && isHumanOwner(unit.owner))
}

function findEnemyTarget() {
  return (gameState.buildings || []).find(building => !isHumanOwner(building.owner) && building.health > 0)
}

function findBuildLocation(type) {
  const mapGrid = gameState.mapGrid
  if (!mapGrid || mapGrid.length === 0) return null
  const origin = findPlayerBuilding('constructionYard') || gameState.buildings?.find(b => isHumanOwner(b.owner))
  const baseX = origin ? origin.x : Math.floor(mapGrid[0].length / 2)
  const baseY = origin ? origin.y : Math.floor(mapGrid.length / 2)
  const maxRadius = 12
  for (let radius = 2; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const tileX = baseX + dx
        const tileY = baseY + dy
        if (canPlaceBuilding(type, tileX, tileY, mapGrid, gameState.units, gameState.buildings, gameState.factories, getHumanPlayer())) {
          return { x: tileX, y: tileY }
        }
      }
    }
  }
  return null
}

function findNearestOreTile(fromTile) {
  const mapGrid = gameState.mapGrid
  if (!mapGrid || mapGrid.length === 0) return null
  let best = null
  let bestDist = Number.POSITIVE_INFINITY
  for (let y = 0; y < mapGrid.length; y += 1) {
    for (let x = 0; x < mapGrid[0].length; x += 1) {
      if (!mapGrid[y][x].ore) continue
      const dx = x - fromTile.x
      const dy = y - fromTile.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = { x, y }
      }
    }
  }
  return best
}

function getUnitTile(unit) {
  if (!unit) return null
  return {
    x: Math.floor((unit.x + 16) / 32),
    y: Math.floor((unit.y + 16) / 32)
  }
}

function ensureTutorialUnits(count, type = 'harvester') {
  const existing = countPlayerUnits(type)
  if (existing >= count) return
  const button = document.querySelector(`.production-button[data-unit-type="${type}"]`)
  if (!button) return
  const toCreate = count - existing
  for (let i = 0; i < toCreate; i += 1) {
    productionQueue.addItem(type, button, false)
    const unitCost = unitCosts?.[type] || 0
    if (unitCost) {
      gameState.money = Math.max(0, gameState.money - unitCost)
    }
    productionQueue.completeCurrentUnitProduction()
  }
}

class TutorialSystem {
  constructor() {
    this.settings = readFromStorage(TUTORIAL_SETTINGS_KEY, DEFAULT_SETTINGS)
    this.progress = readFromStorage(TUTORIAL_PROGRESS_KEY, DEFAULT_PROGRESS)
    this.position = readFromStorage(TUTORIAL_POSITION_KEY, { left: 'calc(var(--sidebar-width) + 20px)', top: 'auto', bottom: '20px', right: 'auto' })
    this.active = false
    this.phase = 'demo'
    this.stepIndex = this.progress.stepIndex || 0
    this.overlay = null
    this.cursor = null
    this.card = null
    this.dockButton = null
    this.stepTitle = null
    this.stepText = null
    this.stepHint = null
    this.stepCount = null
    this.stepPhase = null
    this.nextButton = null
    this.skipButton = null
    this.skipStepButton = null
    this.backButton = null
    this.minimizeButton = null
    this.voiceToggleButton = null
    this.highlighted = null
    this.lastAction = null
    this.stepState = {}
    this.animationFrame = null
    this.speaking = false
    this.minimized = false
    this.steps = this.buildSteps()
  }

  init() {
    this.createUI()
    this.bindSettingsControls()
    this.bindActionTracking()

    // Hide dock button if tutorial is disabled or completed
    if ((!this.settings.showTutorial || this.progress.completed) && this.dockButton) {
      this.dockButton.hidden = true
    }

    // Only start tutorial if enabled and not completed
    if (this.settings.showTutorial && !this.progress.completed) {
      setTimeout(() => this.start({ resume: true }), 600)
    } else {
      // Ensure overlay is hidden when tutorial is completed or disabled
      this.hideUI()
    }
  }

  createUI() {
    if (document.getElementById('tutorialOverlay')) {
      this.overlay = document.getElementById('tutorialOverlay')
      this.cursor = document.getElementById('tutorialCursor')
      this.card = this.overlay.querySelector('.tutorial-card')
      this.dockButton = document.getElementById('tutorialDock')
      this.stepTitle = this.overlay.querySelector('.tutorial-title')
      this.stepText = this.overlay.querySelector('.tutorial-text')
      this.stepHint = this.overlay.querySelector('.tutorial-hint')
      this.stepProgress = this.overlay.querySelector('.tutorial-progress')
      this.stepProgressFill = this.overlay.querySelector('.tutorial-progress-fill')
      this.stepProgressLabel = this.overlay.querySelector('.tutorial-progress-label')
      this.stepCount = this.overlay.querySelector('.tutorial-step-count')
      this.stepPhase = this.overlay.querySelector('.tutorial-phase')
      this.nextButton = this.overlay.querySelector('[data-tutorial-action="next"]')
      this.skipButton = this.overlay.querySelector('[data-tutorial-action="skip"]')
      this.skipStepButton = this.overlay.querySelector('[data-tutorial-action="skip-step"]')
      this.backButton = this.overlay.querySelector('[data-tutorial-action="back"]')
      this.minimizeButton = this.overlay.querySelector('[data-tutorial-action="minimize"]')
      this.voiceToggleButton = this.overlay.querySelector('[data-tutorial-action="voice-toggle"]')
      if (this.minimizeButton) {
        this.minimizeButton.addEventListener('click', () => this.toggleMinimize())
      }
      if (this.voiceToggleButton) {
        this.voiceToggleButton.addEventListener('click', () => this.toggleVoice())
      }
      if (this.backButton) {
        this.backButton.addEventListener('click', () => this.goToPreviousStep())
      }
      if (this.dockButton) {
        this.dockButton.addEventListener('click', () => this.toggleMinimize())
      }
      this.setupDragHandlers()
      return
    }

    const overlay = document.createElement('div')
    overlay.id = 'tutorialOverlay'
    overlay.className = 'tutorial-overlay'

    const card = document.createElement('div')
    card.className = 'tutorial-card'

    const header = document.createElement('div')
    header.className = 'tutorial-header'

    const stepCount = document.createElement('span')
    stepCount.className = 'tutorial-step-count'

    const stepPhase = document.createElement('span')
    stepPhase.className = 'tutorial-phase'

    const minimizeButton = document.createElement('button')
    minimizeButton.type = 'button'
    minimizeButton.className = 'tutorial-minimize'
    minimizeButton.textContent = 'Minimize'
    minimizeButton.setAttribute('data-tutorial-action', 'minimize')
    minimizeButton.setAttribute('aria-pressed', 'false')

    const voiceToggleButton = document.createElement('button')
    voiceToggleButton.type = 'button'
    voiceToggleButton.className = 'tutorial-voice-toggle'
    voiceToggleButton.textContent = 'Voice: On'
    voiceToggleButton.setAttribute('data-tutorial-action', 'voice-toggle')
    voiceToggleButton.setAttribute('aria-pressed', 'true')

    header.appendChild(stepCount)
    header.appendChild(stepPhase)
    header.appendChild(voiceToggleButton)
    header.appendChild(minimizeButton)

    const title = document.createElement('h3')
    title.className = 'tutorial-title'

    const text = document.createElement('p')
    text.className = 'tutorial-text'

    const hint = document.createElement('p')
    hint.className = 'tutorial-hint'

    const progress = document.createElement('div')
    progress.className = 'tutorial-progress'

    const progressLabel = document.createElement('span')
    progressLabel.className = 'tutorial-progress-label'

    const progressTrack = document.createElement('div')
    progressTrack.className = 'tutorial-progress-track'

    const progressFill = document.createElement('div')
    progressFill.className = 'tutorial-progress-fill'

    progressTrack.appendChild(progressFill)
    progress.appendChild(progressLabel)
    progress.appendChild(progressTrack)

    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

    const backButton = document.createElement('button')
    backButton.type = 'button'
    backButton.className = 'tutorial-button tutorial-button--ghost'
    backButton.textContent = 'Back'
    backButton.setAttribute('data-tutorial-action', 'back')

    const skipStepButton = document.createElement('button')
    skipStepButton.type = 'button'
    skipStepButton.className = 'tutorial-button tutorial-button--ghost'
    skipStepButton.textContent = 'Skip step'
    skipStepButton.setAttribute('data-tutorial-action', 'skip-step')

    const skipButton = document.createElement('button')
    skipButton.type = 'button'
    skipButton.className = 'tutorial-button tutorial-button--ghost'
    skipButton.textContent = 'Skip tutorial'
    skipButton.setAttribute('data-tutorial-action', 'skip')

    const nextButton = document.createElement('button')
    nextButton.type = 'button'
    nextButton.className = 'tutorial-button tutorial-button--primary'
    nextButton.textContent = 'Continue'
    nextButton.setAttribute('data-tutorial-action', 'next')

    actions.appendChild(backButton)
    actions.appendChild(skipStepButton)
    actions.appendChild(skipButton)
    actions.appendChild(nextButton)

    card.appendChild(header)
    card.appendChild(title)
    card.appendChild(text)
    card.appendChild(hint)
    card.appendChild(progress)
    card.appendChild(actions)
    overlay.appendChild(card)

    // Apply saved position
    Object.assign(card.style, this.position)

    const dockButton = document.createElement('button')
    dockButton.id = 'tutorialDock'
    dockButton.type = 'button'
    dockButton.className = 'tutorial-dock'
    dockButton.textContent = '?'
    dockButton.hidden = true

    const cursor = document.createElement('div')
    cursor.id = 'tutorialCursor'
    cursor.className = 'tutorial-cursor'
    cursor.hidden = true
    cursor.innerHTML = '<div class="tutorial-cursor-dot"></div>'

    document.body.appendChild(overlay)
    document.body.appendChild(dockButton)
    document.body.appendChild(cursor)

    this.overlay = overlay
    this.cursor = cursor
    this.card = card
    this.dockButton = dockButton
    this.stepTitle = title
    this.stepText = text
    this.stepHint = hint
    this.stepProgress = progress
    this.stepProgressFill = progressFill
    this.stepProgressLabel = progressLabel
    this.stepCount = stepCount
    this.stepPhase = stepPhase
    this.nextButton = nextButton
    this.skipButton = skipButton
    this.skipStepButton = skipStepButton
    this.backButton = backButton
    this.minimizeButton = minimizeButton
    this.voiceToggleButton = voiceToggleButton

    nextButton.addEventListener('click', () => this.handleNext())
    skipButton.addEventListener('click', () => this.skipTutorial())
    skipStepButton.addEventListener('click', () => this.skipStep())
    backButton.addEventListener('click', () => this.goToPreviousStep())
    minimizeButton.addEventListener('click', () => this.toggleMinimize())
    voiceToggleButton.addEventListener('click', () => this.toggleVoice())
    dockButton.addEventListener('click', () => this.toggleMinimize())

    this.setupDragHandlers()
  }

  setupDragHandlers() {
    if (!this.card) return

    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let initialLeft = 0
    let initialTop = 0

    const startDrag = (clientX, clientY) => {
      isDragging = true
      dragStartX = clientX
      dragStartY = clientY
      const rect = this.card.getBoundingClientRect()
      initialLeft = rect.left
      initialTop = rect.top
      this.card.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return
      const deltaX = clientX - dragStartX
      const deltaY = clientY - dragStartY
      const newLeft = Math.max(0, Math.min(window.innerWidth - this.card.offsetWidth, initialLeft + deltaX))
      const newTop = Math.max(0, Math.min(window.innerHeight - this.card.offsetHeight, initialTop + deltaY))
      this.card.style.left = `${newLeft}px`
      this.card.style.top = `${newTop}px`
      this.card.style.bottom = 'auto'
      this.card.style.right = 'auto'
    }

    const endDrag = () => {
      if (!isDragging) return
      isDragging = false
      this.card.style.cursor = 'move'
      document.body.style.userSelect = ''
      // Save position
      this.position = {
        left: this.card.style.left,
        top: this.card.style.top,
        bottom: this.card.style.bottom,
        right: this.card.style.right
      }
      writeToStorage(TUTORIAL_POSITION_KEY, this.position)
    }

    // Mouse events
    this.card.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
      e.preventDefault()
      startDrag(e.clientX, e.clientY)
    })

    document.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX, e.clientY)
    })

    document.addEventListener('mouseup', endDrag)

    // Touch events
    this.card.addEventListener('touchstart', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
      e.preventDefault()
      const touch = e.touches[0]
      startDrag(touch.clientX, touch.clientY)
    }, { passive: false })

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return
      e.preventDefault()
      const touch = e.touches[0]
      moveDrag(touch.clientX, touch.clientY)
    }, { passive: false })

    document.addEventListener('touchend', endDrag)
  }

  bindSettingsControls() {
    const showToggle = document.getElementById('tutorialShowOnStartup')
    const speechToggle = document.getElementById('tutorialSpeechEnabled')
    const startButton = document.getElementById('tutorialStartBtn')
    const restartButton = document.getElementById('tutorialRestartBtn')

    if (showToggle) {
      showToggle.checked = this.settings.showTutorial
      showToggle.addEventListener('change', () => {
        this.settings.showTutorial = Boolean(showToggle.checked)
        writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
        if (!this.settings.showTutorial) {
          this.stop()
        }
        if (startButton) {
          startButton.disabled = !this.settings.showTutorial
        }
        if (restartButton) {
          restartButton.disabled = !this.settings.showTutorial
        }
      })
    }

    if (speechToggle) {
      speechToggle.checked = this.settings.speechEnabled
      speechToggle.addEventListener('change', () => {
        this.settings.speechEnabled = Boolean(speechToggle.checked)
        if (!this.settings.speechEnabled) {
          window.speechSynthesis?.cancel?.()
        }
        writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
      })
    }

    const voiceSelect = document.getElementById('tutorialVoiceSelect')
    if (voiceSelect) {
      // Populate voices - filter to English only
      const populateVoices = () => {
        const allVoices = window.speechSynthesis?.getVoices?.() || []
        const englishVoices = allVoices.filter(voice => voice.lang.startsWith('en'))
        voiceSelect.innerHTML = '<option value="">Browser Default</option>'
        
        // Auto-select preferred voice if no voice is stored
        if (this.settings.selectedVoice === null || this.settings.selectedVoice === undefined) {
          // Priority 1: Google US English (en-US)
          let preferredVoice = allVoices.findIndex(v => 
            v.name.toLowerCase().includes('google') && 
            v.name.toLowerCase().includes('us') &&
            v.lang.toLowerCase().startsWith('en-us')
          )
          
          // Priority 2: Any Google English voice
          if (preferredVoice === -1) {
            preferredVoice = allVoices.findIndex(v => 
              v.name.toLowerCase().includes('google') && 
              v.lang.toLowerCase().startsWith('en')
            )
          }
          
          // Priority 3: Any available English voice
          if (preferredVoice === -1 && englishVoices.length > 0) {
            preferredVoice = allVoices.indexOf(englishVoices[0])
          }
          
          // Store the auto-selected voice
          if (preferredVoice !== -1) {
            this.settings.selectedVoice = preferredVoice
            writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
          }
        }
        
        englishVoices.forEach((voice) => {
          // Find original index in full voices array for proper selection
          const originalIndex = allVoices.indexOf(voice)
          const option = document.createElement('option')
          option.value = originalIndex
          option.textContent = `${voice.name} (${voice.lang})`
          if (this.settings.selectedVoice === originalIndex) {
            option.selected = true
          }
          voiceSelect.appendChild(option)
        })
      }
      
      // Voices may load asynchronously
      if (window.speechSynthesis) {
        populateVoices()
        window.speechSynthesis.onvoiceschanged = populateVoices
      }
      
      voiceSelect.addEventListener('change', () => {
        const value = voiceSelect.value
        this.settings.selectedVoice = value === '' ? null : parseInt(value, 10)
        writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
      })
    }

    if (startButton) {
      startButton.disabled = !this.settings.showTutorial
      startButton.addEventListener('click', () => {
        this.start({ reset: false, manual: true })
      })
    }

    if (restartButton) {
      restartButton.disabled = !this.settings.showTutorial
      restartButton.addEventListener('click', () => {
        this.start({ reset: true, manual: true })
      })
    }
  }

  bindActionTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      if (target.closest('#moneyBarContainer') || target.closest('#mobileMoneyDisplay')) {
        this.lastAction = 'money'
      }
      if (target.closest('#energyBarContainer') || target.closest('#mobileEnergyBarContainer')) {
        this.lastAction = 'energy'
      }

      const productionButton = target.closest('.production-button')
      if (productionButton) {
        const buildingType = productionButton.getAttribute('data-building-type')
        const unitType = productionButton.getAttribute('data-unit-type')
        if (buildingType) {
          this.lastAction = `building:${buildingType}`
        }
        if (unitType) {
          this.lastAction = `unit:${unitType}`
        }
      }
    })
  }

  start({ reset = false, resume = false, manual = false } = {}) {
    if (!this.settings.showTutorial) {
      this.stop()
      return
    }
    
    // Don't allow starting if completed (unless reset or manual restart)
    if (this.progress.completed && !reset && !manual) {
      this.hideUI()
      return
    }
    
    if (reset) {
      this.progress = { ...DEFAULT_PROGRESS }
      this.stepIndex = 0
      this.progress.completed = false
      writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    } else if (resume) {
      this.stepIndex = this.progress.stepIndex || 0
    }

    // Validate step exists before showing UI
    const step = this.steps[this.stepIndex]
    if (!step || !step.title) {
      this.stop()
      return
    }

    this.active = true
    this.showUI()
    this.runCurrentStep()
  }

  showUI() {
    if (this.overlay) {
      this.overlay.hidden = false
      this.overlay.classList.remove('tutorial-overlay--minimized')
    }
    if (this.cursor) {
      this.cursor.hidden = false
    }
    // Always hide dock button when tutorial overlay is visible
    if (this.dockButton) {
      this.dockButton.hidden = true
    }
    this.minimized = false
  }

  hideUI() {
    if (this.overlay) {
      this.overlay.hidden = true
    }
    if (this.cursor) {
      this.cursor.hidden = true
    }
    if (this.dockButton) {
      this.dockButton.hidden = true
    }
  }

  stop() {
    this.active = false
    this.phase = 'demo'
    this.minimized = false
    this.clearHighlight()
    this.hideUI()
    this.stopSpeech()
    if (this.overlay) {
      this.overlay.classList.remove('tutorial-overlay--minimized')
    }
    clearRemoteControlSource(TUTORIAL_REMOTE_SOURCE)
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  skipTutorial() {
    this.settings.showTutorial = false
    writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
    const showToggle = document.getElementById('tutorialShowOnStartup')
    if (showToggle) {
      showToggle.checked = false
    }
    const startButton = document.getElementById('tutorialStartBtn')
    if (startButton) {
      startButton.disabled = true
    }
    const restartButton = document.getElementById('tutorialRestartBtn')
    if (restartButton) {
      restartButton.disabled = true
    }
    this.progress.completed = true
    this.progress.stepIndex = this.steps.length
    writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    this.stop()
    // Permanently hide dock button when skipping
    if (this.dockButton) {
      this.dockButton.hidden = true
    }
  }

  skipStep() {
    this.advanceStep()
  }

  goToPreviousStep() {
    if (this.stepIndex <= 0) return
    this.stepIndex -= 1
    this.progress.stepIndex = this.stepIndex
    writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    this.runCurrentStep()
  }

  handleNext() {
    if (!this.active) return
    const step = this.steps[this.stepIndex]
    if (step && step.completion && !step.completion(this)) {
      return
    }
    this.advanceStep()
  }

  advanceStep() {
    this.stepIndex += 1
    this.progress.stepIndex = this.stepIndex
    if (this.stepIndex >= this.steps.length) {
      this.progress.completed = true
      writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
      // Speak completion message
      this.speak('Great, you completed the basic tutorial!')
      // Wait for speech to finish, then stop
      setTimeout(() => {
        this.stop()
        // Permanently hide dock button after completion
        if (this.dockButton) {
          this.dockButton.hidden = true
        }
      }, 3000)
      return
    }
    writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    this.runCurrentStep()
  }

  runCurrentStep() {
    if (!this.active) return
    const step = this.steps[this.stepIndex]
    // Never show empty tutorial - stop if no valid step
    if (!step || !step.title) {
      this.stop()
      return
    }

    this.phase = 'demo'
    this.lastAction = null
    this.stepState = {
      action: null,
      resourceClicked: new Set(),
      selectionSeen: false,
      completed: false,
      startSelectedCount: selectedUnits.length,
      startPowerPlants: countPlayerBuildings('powerPlant'),
      startRefineries: countPlayerBuildings('oreRefinery'),
      startFactories: countPlayerBuildings('vehicleFactory'),
      startHarvesters: countPlayerUnits('harvester'),
      startTanks: countPlayerUnits('tank'),
      startRallyPoint: findPlayerBuilding('vehicleFactory')?.rallyPoint || null,
      moveTargets: new Map((gameState.units || []).map(unit => [unit.id, unit.moveTarget ? { ...unit.moveTarget } : null]))
    }

    this.renderStep(step)
    this.runDemo(step)
  }

  renderStep(step) {
    if (this.stepTitle) {
      this.stepTitle.textContent = step.title
    }
    if (this.stepText) {
      this.stepText.textContent = getTextForDevice(step)
    }
    if (this.stepHint) {
      this.stepHint.textContent = step.hint || ''
    }
    this.updateStepProgress(step)
    if (this.stepCount) {
      this.stepCount.textContent = `Step ${this.stepIndex + 1} of ${this.steps.length}`
    }
    if (this.stepPhase) {
      this.stepPhase.textContent = this.phase === 'demo' ? 'Demo' : 'Your turn'
    }
    if (this.minimizeButton) {
      this.minimizeButton.textContent = this.minimized ? 'Expand' : 'Minimize'
      this.minimizeButton.setAttribute('aria-pressed', this.minimized ? 'true' : 'false')
    }
    if (this.voiceToggleButton) {
      this.voiceToggleButton.textContent = `Voice: ${this.settings.speechEnabled ? 'On' : 'Off'}`
      this.voiceToggleButton.setAttribute('aria-pressed', this.settings.speechEnabled ? 'true' : 'false')
    }

    this.updateContinueState(step)
    if (this.backButton) {
      this.backButton.disabled = this.stepIndex === 0
    }

    this.clearHighlight()
    if (step.highlightSelector) {
      const element = document.querySelector(step.highlightSelector)
      if (element) {
        element.classList.add('tutorial-highlight')
        this.highlighted = element
      }
    }
  }

  setContinueEnabled() {
    this.markStepCompleted()
    this.updateContinueState(this.steps[this.stepIndex])
  }

  toggleMinimize() {
    this.minimized = !this.minimized
    
    if (this.minimized) {
      // Minimizing: animate card out, then show dock button
      if (this.card) {
        this.card.classList.add('tutorial-card--minimizing')
        this.card.addEventListener('animationend', () => {
          this.card.classList.remove('tutorial-card--minimizing')
          if (this.overlay) {
            this.overlay.classList.add('tutorial-overlay--minimized')
            // Hide overlay completely when minimized
            this.overlay.hidden = true
          }
          // Show dock button only when minimized and tutorial active
          if (this.dockButton && this.active && this.settings.showTutorial && !this.progress.completed) {
            this.dockButton.hidden = false
            this.dockButton.classList.add('tutorial-dock--appearing')
            this.dockButton.addEventListener('animationend', () => {
              this.dockButton.classList.remove('tutorial-dock--appearing')
            }, { once: true })
          }
        }, { once: true })
      }
    } else {
      // Maximizing: hide dock button, animate card in
      if (this.dockButton) {
        this.dockButton.classList.add('tutorial-dock--disappearing')
        this.dockButton.addEventListener('animationend', () => {
          this.dockButton.classList.remove('tutorial-dock--disappearing')
          this.dockButton.hidden = true
        }, { once: true })
      }
      if (this.overlay) {
        this.overlay.classList.remove('tutorial-overlay--minimized')
        // Show overlay when maximizing
        this.overlay.hidden = false
      }
      if (this.card) {
        this.card.classList.add('tutorial-card--maximizing')
        this.card.addEventListener('animationend', () => {
          this.card.classList.remove('tutorial-card--maximizing')
        }, { once: true })
      }
    }
    
    this.renderStep(this.steps[this.stepIndex])
  }

  updateContinueState(step) {
    if (!this.nextButton) return
    if (this.phase === 'demo') {
      this.nextButton.disabled = true
      return
    }

    if (!step.completion) {
      this.nextButton.disabled = false
      return
    }

    const satisfied = this.stepState.completed || step.completion(this)
    this.nextButton.disabled = !satisfied
  }

  markStepCompleted() {
    if (this.stepState.completed) return
    this.stepState.completed = true
    if (this.nextButton) {
      this.nextButton.classList.remove('tutorial-continue--ready')
      void this.nextButton.offsetWidth
      this.nextButton.classList.add('tutorial-continue--ready')
      setTimeout(() => {
        this.nextButton?.classList.remove('tutorial-continue--ready')
      }, 1200)
    }
  }

  toggleVoice() {
    this.settings.speechEnabled = !this.settings.speechEnabled
    if (!this.settings.speechEnabled) {
      window.speechSynthesis?.cancel?.()
    }
    writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
    this.renderStep(this.steps[this.stepIndex])
  }

  clearHighlight() {
    if (this.highlighted) {
      this.highlighted.classList.remove('tutorial-highlight')
      this.highlighted = null
    }
  }

  updateStepProgress(step) {
    if (!this.stepProgress || !this.stepProgressFill || !this.stepProgressLabel) return
    if (!step?.progress) {
      this.stepProgress.hidden = true
      return
    }
    const value = Math.max(0, Math.min(1, step.progress(this)))
    this.stepProgress.hidden = false
    this.stepProgressFill.style.width = `${Math.round(value * 100)}%`
    this.stepProgressLabel.textContent = step.progressLabel || 'Progress'
  }

  trackCrewRestoration() {
    if (this.stepState.crewRestored) return true
    if (!this.stepState.crewSnapshot) {
      this.stepState.crewSnapshot = getPlayerCrewSnapshot()
      return false
    }
    const current = getPlayerCrewSnapshot()
    let restored = false
    current.forEach((crew, unitId) => {
      const previous = this.stepState.crewSnapshot.get(unitId)
      if (!previous) return
      Object.keys(crew).some(role => {
        if (previous[role] === false && crew[role] === true) {
          restored = true
          return true
        }
        return false
      })
    })
    this.stepState.crewSnapshot = current
    if (restored) {
      this.stepState.crewRestored = true
      if (!this.stepState.crewRestoredAnnounced) {
        this.stepState.crewRestoredAnnounced = true
        this.speak('Great, you completed all sub tasks of the crew system tutorial!')
      }
    }
    return this.stepState.crewRestored
  }

  async runDemo(step) {
    this.stopSpeech()
    if (step.demo) {
      await step.demo(this)
    }
    this.phase = 'practice'
    this.renderStep(step)
    this.speak(getSpokenTextForStep(step))
    this.awaitCompletion(step)
  }

  awaitCompletion(step) {
    if (!step.completion) {
      if (this.nextButton) {
        this.nextButton.disabled = false
      }
      return
    }

    const check = () => {
      if (!this.active) return
      const done = this.stepState.completed || step.completion(this)
      this.updateContinueState(step)
      this.updateStepProgress(step)
      if (done) {
        this.markStepCompleted()
        return
      }
      this.animationFrame = requestAnimationFrame(check)
    }
    this.animationFrame = requestAnimationFrame(check)
  }

  moveCursorToPoint(point) {
    if (!this.cursor || !point) return
    this.cursor.style.left = `${point.x}px`
    this.cursor.style.top = `${point.y}px`
  }

  async moveCursorToElement(element) {
    if (!element) return
    const point = getBoundingCenter(element)
    this.moveCursorToPoint(point)
    await sleep(350)
  }

  async clickElement(element) {
    if (!element) return
    await this.moveCursorToElement(element)
    this.cursor?.classList.add('tutorial-cursor--click')
    dispatchClick(element)
    await sleep(250)
    this.cursor?.classList.remove('tutorial-cursor--click')
  }

  async clickCanvasTile(tile) {
    if (!tile) return
    const point = getCanvasPointForTile(tile.x, tile.y)
    if (!point) return
    this.moveCursorToPoint(point)
    await sleep(250)
    this.cursor?.classList.add('tutorial-cursor--click')
    dispatchCanvasClick(point)
    await sleep(250)
    this.cursor?.classList.remove('tutorial-cursor--click')
  }

  speak(text) {
    if (!this.settings.speechEnabled) return
    if (!text || typeof SpeechSynthesisUtterance === 'undefined') return
    window.speechSynthesis?.cancel?.()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    
    // Apply selected voice if configured
    if (this.settings.selectedVoice !== null && this.settings.selectedVoice !== undefined) {
      const voices = window.speechSynthesis?.getVoices?.() || []
      if (voices[this.settings.selectedVoice]) {
        utterance.voice = voices[this.settings.selectedVoice]
      }
    }
    
    this.speaking = true
    utterance.onend = () => {
      this.speaking = false
    }
    window.speechSynthesis?.speak?.(utterance)
  }

  stopSpeech() {
    if (this.speaking) {
      window.speechSynthesis?.cancel?.()
      this.speaking = false
    }
  }

  async demoBuildBuilding(type) {
    const buildingTab = document.querySelector('.tab-button[data-tab="buildings"]')
    if (buildingTab) {
      await this.clickElement(buildingTab)
    }
    const button = document.querySelector(`.production-button[data-building-type="${type}"]`)
    if (!button) return
    await this.clickElement(button)

    const placement = findBuildLocation(type)
    if (!placement) return
    const blueprint = { type, x: placement.x, y: placement.y }
    const queued = productionQueue.buildingItems.find(item => item.type === type && !item.blueprint)
    if (queued) {
      queued.blueprint = blueprint
    } else {
      productionQueue.addItem(type, button, true, blueprint)
    }
    if (productionQueue.currentBuilding && productionQueue.currentBuilding.type === type) {
      productionQueue.currentBuilding.blueprint = blueprint
    }
    const cost = buildingData[type]?.cost || 0
    if (cost) {
      gameState.money = Math.max(0, gameState.money - cost)
    }
    productionQueue.completeCurrentBuildingProduction()

    await this.clickCanvasTile(placement)
  }

  async demoBuildUnit(type) {
    const unitTab = document.querySelector('.tab-button[data-tab="units"]')
    if (unitTab) {
      await this.clickElement(unitTab)
    }
    const button = document.querySelector(`.production-button[data-unit-type="${type}"]`)
    if (!button) return
    await this.clickElement(button)

    if (!productionQueue.currentUnit || productionQueue.currentUnit.type !== type) {
      productionQueue.addItem(type, button, false)
    }
    const unitCost = unitCosts?.[type] || 0
    if (unitCost) {
      gameState.money = Math.max(0, gameState.money - unitCost)
    }
    productionQueue.completeCurrentUnitProduction()
  }

  async demoSelectUnit(unit) {
    const tile = getUnitTile(unit)
    if (!tile) return
    await this.clickCanvasTile(tile)
  }

  async demoSelectGroup(units) {
    if (!units || units.length === 0) return
    const tiles = units.map(unit => getUnitTile(unit)).filter(Boolean)
    if (tiles.length === 0) return
    const minX = Math.min(...tiles.map(t => t.x))
    const minY = Math.min(...tiles.map(t => t.y))
    const maxX = Math.max(...tiles.map(t => t.x))
    const maxY = Math.max(...tiles.map(t => t.y))
    const start = getCanvasPointForTile(minX, minY)
    const end = getCanvasPointForTile(maxX + 1, maxY + 1)
    this.moveCursorToPoint(start)
    await sleep(200)
    dispatchCanvasDrag(start, end)
    await sleep(200)
  }

  async demoDeselect() {
    const tile = findBuildLocation('powerPlant') || { x: 1, y: 1 }
    const point = getCanvasPointForTile(tile.x, tile.y)
    if (!point) return
    this.moveCursorToPoint(point)
    await sleep(150)
    dispatchCanvasClick(point, { button: 2 })
  }

  buildSteps() {
    return [
      {
        id: 'welcome',
        title: 'Welcome to the Command Briefing',
        text: {
          desktop: 'This guided tutorial will show you how to build, command units, and win. Watch the demo actions, then repeat them to continue.',
          mobile: 'This guided tutorial will show you how to build, command units, and win. Watch the demo actions, then repeat them to continue.'
        },
        hint: 'You can skip any step or the full tutorial at any time.',
        completion: () => true,
        demo: async () => {
          await sleep(300)
        }
      },
      {
        id: 'resources',
        title: 'Resources & Power',
        text: {
          desktop: 'Money and energy are shown at the top of the sidebar. Low power slows production, so keep it positive.',
          mobile: 'Money and energy are shown in the status bar. Low power slows production, so keep it positive.'
        },
        hint: 'Click the money bar or energy bar to continue.',
        highlightSelector: getIsTouchLayout() ? '#mobileStatusBar' : '#moneyBarContainer',
        demo: async (ctx) => {
          const moneyTarget = document.getElementById(getIsTouchLayout() ? 'mobileMoneyDisplay' : 'moneyBarContainer')
          const energyTarget = document.getElementById(getIsTouchLayout() ? 'mobileEnergyBarContainer' : 'energyBarContainer')
          await ctx.moveCursorToElement(moneyTarget)
          await sleep(350)
          await ctx.moveCursorToElement(energyTarget)
        },
        completion: (ctx) => {
          if (ctx.lastAction === 'money' || ctx.lastAction === 'energy') {
            return true
          }
          return false
        }
      },
      {
        id: 'build-power',
        title: 'Build a Power Plant',
        text: {
          desktop: 'Open the Buildings tab and queue a Power Plant. Power is required for almost every structure.',
          mobile: 'Open the Buildings tab and queue a Power Plant. Power is required for almost every structure.'
        },
        hint: 'Click the Power Plant button to continue.',
        highlightSelector: '.production-button[data-building-type="powerPlant"]',
        demo: async (ctx) => {
          await ctx.demoBuildBuilding('powerPlant')
        },
        completion: (ctx) => ctx.lastAction === 'building:powerPlant' || countPlayerBuildings('powerPlant') > ctx.stepState.startPowerPlants
      },
      {
        id: 'build-refinery',
        title: 'Build an Ore Refinery',
        text: {
          desktop: 'Queue an Ore Refinery next. Refineries process harvested ore into money.',
          mobile: 'Queue an Ore Refinery next. Refineries process harvested ore into money.'
        },
        hint: 'Click the Ore Refinery button to continue.',
        highlightSelector: '.production-button[data-building-type="oreRefinery"]',
        demo: async (ctx) => {
          await ctx.demoBuildBuilding('oreRefinery')
        },
        completion: (ctx) => ctx.lastAction === 'building:oreRefinery' || countPlayerBuildings('oreRefinery') > ctx.stepState.startRefineries
      },
      {
        id: 'build-vehicle-factory',
        title: 'Build the Weapons Factory',
        text: {
          desktop: 'Queue the Vehicle Factory (your weapons factory). It produces tanks and all ground vehicles.',
          mobile: 'Queue the Vehicle Factory (your weapons factory). It produces tanks and all ground vehicles.'
        },
        hint: 'Click the Vehicle Factory button to continue.',
        highlightSelector: '.production-button[data-building-type="vehicleFactory"]',
        demo: async (ctx) => {
          await ctx.demoBuildBuilding('vehicleFactory')
        },
        completion: (ctx) => ctx.lastAction === 'building:vehicleFactory' || countPlayerBuildings('vehicleFactory') > ctx.stepState.startFactories
      },
      {
        id: 'build-harvester',
        title: 'Build Ore Transporters',
        text: {
          desktop: 'Queue a Harvester. Harvesters automatically drive to the nearest ore field, but you can also right-click a specific ore patch to direct them.',
          mobile: 'Queue a Harvester. Harvesters automatically drive to the nearest ore field, but you can also tap a specific ore patch to direct them.'
        },
        hint: 'Click the Harvester button to continue.',
        highlightSelector: '.production-button[data-unit-type="harvester"]',
        demo: async (ctx) => {
          await ctx.demoBuildUnit('harvester')
          const harvester = findPlayerUnit('harvester')
          const unitCommands = getUnitCommandsHandler()
          if (harvester && unitCommands) {
            await ctx.demoSelectUnit(harvester)
            const tile = getUnitTile(harvester)
            const oreTile = tile ? findNearestOreTile(tile) : null
            if (oreTile) {
              unitCommands.handleMovementCommand([harvester], oreTile.x * 32, oreTile.y * 32, gameState.mapGrid)
            }
          }
        },
        completion: (ctx) => ctx.lastAction === 'unit:harvester' || countPlayerUnits('harvester') > ctx.stepState.startHarvesters
      },
      {
        id: 'select-single',
        title: 'Select a Single Unit',
        text: {
          desktop: 'Click a unit to select it. Selection shows its status and enables commands.',
          mobile: 'Tap a unit to select it. Selection shows its status and enables commands.'
        },
        hint: 'Select any unit to continue.',
        demo: async (ctx) => {
          ensureTutorialUnits(1)
          const unit = (gameState.units || []).find(u => isHumanOwner(u.owner))
          if (unit) {
            await ctx.demoSelectUnit(unit)
          }
        },
        completion: () => selectedUnits.length > 0
      },
      {
        id: 'select-group',
        title: 'Select Multiple Units',
        text: {
          desktop: 'Drag a selection box to grab multiple units at once. You can also shift-click to add units.',
          mobile: 'Drag a selection box to grab multiple units at once. You can also tap units one-by-one to add them.'
        },
        hint: 'Select at least two units to continue.',
        demo: async (ctx) => {
          ensureTutorialUnits(2)
          const units = (gameState.units || []).filter(u => isHumanOwner(u.owner)).slice(0, 2)
          await ctx.demoSelectGroup(units)
        },
        completion: () => selectedUnits.length >= 2
      },
      {
        id: 'deselect',
        title: 'Deselect Units',
        text: {
          desktop: 'Right-click on empty ground or press Esc to clear your selection.',
          mobile: 'Tap on empty ground to clear your selection.'
        },
        hint: 'Clear the selection to continue.',
        demo: async (ctx) => {
          await ctx.demoDeselect()
        },
        completion: () => selectedUnits.length === 0
      },
      {
        id: 'move-units',
        title: 'Move Units',
        text: {
          desktop: 'Select a unit, then left-click on the map to move it.',
          mobile: 'Select a unit, then tap on the map to move it.'
        },
        hint: 'Move any selected unit to continue.',
        demo: async (ctx) => {
          ensureTutorialUnits(1)
          const unit = (gameState.units || []).find(u => isHumanOwner(u.owner))
          const unitCommands = getUnitCommandsHandler()
          if (unit && unitCommands) {
            await ctx.demoSelectUnit(unit)
            const tile = getUnitTile(unit)
            if (tile) {
              const target = { x: tile.x + 3, y: tile.y + 2 }
              unitCommands.handleMovementCommand([unit], target.x * 32, target.y * 32, gameState.mapGrid)
              await ctx.clickCanvasTile(target)
            }
          }
        },
        completion: (ctx) => {
          return selectedUnits.some(unit => {
            const previous = ctx.stepState.moveTargets.get(unit.id)
            const current = unit.moveTarget
            if (!current) return false
            if (!previous) return true
            return current.x !== previous.x || current.y !== previous.y
          })
        }
      },
      {
        id: 'tank-rally',
        title: 'Build a Tank & Set Waypoint',
        text: {
          desktop: 'Queue a Tank, then select the Vehicle Factory and left-click on the map to set a rally point.',
          mobile: 'Queue a Tank, then tap the Vehicle Factory and tap the map to set a rally point.'
        },
        hint: 'Queue a Tank or set a rally point to continue.',
        demo: async (ctx) => {
          const factory = findPlayerBuilding('vehicleFactory')
          if (factory) {
            await ctx.clickCanvasTile({ x: factory.x + 1, y: factory.y + 1 })
            await ctx.clickCanvasTile({ x: factory.x + 4, y: factory.y + 1 })
          }
          await ctx.demoBuildUnit('tank')
        },
        completion: (ctx) => {
          const factory = findPlayerBuilding('vehicleFactory')
          const rallyPoint = factory?.rallyPoint
          const rallyChanged = rallyPoint && (!ctx.stepState.startRallyPoint || rallyPoint.x !== ctx.stepState.startRallyPoint.x || rallyPoint.y !== ctx.stepState.startRallyPoint.y)
          return ctx.lastAction === 'unit:tank' || rallyChanged || countPlayerUnits('tank') > ctx.stepState.startTanks
        }
      },
      {
        id: 'tank-control',
        title: 'Command & Remote Control Tanks',
        text: {
          desktop: 'When the tank finishes, left-click to move it, or hold the arrow keys (and Space to fire) for remote control driving.',
          mobile: 'When the tank finishes, tap to move it, or use the on-screen joystick to drive it manually.'
        },
        hint: 'Move a tank and use manual control to continue.',
        demo: async (ctx) => {
          ensureTutorialUnits(1, 'tank')
          const tank = findPlayerUnit('tank')
          const unitCommands = getUnitCommandsHandler()
          if (tank && unitCommands) {
            await ctx.demoSelectUnit(tank)
            const tile = getUnitTile(tank)
            if (tile) {
              const target = { x: tile.x + 4, y: tile.y + 1 }
              unitCommands.handleMovementCommand([tank], target.x * 32, target.y * 32, gameState.mapGrid)
              await ctx.clickCanvasTile(target)
            }
            setRemoteControlAction('forward', TUTORIAL_REMOTE_SOURCE, true)
            await sleep(600)
            setRemoteControlAction('forward', TUTORIAL_REMOTE_SOURCE, false)
            ctx.stepState.remoteControlDone = true
          }
        },
        completion: (ctx) => {
          const units = (gameState.units || []).filter(unit => isHumanOwner(unit.owner))
          return ctx.stepState.remoteControlDone || units.some(unit => unit.hasUsedRemoteControl)
        }
      },
      {
        id: 'attack',
        title: 'Attack & Win the Battle',
        text: {
          desktop: 'Select your tank and right-click an enemy building to attack. The goal is to destroy all enemy buildings.',
          mobile: 'Select your tank and tap an enemy building to attack. The goal is to destroy all enemy buildings.'
        },
        hint: 'Order any unit to attack to continue.',
        demo: async (ctx) => {
          const tank = findPlayerUnit('tank')
          const target = findEnemyTarget()
          const unitCommands = getUnitCommandsHandler()
          if (tank && target && unitCommands) {
            await ctx.demoSelectUnit(tank)
            unitCommands.handleAttackCommand([tank], target, gameState.mapGrid)
          }
        },
        completion: () => selectedUnits.some(unit => unit.target)
          || selectedUnits.some(unit => unit.remoteFireCommandActive)
          || (gameState.remoteControl?.fire || 0) > 0
      },
      {
        id: 'crew-system',
        title: 'Crew, Hospitals, and Ambulances',
        text: {
          desktop: 'Each tank has a four-person crew with HUD markers: D (Driver, blue) moves the tank, C (Commander, green) enables player control, G (Gunner, red) rotates the turret, and L (Loader, orange) lets the tank fire. When all crew are gone, the markers disappear. Build a Hospital from the Buildings tab and an Ambulance from the Units tab. Hospitals restore missing crew when tanks park on the three tiles below the hospital (cost per medic). Ambulances are selected and sent to a unit with missing crew to refill it in the field.',
          mobile: 'Each tank has a four-person crew with HUD markers: D (Driver, blue) moves the tank, C (Commander, green) enables player control, G (Gunner, red) rotates the turret, and L (Loader, orange) lets the tank fire. When all crew are gone, the markers disappear. Build a Hospital from the Buildings tab and an Ambulance from the Units tab. Hospitals restore missing crew when tanks park on the three tiles below the hospital (cost per medic). Ambulances are selected and sent to a unit with missing crew to refill it in the field.'
        },
        hint: 'Restore every crew marker on the empty tank to continue.',
        highlightSelector: '.production-button[data-building-type="hospital"]',
        progressLabel: 'Crew recovery progress',
        progress: (ctx) => {
          const hospitalBuilt = countPlayerBuildings('hospital') > 0 || ctx.lastAction === 'building:hospital'
          const ambulanceBuilt = countPlayerUnits('ambulance') > 0 || ctx.lastAction === 'unit:ambulance'
          const crewRestored = ctx.trackCrewRestoration()
          if (crewRestored) return 1
          if (ambulanceBuilt) return 2 / 3
          if (hospitalBuilt) return 1 / 3
          return 0
        },
        completion: (ctx) => {
          const hospitalBuilt = countPlayerBuildings('hospital') > 0 || ctx.lastAction === 'building:hospital'
          const ambulanceBuilt = countPlayerUnits('ambulance') > 0 || ctx.lastAction === 'unit:ambulance'
          const crewRestored = ctx.trackCrewRestoration()
          return hospitalBuilt && ambulanceBuilt && crewRestored
        },
        demo: async (ctx) => {
          ensureTutorialUnits(1, 'tank')
          const tank = findPlayerUnit('tank')
          if (tank?.crew) {
            ctx.stepState.crewTankId = tank.id
            focusCameraOnUnit(tank)
            const tankTile = getUnitTile(tank)
            if (tankTile) {
              const point = getCanvasPointForTile(tankTile.x, tankTile.y)
              if (point) {
                ctx.moveCursorToPoint(point)
                await sleep(200)
              }
              await ctx.clickCanvasTile(tankTile)
            } else {
              await ctx.demoSelectUnit(tank)
            }
            await sleep(350)
            if (window.cheatSystem?.processCheatCode) {
              const roles = ['driver', 'commander', 'gunner', 'loader']
              roles.forEach(role => {
                if (tank.crew?.[role]) {
                  window.cheatSystem.processCheatCode(role)
                }
              })
            }
            ctx.stepState.crewSnapshot = getPlayerCrewSnapshot()
            await sleep(600)
          }

          const buildingTab = document.querySelector('.tab-button[data-tab="buildings"]')
          if (buildingTab) {
            await ctx.clickElement(buildingTab)
          }
          const hospitalButton = document.querySelector('.production-button[data-building-type="hospital"]')
          await ctx.moveCursorToElement(hospitalButton)
          await sleep(300)

          const unitTab = document.querySelector('.tab-button[data-tab="units"]')
          if (unitTab) {
            await ctx.clickElement(unitTab)
          }
          const ambulanceButton = document.querySelector('.production-button[data-unit-type="ambulance"]')
          await ctx.moveCursorToElement(ambulanceButton)
        }
      },
      {
        id: 'tech-tree',
        title: 'Unlocking the Tech Tree',
        text: {
          desktop: 'New buildings unlock more tech: Power Plants keep everything online, Refineries enable Harvesters, Vehicle Factories unlock tanks. Gas Stations unlock Tankers for refueling. Hospitals unlock Ambulances that carry crew and restore medics. Ammunition Factories unlock Ammunition Trucks; ammo levels show as orange bars above units and in their HUD. Workshops unlock Recovery Tanks to tow wrecks and repair vehicles.',
          mobile: 'New buildings unlock more tech: Power Plants keep everything online, Refineries enable Harvesters, Vehicle Factories unlock tanks. Gas Stations unlock Tankers for refueling. Hospitals unlock Ambulances that carry crew and restore medics. Ammunition Factories unlock Ammunition Trucks; ammo levels show as orange bars above units. Workshops unlock Recovery Tanks to tow wrecks and repair vehicles.'
        },
        hint: 'That concludes the tutorial. You can restart it from Settings anytime.',
        completion: () => true,
        demo: async () => {
          await sleep(350)
        }
      }
    ]
  }
}

export function initTutorialSystem() {
  if (typeof document === 'undefined') return null
  const tutorial = new TutorialSystem()
  tutorial.init()
  window.tutorialSystem = tutorial
  return tutorial
}
