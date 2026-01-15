// tutorialSystem.js
// Guided tutorial overlay with demo cursor, speech narration, and progress persistence.

import { gameState } from '../gameState.js'
import { units } from '../main.js'
import { selectedUnits } from '../inputHandler.js'
import { TILE_SIZE } from '../config.js'

const TUTORIAL_STATE_KEY = 'rts-tutorial-state'
const TUTORIAL_SHOW_KEY = 'rts-tutorial-show'
const TUTORIAL_VOICE_KEY = 'rts-tutorial-voice'

const DEFAULT_STATE = {
  currentStepIndex: 0,
  completed: false
}

const defaultBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return fallback
}

const loadTutorialState = () => {
  try {
    const stored = localStorage.getItem(TUTORIAL_STATE_KEY)
    if (!stored) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(stored)
    return {
      currentStepIndex: Number.isFinite(parsed?.currentStepIndex) ? parsed.currentStepIndex : 0,
      completed: Boolean(parsed?.completed)
    }
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to load state:', err)
    return { ...DEFAULT_STATE }
  }
}

const saveTutorialState = (state) => {
  try {
    localStorage.setItem(TUTORIAL_STATE_KEY, JSON.stringify(state))
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to save state:', err)
  }
}

const loadShowTutorial = () => {
  try {
    return defaultBoolean(localStorage.getItem(TUTORIAL_SHOW_KEY), true)
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to load show flag:', err)
    return true
  }
}

const saveShowTutorial = (value) => {
  try {
    localStorage.setItem(TUTORIAL_SHOW_KEY, value ? 'true' : 'false')
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to save show flag:', err)
  }
}

const loadVoiceEnabled = () => {
  try {
    return defaultBoolean(localStorage.getItem(TUTORIAL_VOICE_KEY), true)
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to load voice flag:', err)
    return true
  }
}

const saveVoiceEnabled = (value) => {
  try {
    localStorage.setItem(TUTORIAL_VOICE_KEY, value ? 'true' : 'false')
  } catch (err) {
    window.logger.warn('[Tutorial] Failed to save voice flag:', err)
  }
}

const isTouchDevice = () => {
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(hover: none)').matches ||
    'ontouchstart' in window
  )
}

const getHumanPlayerId = () => gameState.humanPlayer || 'player1'

const getPlayerBuildings = () => gameState.buildings.filter(
  building => building.owner === getHumanPlayerId() && building.health > 0
)

const getPlayerUnits = () => units.filter(unit => unit.owner === getHumanPlayerId() && unit.health > 0)

const findFirstPlayerUnit = (types = []) => {
  const pool = getPlayerUnits()
  if (types.length === 0) return pool[0] || null
  return pool.find(unit => types.includes(unit.type)) || null
}

const findFirstBuilding = (type) => getPlayerBuildings().find(building => building.type === type) || null

const toScreenPoint = (worldX, worldY, canvasRect) => {
  return {
    x: canvasRect.left + worldX - gameState.scrollOffset.x,
    y: canvasRect.top + worldY - gameState.scrollOffset.y
  }
}

const getCanvasScreenPoint = (worldX, worldY) => {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return toScreenPoint(worldX, worldY, rect)
}

const buildInputHint = (desktopText, mobileText) => (isTouchDevice() ? mobileText : desktopText)

class TutorialSystem {
  constructor() {
    this.state = loadTutorialState()
    this.showTutorial = loadShowTutorial()
    this.voiceEnabled = loadVoiceEnabled()
    this.active = false
    this.currentStepIndex = this.state.currentStepIndex
    this.stepPhase = 'demo'
    this.stepInterval = null
    this.lastMatchedSelector = null
    this.lastCanvasAction = null
    this.overlay = null
    this.cursor = null
    this.highlight = null
    this.titleEl = null
    this.instructionEl = null
    this.hintEl = null
    this.progressEl = null
    this.skipStepBtn = null
    this.skipAllBtn = null
    this.repeatBtn = null
    this.steps = []
  }

