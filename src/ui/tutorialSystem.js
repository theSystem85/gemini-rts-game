import { gameState } from '../gameState.js'
import { productionQueue } from '../productionQueue.js'
import { buildingData, canPlaceBuilding } from '../buildings.js'
import { selectedUnits, getUnitCommandsHandler } from '../inputHandler.js'
import { unitCosts } from '../units.js'
import { setRemoteControlAction, clearRemoteControlSource } from '../input/remoteControlState.js'

const TUTORIAL_SETTINGS_KEY = 'rts_tutorial_settings'
const TUTORIAL_PROGRESS_KEY = 'rts_tutorial_progress'
const TUTORIAL_REMOTE_SOURCE = 'tutorial'

const DEFAULT_SETTINGS = {
  showTutorial: true,
  speechEnabled: true
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
    this.active = false
    this.phase = 'demo'
    this.stepIndex = this.progress.stepIndex || 0
    this.overlay = null
    this.cursor = null
    this.stepTitle = null
    this.stepText = null
    this.stepHint = null
    this.stepCount = null
    this.stepPhase = null
    this.nextButton = null
    this.skipButton = null
    this.skipStepButton = null
    this.highlighted = null
    this.lastAction = null
    this.stepState = {}
    this.animationFrame = null
    this.speaking = false
    this.steps = this.buildSteps()
  }

  init() {
    this.createUI()
    this.bindSettingsControls()
    this.bindActionTracking()

    if (this.settings.showTutorial && !this.progress.completed) {
      setTimeout(() => this.start({ resume: true }), 600)
    }
  }

  createUI() {
    if (document.getElementById('tutorialOverlay')) {
      this.overlay = document.getElementById('tutorialOverlay')
      this.cursor = document.getElementById('tutorialCursor')
      this.stepTitle = this.overlay.querySelector('.tutorial-title')
      this.stepText = this.overlay.querySelector('.tutorial-text')
      this.stepHint = this.overlay.querySelector('.tutorial-hint')
      this.stepCount = this.overlay.querySelector('.tutorial-step-count')
      this.stepPhase = this.overlay.querySelector('.tutorial-phase')
      this.nextButton = this.overlay.querySelector('[data-tutorial-action="next"]')
      this.skipButton = this.overlay.querySelector('[data-tutorial-action="skip"]')
      this.skipStepButton = this.overlay.querySelector('[data-tutorial-action="skip-step"]')
      return
    }

    const overlay = document.createElement('div')
    overlay.id = 'tutorialOverlay'
    overlay.className = 'tutorial-overlay'
    overlay.hidden = true

    const card = document.createElement('div')
    card.className = 'tutorial-card'

    const header = document.createElement('div')
    header.className = 'tutorial-header'

    const stepCount = document.createElement('span')
    stepCount.className = 'tutorial-step-count'

    const stepPhase = document.createElement('span')
    stepPhase.className = 'tutorial-phase'

    header.appendChild(stepCount)
    header.appendChild(stepPhase)

    const title = document.createElement('h3')
    title.className = 'tutorial-title'

    const text = document.createElement('p')
    text.className = 'tutorial-text'

    const hint = document.createElement('p')
    hint.className = 'tutorial-hint'

    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

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

    actions.appendChild(skipStepButton)
    actions.appendChild(skipButton)
    actions.appendChild(nextButton)

    card.appendChild(header)
    card.appendChild(title)
    card.appendChild(text)
    card.appendChild(hint)
    card.appendChild(actions)
    overlay.appendChild(card)

    const cursor = document.createElement('div')
    cursor.id = 'tutorialCursor'
    cursor.className = 'tutorial-cursor'
    cursor.hidden = true
    cursor.innerHTML = '<div class="tutorial-cursor-dot"></div>'

    document.body.appendChild(overlay)
    document.body.appendChild(cursor)

    this.overlay = overlay
    this.cursor = cursor
    this.stepTitle = title
    this.stepText = text
    this.stepHint = hint
    this.stepCount = stepCount
    this.stepPhase = stepPhase
    this.nextButton = nextButton
    this.skipButton = skipButton
    this.skipStepButton = skipStepButton

    nextButton.addEventListener('click', () => this.handleNext())
    skipButton.addEventListener('click', () => this.skipTutorial())
    skipStepButton.addEventListener('click', () => this.skipStep())
  }

  bindSettingsControls() {
    const showToggle = document.getElementById('tutorialShowOnStartup')
    const speechToggle = document.getElementById('tutorialSpeechEnabled')
    const startButton = document.getElementById('tutorialStartBtn')

    if (showToggle) {
      showToggle.checked = this.settings.showTutorial
      showToggle.addEventListener('change', () => {
        this.settings.showTutorial = Boolean(showToggle.checked)
        writeToStorage(TUTORIAL_SETTINGS_KEY, this.settings)
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

    if (startButton) {
      startButton.addEventListener('click', () => {
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

  start({ reset = false, resume = false } = {}) {
    if (reset) {
      this.progress = { ...DEFAULT_PROGRESS }
      this.stepIndex = 0
      this.progress.completed = false
      writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    } else if (resume) {
      this.stepIndex = this.progress.stepIndex || 0
    }

    this.active = true
    this.showUI()
    this.runCurrentStep()
  }

  showUI() {
    if (this.overlay) {
      this.overlay.hidden = false
    }
    if (this.cursor) {
      this.cursor.hidden = false
    }
  }

  hideUI() {
    if (this.overlay) {
      this.overlay.hidden = true
    }
    if (this.cursor) {
      this.cursor.hidden = true
    }
  }

  stop() {
    this.active = false
    this.phase = 'demo'
    this.clearHighlight()
    this.hideUI()
    this.stopSpeech()
    clearRemoteControlSource(TUTORIAL_REMOTE_SOURCE)
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  skipTutorial() {
    this.progress.completed = true
    this.progress.stepIndex = this.steps.length
    writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    this.stop()
  }

  skipStep() {
    this.advanceStep()
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
      this.stop()
      return
    }
    writeToStorage(TUTORIAL_PROGRESS_KEY, this.progress)
    this.runCurrentStep()
  }

  runCurrentStep() {
    if (!this.active) return
    const step = this.steps[this.stepIndex]
    if (!step) {
      this.stop()
      return
    }

    this.phase = 'demo'
    this.lastAction = null
    this.stepState = {
      action: null,
      resourceClicked: new Set(),
      selectionSeen: false,
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
    if (this.stepCount) {
      this.stepCount.textContent = `Step ${this.stepIndex + 1} of ${this.steps.length}`
    }
    if (this.stepPhase) {
      this.stepPhase.textContent = this.phase === 'demo' ? 'Demo' : 'Your turn'
    }

    if (this.nextButton) {
      this.nextButton.disabled = Boolean(step.completion)
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

  clearHighlight() {
    if (this.highlighted) {
      this.highlighted.classList.remove('tutorial-highlight')
      this.highlighted = null
    }
  }

  async runDemo(step) {
    this.stopSpeech()
    if (step.demo) {
      await step.demo(this)
    }
    this.phase = 'practice'
    this.renderStep(step)
    this.speak(getTextForDevice(step))
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
      const done = step.completion(this)
      if (this.nextButton) {
        this.nextButton.disabled = !done
      }
      if (done) {
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
          desktop: 'Select a unit, then right-click on the map to move it.',
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
          desktop: 'When the tank finishes, right-click to move it, or hold the arrow keys (and Space to fire) for remote control driving.',
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
          }
        },
        completion: () => {
          const anyRemote = Object.values(gameState.remoteControl || {}).some(value => value > 0)
          const movedTank = (gameState.units || []).some(unit => unit.type === 'tank' && unit.moveTarget)
          return anyRemote && movedTank
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