  init() {
    this.overlay = document.getElementById('tutorialOverlay')
    this.cursor = document.getElementById('tutorialCursor')
    this.highlight = document.getElementById('tutorialHighlight')
    this.titleEl = document.getElementById('tutorialTitle')
    this.instructionEl = document.getElementById('tutorialInstruction')
    this.hintEl = document.getElementById('tutorialHint')
    this.progressEl = document.getElementById('tutorialProgress')
    this.skipStepBtn = document.getElementById('tutorialSkipStepBtn')
    this.skipAllBtn = document.getElementById('tutorialSkipAllBtn')
    this.repeatBtn = document.getElementById('tutorialRepeatBtn')

    if (!this.overlay || !this.cursor || !this.highlight) return

    this.steps = this.buildSteps()
    this.bindControls()
    this.bindActionTracking()

    this.syncSettingsControls()

    if (this.showTutorial && !this.state.completed) {
      this.start()
    }
  }

  bindControls() {
    if (this.skipStepBtn) {
      this.skipStepBtn.addEventListener('click', () => this.skipStep())
    }
    if (this.skipAllBtn) {
      this.skipAllBtn.addEventListener('click', () => this.finish(true))
    }
    if (this.repeatBtn) {
      this.repeatBtn.addEventListener('click', () => this.runDemo())
    }

    const showCheckbox = document.getElementById('tutorialShowCheckbox')
    if (showCheckbox) {
      showCheckbox.addEventListener('change', (event) => {
        this.showTutorial = Boolean(event.target.checked)
        saveShowTutorial(this.showTutorial)
        if (this.showTutorial && !this.active && !this.state.completed) {
          this.start()
        }
        if (!this.showTutorial && this.active) {
          this.finish(true)
        }
      })
    }

    const voiceCheckbox = document.getElementById('tutorialVoiceCheckbox')
    if (voiceCheckbox) {
      voiceCheckbox.addEventListener('change', (event) => {
        this.voiceEnabled = Boolean(event.target.checked)
        saveVoiceEnabled(this.voiceEnabled)
        if (!this.voiceEnabled) {
          this.stopSpeech()
        }
      })
    }

    const restartBtn = document.getElementById('tutorialRestartBtn')
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.resetProgress()
        this.start(true)
      })
    }
  }

  bindActionTracking() {
    document.addEventListener('click', (event) => {
      if (!this.active) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const matched = target.closest('[data-tutorial-match]')
      if (matched) {
        this.lastMatchedSelector = matched.getAttribute('data-tutorial-match')
      }
    }, true)

    const canvas = document.getElementById('gameCanvas')
    if (canvas) {
      canvas.addEventListener('click', (event) => {
        if (!this.active) return
        this.lastCanvasAction = {
          timestamp: performance.now(),
          screenX: event.clientX,
          screenY: event.clientY
        }
      }, true)
    }
  }

  syncSettingsControls() {
    const showCheckbox = document.getElementById('tutorialShowCheckbox')
    if (showCheckbox) {
      showCheckbox.checked = this.showTutorial
    }
    const voiceCheckbox = document.getElementById('tutorialVoiceCheckbox')
    if (voiceCheckbox) {
      voiceCheckbox.checked = this.voiceEnabled
    }
  }

  resetProgress() {
    this.state = { ...DEFAULT_STATE }
    this.currentStepIndex = 0
    saveTutorialState(this.state)
  }

  start(force = false) {
    if (this.active && !force) return
    this.active = true
    this.overlay.classList.add('tutorial-overlay--visible')
    this.overlay.setAttribute('aria-hidden', 'false')
    this.cursor.classList.add('tutorial-cursor--visible')
    this.highlight.classList.add('tutorial-highlight--visible')
    this.currentStepIndex = Math.min(this.currentStepIndex, this.steps.length - 1)
    this.runStep()
  }

  finish(markCompleted) {
    this.active = false
    this.stopStepMonitor()
    this.hideHighlight()
    this.cursor.classList.remove('tutorial-cursor--visible')
    this.overlay.classList.remove('tutorial-overlay--visible')
    this.overlay.setAttribute('aria-hidden', 'true')
    this.stopSpeech()
    if (markCompleted) {
      this.state.completed = true
      this.state.currentStepIndex = this.currentStepIndex
      saveTutorialState(this.state)
    }
  }

  nextStep() {
    this.currentStepIndex += 1
    if (this.currentStepIndex >= this.steps.length) {
      this.finish(true)
      return
    }
    this.state.currentStepIndex = this.currentStepIndex
    saveTutorialState(this.state)
    this.runStep()
  }

  skipStep() {
    this.nextStep()
  }

  runStep() {
    const step = this.steps[this.currentStepIndex]
    if (!step) {
      this.finish(true)
      return
    }
    this.stepPhase = 'demo'
    this.updatePanel(step, 'demo')
    this.runDemo()
  }

  runDemo() {
    const step = this.steps[this.currentStepIndex]
    if (!step) return
    this.stopStepMonitor()
    const run = step.demo ? step.demo(this) : Promise.resolve()
    run.then(() => {
      if (!this.active) return
      this.stepPhase = 'await'
      this.lastMatchedSelector = null
      this.lastCanvasAction = null
      this.updatePanel(step, 'await')
      this.startStepMonitor()
    }).catch(err => {
      window.logger.warn('[Tutorial] Demo failed:', err)
      this.stepPhase = 'await'
      this.lastMatchedSelector = null
      this.lastCanvasAction = null
      this.updatePanel(step, 'await')
      this.startStepMonitor()
    })
  }

  startStepMonitor() {
    this.stopStepMonitor()
    this.stepInterval = window.setInterval(() => {
      const step = this.steps[this.currentStepIndex]
      if (!step || !this.active || this.stepPhase !== 'await') return
      if (step.complete && step.complete(this)) {
        this.lastMatchedSelector = null
        this.lastCanvasAction = null
        this.nextStep()
      }
    }, 300)
  }

  stopStepMonitor() {
    if (this.stepInterval) {
      window.clearInterval(this.stepInterval)
      this.stepInterval = null
    }
  }

  updatePanel(step, phase) {
    if (this.titleEl) this.titleEl.textContent = step.title
    if (this.instructionEl) this.instructionEl.textContent = step.instruction
    if (this.hintEl) this.hintEl.textContent = phase === 'demo'
      ? step.demoHint || 'Watch the demo cursor.'
      : step.userHint || 'Repeat the action to continue.'
    if (this.progressEl) {
      this.progressEl.textContent = `Step ${this.currentStepIndex + 1} of ${this.steps.length}`
    }
    this.moveHighlight(step)
    this.speak(step.instruction)
  }

  speak(text) {
    if (!this.voiceEnabled) return
    if (!('speechSynthesis' in window)) return
    if (!text) return
    this.stopSpeech()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  moveHighlight(step) {
    if (!this.highlight) return
    const rect = this.getTargetRect(step)
    if (!rect) {
      this.hideHighlight()
      return
    }
    this.highlight.style.left = `${rect.left}px`
    this.highlight.style.top = `${rect.top}px`
    this.highlight.style.width = `${rect.width}px`
    this.highlight.style.height = `${rect.height}px`
    this.highlight.classList.add('tutorial-highlight--visible')
  }

  hideHighlight() {
    if (this.highlight) {
      this.highlight.classList.remove('tutorial-highlight--visible')
    }
  }

  getTargetRect(step) {
    if (!step?.target) return null
    if (typeof step.target === 'function') {
      return step.target()
    }
    if (typeof step.target === 'string') {
      const el = document.querySelector(step.target)
      return el ? el.getBoundingClientRect() : null
    }
    return null
  }

  async moveCursorTo(rect, click = false) {
    if (!this.cursor || !rect) return
    const left = Number.isFinite(rect.left) ? rect.left : rect.x
    const top = Number.isFinite(rect.top) ? rect.top : rect.y
    const width = Number.isFinite(rect.width) ? rect.width : 0
    const height = Number.isFinite(rect.height) ? rect.height : 0
    if (!Number.isFinite(left) || !Number.isFinite(top)) return
    const x = left + width / 2
    const y = top + height / 2
    this.cursor.style.transform = `translate(${x}px, ${y}px)`
    await new Promise(resolve => setTimeout(resolve, 700))
    if (click) {
      this.cursor.classList.add('tutorial-cursor--click')
      await new Promise(resolve => setTimeout(resolve, 250))
      this.cursor.classList.remove('tutorial-cursor--click')
    }
  }

  simulateElementClick(selector) {
    const element = document.querySelector(selector)
    if (element) {
      element.click()
    }
  }

  simulateCanvasClick(worldX, worldY) {
    const canvas = document.getElementById('gameCanvas')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const screen = toScreenPoint(worldX, worldY, rect)
    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: screen.x,
      clientY: screen.y,
      button: 0
    }
    canvas.dispatchEvent(new MouseEvent('mousedown', eventInit))
    canvas.dispatchEvent(new MouseEvent('mouseup', eventInit))
    canvas.dispatchEvent(new MouseEvent('click', eventInit))
  }

  buildSteps() {
    const mobileTap = (desktop, mobile) => buildInputHint(desktop, mobile)
    const step = (data) => ({
      demoHint: 'Watch the tutorial cursor perform the action.',
      userHint: 'Now you try it.',
      ...data
    })

    return [
      step({
        title: 'Welcome to the Command Tutorial',
        instruction: 'This guided tutorial shows you how to build, command units, and win. You can skip any step at any time.',
        target: '#tutorialOverlay',
        demo: async(tutorial) => {
          const rect = tutorial.overlay.getBoundingClientRect()
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Money and Energy',
        instruction: 'Your money (credits) and energy are shown here. Keep energy positive to avoid slow build speeds.',
        target: '#moneyBarContainer',
        demo: async(tutorial) => {
          const moneyRect = tutorial.getTargetRect({ target: '#moneyBarContainer' })
          await tutorial.moveCursorTo(moneyRect, true)
          tutorial.simulateElementClick('#moneyBarContainer')
          const energyRect = tutorial.getTargetRect({ target: '#energyBarContainer' })
          await tutorial.moveCursorTo(energyRect, true)
          tutorial.simulateElementClick('#energyBarContainer')
        },
        complete: (tutorial) => tutorial.lastMatchedSelector === 'energyBarContainer'
      }),
      step({
        title: 'Build: Power Plant',
        instruction: 'Start by building a Power Plant so your base has enough energy to expand.',
        target: '.production-button[data-building-type="powerPlant"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="powerPlant"]' })
          await tutorial.moveCursorTo(rect, true)
          tutorial.simulateElementClick('.production-button[data-building-type="powerPlant"]')
        },
        complete: () => Boolean(findFirstBuilding('powerPlant'))
      }),
      step({
        title: 'Build: Ore Refinery',
        instruction: 'Next, build an Ore Refinery. It converts harvested ore into money.',
        target: '.production-button[data-building-type="oreRefinery"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="oreRefinery"]' })
          await tutorial.moveCursorTo(rect, true)
          tutorial.simulateElementClick('.production-button[data-building-type="oreRefinery"]')
        },
        complete: () => Boolean(findFirstBuilding('oreRefinery'))
      }),
      step({
        title: 'Build: Weapons Factory',
        instruction: 'Build a Weapons Factory (Vehicle Factory) to unlock tanks, harvesters, and other vehicles.',
        target: '.production-button[data-building-type="vehicleFactory"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="vehicleFactory"]' })
          await tutorial.moveCursorTo(rect, true)
          tutorial.simulateElementClick('.production-button[data-building-type="vehicleFactory"]')
        },
        complete: () => Boolean(findFirstBuilding('vehicleFactory'))
      }),
      step({
        title: 'Build: Ore Transporter',
        instruction: 'Queue an Ore Transporter (Harvester) from the Vehicle Factory to start mining.',
        target: '.production-button[data-unit-type="harvester"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-unit-type="harvester"]' })
          await tutorial.moveCursorTo(rect, true)
          tutorial.simulateElementClick('.production-button[data-unit-type="harvester"]')
        },
        complete: () => getPlayerUnits().some(unit => unit.type === 'harvester')
      }),
      step({
        title: 'Ore Transporter Behavior',
        instruction: 'Ore transporters automatically drive to the nearest ore field, but you can direct them to a specific one.',
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const harvester = findFirstPlayerUnit(['harvester'])
          if (!harvester) return
          const canvasRect = document.getElementById('gameCanvas')?.getBoundingClientRect()
          if (!canvasRect) return
          const center = getCanvasScreenPoint(harvester.x + TILE_SIZE / 2, harvester.y + TILE_SIZE / 2)
          if (center) {
            await tutorial.moveCursorTo({ ...center, width: 0, height: 0 }, true)
            tutorial.simulateCanvasClick(harvester.x + TILE_SIZE / 2, harvester.y + TILE_SIZE / 2)
          }
        },
        complete: () => getPlayerUnits().some(unit => unit.type === 'harvester' && unit.manualOreTarget)
      }),
      step({
        title: 'Select a Unit',
        instruction: mobileTap(
          'Click a unit to select it.',
          'Tap a unit to select it.'
        ),
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const unit = findFirstPlayerUnit(['harvester', 'tank'])
          if (!unit) return
          const screen = getCanvasScreenPoint(unit.x + TILE_SIZE / 2, unit.y + TILE_SIZE / 2)
          if (!screen) return
          await tutorial.moveCursorTo({ ...screen, width: 0, height: 0 }, true)
          tutorial.simulateCanvasClick(unit.x + TILE_SIZE / 2, unit.y + TILE_SIZE / 2)
        },
        complete: () => selectedUnits.length === 1
      }),
      step({
        title: 'Select Multiple Units',
        instruction: mobileTap(
          'Drag a box to select multiple units at once.',
          'Drag a box to select multiple units at once.'
        ),
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const unitList = getPlayerUnits()
          if (unitList.length < 2) return
          const u1 = unitList[0]
          const u2 = unitList[1]
          const screen1 = getCanvasScreenPoint(u1.x, u1.y)
          const screen2 = getCanvasScreenPoint(u2.x + TILE_SIZE, u2.y + TILE_SIZE)
          if (!screen1 || !screen2) return
          tutorial.cursor.style.transform = `translate(${screen1.x}px, ${screen1.y}px)`
          await new Promise(resolve => setTimeout(resolve, 200))
          const canvas = document.getElementById('gameCanvas')
          if (!canvas) return
          canvas.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: screen1.x,
            clientY: screen1.y,
            button: 0
          }))
          canvas.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: screen2.x,
            clientY: screen2.y,
            button: 0
          }))
          await new Promise(resolve => setTimeout(resolve, 300))
          canvas.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: screen2.x,
            clientY: screen2.y,
            button: 0
          }))
        },
        complete: () => selectedUnits.length >= 2
      }),
      step({
        title: 'Deselect Units',
        instruction: mobileTap(
          'Right-click on empty ground to deselect units.',
          'Tap on empty ground to clear the selection.'
        ),
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const canvas = document.getElementById('gameCanvas')
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const target = { left: rect.left + 120, top: rect.top + 120, width: 0, height: 0 }
          await tutorial.moveCursorTo(target, true)
          canvas.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: target.left,
            clientY: target.top,
            button: isTouchDevice() ? 0 : 2
          }))
        },
        complete: () => selectedUnits.length === 0
      }),
      step({
        title: 'Move Units',
        instruction: mobileTap(
          'With units selected, left-click the map to move them.',
          'With units selected, tap the map to move them.'
        ),
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const unit = findFirstPlayerUnit()
          if (!unit) return
          tutorial.simulateCanvasClick(unit.x + TILE_SIZE / 2, unit.y + TILE_SIZE / 2)
          const target = getCanvasScreenPoint(unit.x + TILE_SIZE * 4, unit.y + TILE_SIZE * 2)
          if (!target) return
          await tutorial.moveCursorTo({ ...target, width: 0, height: 0 }, true)
          tutorial.simulateCanvasClick(unit.x + TILE_SIZE * 4, unit.y + TILE_SIZE * 2)
        },
        complete: (tutorial) => Boolean(tutorial.lastCanvasAction && selectedUnits.length > 0)
      }),
      step({
        title: 'Set a Factory Waypoint',
        instruction: 'Select the Weapons Factory and click the map to set its rally point (waypoint).',
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const factory = findFirstBuilding('vehicleFactory')
          if (!factory) return
          tutorial.simulateCanvasClick(factory.x * TILE_SIZE + TILE_SIZE, factory.y * TILE_SIZE + TILE_SIZE)
          tutorial.simulateCanvasClick(factory.x * TILE_SIZE + TILE_SIZE * 4, factory.y * TILE_SIZE + TILE_SIZE * 4)
        },
        complete: () => Boolean(findFirstBuilding('vehicleFactory')?.rallyPoint)
      }),
      step({
        title: 'Build a Tank',
        instruction: 'Queue a tank from the Weapons Factory to get a combat unit ready.',
        target: '.production-button[data-unit-type="tank"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-unit-type="tank"]' })
          await tutorial.moveCursorTo(rect, true)
          tutorial.simulateElementClick('.production-button[data-unit-type="tank"]')
        },
        complete: () => getPlayerUnits().some(unit => unit.type === 'tank')
      }),
      step({
        title: 'Send the Tank',
        instruction: 'Select the tank and click a location on the map to send it there.',
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const tank = findFirstPlayerUnit(['tank'])
          if (!tank) return
          tutorial.simulateCanvasClick(tank.x + TILE_SIZE / 2, tank.y + TILE_SIZE / 2)
          tutorial.simulateCanvasClick(tank.x + TILE_SIZE * 6, tank.y + TILE_SIZE * 2)
        },
        complete: (tutorial) => {
          const hasSelectedTank = selectedUnits.some(unit => unit.type === 'tank')
          return Boolean(tutorial.lastCanvasAction && hasSelectedTank)
        }
      }),
      step({
        title: 'Remote Control Mode',
        instruction: mobileTap(
          'Use the arrow keys to remote-control the selected tank (Space to fire).',
          'Use the on-screen joystick to remote-control the selected tank.'
        ),
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const tank = findFirstPlayerUnit(['tank'])
          if (!tank) return
          tutorial.simulateCanvasClick(tank.x + TILE_SIZE / 2, tank.y + TILE_SIZE / 2)
        },
        complete: () => getPlayerUnits().some(unit => unit.type === 'tank' && unit.remoteControlActive)
      }),
      step({
        title: 'Attack Targets',
        instruction: 'Command your tank to attack enemy units or buildings. The goal is to destroy all enemy buildings.',
        target: '#gameCanvas',
        demo: async(tutorial) => {
          const tank = findFirstPlayerUnit(['tank'])
          if (!tank) return
          tutorial.simulateCanvasClick(tank.x + TILE_SIZE / 2, tank.y + TILE_SIZE / 2)
        },
        complete: () => {
          if (gameState.enemyBuildingsDestroyed > 0) return true
          return getPlayerUnits().some(unit => unit.type === 'tank' && unit.target && unit.target.owner !== getHumanPlayerId())
        }
      }),
      step({
        title: 'Tech Tree Unlocks',
        instruction: 'Unlock advanced tech by constructing key buildings. Tankers need a Gas Station, ambulances need a Hospital, ammunition trucks need an Ammunition Factory, and recovery tanks need a Workshop.',
        target: '.production-button[data-building-type="gasStation"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="gasStation"]' })
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Tanker & Tank Station',
        instruction: 'Gas Stations refill fuel and unlock tanker trucks. Tanker trucks can refuel units in the field.',
        target: '.production-button[data-building-type="gasStation"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="gasStation"]' })
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Ambulance, Hospital, and Crew',
        instruction: 'Hospitals restore crew. Ambulances move medics to damaged crews, keeping tanks fully staffed.',
        target: '.production-button[data-building-type="hospital"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="hospital"]' })
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Ammunition System',
        instruction: 'Ammunition Factories unlock ammo trucks. Watch the ammo bar on the HUD to see remaining rounds.',
        target: '.production-button[data-building-type="ammunitionFactory"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="ammunitionFactory"]' })
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Workshop & Recovery Tanks',
        instruction: 'Workshops unlock recovery tanks. Recovery tanks repair friendly vehicles and tow wrecks.',
        target: '.production-button[data-building-type="vehicleWorkshop"]',
        demo: async(tutorial) => {
          const rect = tutorial.getTargetRect({ target: '.production-button[data-building-type="vehicleWorkshop"]' })
          await tutorial.moveCursorTo(rect, true)
        },
        complete: (tutorial) => Boolean(tutorial.lastMatchedSelector)
      }),
      step({
        title: 'Tutorial Complete',
        instruction: 'You are ready to command your base. Destroy all enemy buildings to win!',
        target: '#tutorialOverlay',
        demo: async(tutorial) => {
          const rect = tutorial.overlay.getBoundingClientRect()
          await tutorial.moveCursorTo(rect, true)
        },
        complete: () => true
      })
    ]
  }
}

let tutorialInstance = null

export function initTutorialSystem() {
  if (tutorialInstance) return tutorialInstance
  tutorialInstance = new TutorialSystem()
  tutorialInstance.init()
  return tutorialInstance
}
