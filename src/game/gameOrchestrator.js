// Core game orchestration extracted from main.js
import { setupInputHandlers, setRenderScheduler } from '../inputHandler.js'
import { unitCosts, initializeOccupancyMap, rebuildOccupancyMapWithTextures } from '../units.js'
import { gameState } from '../gameState.js'
import { buildingData, updatePowerSupply } from '../buildings.js'
import { productionQueue } from '../productionQueue.js'
import {
  TILE_SIZE,
  MAP_TILES_X,
  MAP_TILES_Y,
  MIN_MAP_TILES,
  DEFAULT_MAP_TILES_X,
  DEFAULT_MAP_TILES_Y,
  ORE_SPREAD_ENABLED,
  setOreSpreadEnabled,
  DESKTOP_EDGE_AUTOSCROLL_ENABLED,
  setDesktopEdgeAutoscrollEnabled,
  setMapDimensions
} from '../config.js'
import { initSettingsModal, openSettingsModal } from '../ui/settingsModal.js'
import { initSidebarMultiplayer, refreshSidebarMultiplayer } from '../ui/sidebarMultiplayer.js'
import { initAiPartySync } from '../network/aiPartySync.js'
import { setProductionControllerRef } from '../network/gameCommandSync.js'
import { initFactories } from '../factories.js'
import { initializeGameAssets, generateMap as generateMapFromSetup, cleanupOreFromBuildings } from '../gameSetup.js'
import { initSaveGameSystem, initLastGameRecovery, maybeResumeLastPausedGame } from '../saveGame.js'
import { showNotification } from '../ui/notifications.js'
import { resetAttackDirections } from '../ai/enemyStrategies.js'
import { getTextureManager, preloadTileTextures, getMapRenderer } from '../rendering.js'
import { milestoneSystem } from '../game/milestoneSystem.js'
import { updateDangerZoneMaps } from '../game/dangerZoneMap.js'
import { APP_VERSION } from '../version.js'
import versionInfo from '../version.json' with { type: 'json' }
import { initializeShadowOfWar, updateShadowOfWar } from '../game/shadowOfWar.js'
import { initSpatialQuadtree } from '../game/spatialQuadtree.js'
import { setMapEditorRenderScheduler, setMapEditorProductionController, deactivateMapEditMode } from '../mapEditor.js'
import { attachBenchmarkButton } from '../benchmark/benchmarkRunner.js'
import { getPlayableViewportWidth, getPlayableViewportHeight } from '../utils/layoutMetrics.js'
import { initMapEditorControls } from '../ui/mapEditorControls.js'
import { sanitizeSeed } from '../utils/seedUtils.js'
import { initTutorialSystem } from '../ui/tutorialSystem.js'
import { initUserDocs } from '../ui/userDocs.js'
import { CanvasManager } from '../rendering/canvasManager.js'
import { ProductionController } from '../ui/productionController.js'
import { EventHandlers } from '../ui/eventHandlers.js'
import { GameLoop } from '../game/gameLoop.js'
import { setupMinimapHandlers } from '../ui/minimap.js'
import { addPowerIndicator } from '../ui/energyBar.js'
import { addMoneyIndicator } from '../ui/moneyBar.js'
import { closeMobileSidebarModal, isMobileSidebarModalVisible } from '../ui/mobileLayout.js'
import { resetLlmUsage } from '../ai/llmUsage.js'
import { runMeasuredTask, scheduleAfterNextPaint, scheduleIdleTask } from '../startupScheduler.js'

export const MAP_SEED_STORAGE_KEY = 'rts-map-seed'
const PLAYER_COUNT_STORAGE_KEY = 'rts-player-count'
export const MAP_WIDTH_TILES_STORAGE_KEY = 'rts-map-width-tiles'
export const MAP_HEIGHT_TILES_STORAGE_KEY = 'rts-map-height-tiles'
const SHADOW_OF_WAR_STORAGE_KEY = 'rts-shadow-of-war-enabled'
const DESKTOP_EDGE_AUTOSCROLL_STORAGE_KEY = 'rts-desktop-edge-autoscroll-enabled'
const SELECTION_HUD_MODE_STORAGE_KEY = 'rts-selection-hud-mode'
const SELECTION_HUD_BAR_THICKNESS_STORAGE_KEY = 'rts-selection-hud-bar-thickness'

function sanitizeMapDimension(value, fallback) {
  const parsed = parseInt(value, 10)
  if (Number.isFinite(parsed)) {
    return Math.max(MIN_MAP_TILES, parsed)
  }
  return Math.max(MIN_MAP_TILES, Number.isFinite(fallback) ? Math.floor(fallback) : MIN_MAP_TILES)
}

function sanitizeSelectionHudBarThickness(value, fallback = 3) {
  const parsed = parseInt(value, 10)
  if (Number.isFinite(parsed)) {
    return Math.max(1, Math.min(8, parsed))
  }

  const safeFallback = Number.isFinite(fallback) ? Math.floor(fallback) : 3
  return Math.max(1, Math.min(8, safeFallback))
}

function parseStartupMapOverrides() {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search || '')
  const rawSeed = params.get('seed')
  const rawSize = params.get('size') || params.get('mapSize')
  const rawWidth = params.get('width') || params.get('mapWidth')
  const rawHeight = params.get('height') || params.get('mapHeight')
  const rawPlayers = params.get('players') || params.get('playerCount')

  const hasAnyOverride = rawSeed !== null || rawSize !== null || rawWidth !== null || rawHeight !== null || rawPlayers !== null
  if (!hasAnyOverride) {
    return null
  }

  let width = null
  let height = null
  if (rawSize !== null) {
    const size = sanitizeMapDimension(rawSize, DEFAULT_MAP_TILES_X)
    width = size
    height = size
  }

  if (rawWidth !== null) {
    width = sanitizeMapDimension(rawWidth, width ?? DEFAULT_MAP_TILES_X)
  }

  if (rawHeight !== null) {
    height = sanitizeMapDimension(rawHeight, height ?? DEFAULT_MAP_TILES_Y)
  }

  let playerCount = null
  if (rawPlayers !== null) {
    const parsedPlayers = parseInt(rawPlayers, 10)
    if (Number.isFinite(parsedPlayers) && parsedPlayers >= 2 && parsedPlayers <= 4) {
      playerCount = parsedPlayers
    }
  }

  return {
    seed: rawSeed !== null ? resolveMapSeed(rawSeed) : null,
    width,
    height,
    playerCount
  }
}

const startupMapOverrides = parseStartupMapOverrides()

function loadPersistedSettings() {
  const mapOverrides = startupMapOverrides
  try {
    const seedInput = document.getElementById('mapSeed')
    const storedSeed = localStorage.getItem(MAP_SEED_STORAGE_KEY)
    if (seedInput && mapOverrides?.seed) {
      seedInput.value = mapOverrides.seed
    } else if (seedInput && storedSeed !== null) {
      seedInput.value = storedSeed
    }
  } catch (e) {
    window.logger.warn('Failed to load map seed from localStorage:', e)
  }

  const widthInput = document.getElementById('mapWidthTiles')
  const heightInput = document.getElementById('mapHeightTiles')
  let widthTiles = DEFAULT_MAP_TILES_X
  let heightTiles = DEFAULT_MAP_TILES_Y

  try {
    const storedWidth = localStorage.getItem(MAP_WIDTH_TILES_STORAGE_KEY)
    if (storedWidth !== null) {
      widthTiles = sanitizeMapDimension(storedWidth, DEFAULT_MAP_TILES_X)
    }
  } catch (e) {
    window.logger.warn('Failed to load map width from localStorage:', e)
  }

  try {
    const storedHeight = localStorage.getItem(MAP_HEIGHT_TILES_STORAGE_KEY)
    if (storedHeight !== null) {
      heightTiles = sanitizeMapDimension(storedHeight, DEFAULT_MAP_TILES_Y)
    }
  } catch (e) {
    window.logger.warn('Failed to load map height from localStorage:', e)
  }

  if (widthInput) {
    widthInput.value = widthTiles
  }
  if (heightInput) {
    heightInput.value = heightTiles
  }

  if (mapOverrides?.width !== null && mapOverrides?.width !== undefined) {
    widthTiles = mapOverrides.width
    if (widthInput) {
      widthInput.value = widthTiles
    }
  }

  if (mapOverrides?.height !== null && mapOverrides?.height !== undefined) {
    heightTiles = mapOverrides.height
    if (heightInput) {
      heightInput.value = heightTiles
    }
  }

  const { width, height } = setMapDimensions(widthTiles, heightTiles)
  gameState.mapTilesX = width
  gameState.mapTilesY = height

  if (!mapOverrides?.width && !mapOverrides?.height) {
    try {
      localStorage.setItem(MAP_WIDTH_TILES_STORAGE_KEY, width.toString())
    } catch (e) {
      window.logger.warn('Failed to save map width to localStorage:', e)
    }

    try {
      localStorage.setItem(MAP_HEIGHT_TILES_STORAGE_KEY, height.toString())
    } catch (e) {
      window.logger.warn('Failed to save map height to localStorage:', e)
    }
  }

  try {
    const playerInput = document.getElementById('playerCount')
    const storedCount = localStorage.getItem(PLAYER_COUNT_STORAGE_KEY)
    if (playerInput && mapOverrides?.playerCount) {
      playerInput.value = mapOverrides.playerCount
      gameState.playerCount = mapOverrides.playerCount
    } else if (playerInput && storedCount !== null) {
      const parsed = parseInt(storedCount)
      if (!isNaN(parsed) && parsed >= 2 && parsed <= 4) {
        playerInput.value = parsed
        gameState.playerCount = parsed
      }
    }
  } catch (e) {
    window.logger.warn('Failed to load player count from localStorage:', e)
  }

  try {
    const storedShadowSetting = localStorage.getItem(SHADOW_OF_WAR_STORAGE_KEY)
    if (storedShadowSetting !== null) {
      gameState.shadowOfWarEnabled = storedShadowSetting === 'true'
    } else {
      gameState.shadowOfWarEnabled = false
    }
  } catch (e) {
    window.logger.warn('Failed to load shadow of war setting from localStorage:', e)
  }

  try {
    const storedEdgeScrollSetting = localStorage.getItem(DESKTOP_EDGE_AUTOSCROLL_STORAGE_KEY)
    if (storedEdgeScrollSetting !== null) {
      setDesktopEdgeAutoscrollEnabled(storedEdgeScrollSetting === 'true')
    }
  } catch (e) {
    window.logger.warn('Failed to load desktop edge auto-scroll setting from localStorage:', e)
  }

  try {
    const storedSelectionHudMode = localStorage.getItem(SELECTION_HUD_MODE_STORAGE_KEY)
    if (storedSelectionHudMode === 'legacy' || storedSelectionHudMode === 'modern' || storedSelectionHudMode === 'modern-no-border' || storedSelectionHudMode === 'modern-donut') {
      gameState.selectionHudMode = storedSelectionHudMode
    }
  } catch (e) {
    window.logger.warn('Failed to load selection HUD mode from localStorage:', e)
  }

  try {
    const storedSelectionHudBarThickness = localStorage.getItem(SELECTION_HUD_BAR_THICKNESS_STORAGE_KEY)
    if (storedSelectionHudBarThickness !== null) {
      gameState.selectionHudBarThickness = sanitizeSelectionHudBarThickness(storedSelectionHudBarThickness, gameState.selectionHudBarThickness)
    }
  } catch (e) {
    window.logger.warn('Failed to load selection HUD bar thickness from localStorage:', e)
  }
}

function resolveMapSeed(rawSeed) {
  const { value } = sanitizeSeed(rawSeed, { allowRandomKeyword: true })
  return value.toString()
}

let allAssetsLoaded = false
let gameInstance = null

function getCurrentGame() {
  return gameInstance
}

class Game {
  constructor() {
    this.canvasManager = new CanvasManager()
    this.productionController = new ProductionController()

    setProductionControllerRef(this.productionController)

    gameInstance = this

    // Expose gameState to window for E2E testing
    window.gameState = gameState

    this.initializeGame()
  }

  async initializeGame() {
    await runMeasuredTask('startup:initialize-game', async() => {
      await this.loadAssets()
      this.setupGameWorld()
      this.setupUI()
      this.startGameLoop()
      this.setupDeferredStartupTasks()
    })
  }

  async loadAssets() {
    return new Promise((resolve) => {
      initializeGameAssets(() => {
        allAssetsLoaded = true

        preloadTileTextures(() => {
          window.logger('Textures loaded, rebuilding occupancy map...')
          const newOccupancyMap = rebuildOccupancyMapWithTextures(units, mapGrid, getTextureManager())
          if (newOccupancyMap) {
            gameState.occupancyMap = newOccupancyMap
            window.logger('Occupancy map updated with impassable grass tiles')
          }
        })

        resolve()
      })
    })
  }

  setupGameWorld() {
    deactivateMapEditMode()
    gameState.gameStarted = true

    const mapOverrides = startupMapOverrides
    const seedInput = document.getElementById('mapSeed')
    const seed = resolveMapSeed(mapOverrides?.seed || (seedInput ? seedInput.value : gameState.mapSeed || '1'))

    if (seedInput && mapOverrides?.seed) {
      seedInput.value = seed
    }

    if (mapOverrides?.width || mapOverrides?.height) {
      const resolvedWidth = mapOverrides?.width || gameState.mapTilesX || MAP_TILES_X
      const resolvedHeight = mapOverrides?.height || gameState.mapTilesY || MAP_TILES_Y
      setMapDimensions(resolvedWidth, resolvedHeight)
      gameState.mapTilesX = resolvedWidth
      gameState.mapTilesY = resolvedHeight
    }

    if (mapOverrides?.playerCount) {
      gameState.playerCount = mapOverrides.playerCount
      const playerCountInput = document.getElementById('playerCount')
      if (playerCountInput) {
        playerCountInput.value = mapOverrides.playerCount
      }
    }

    gameState.mapSeed = seed
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    initFactories(factories, mapGrid)
    gameState.buildings.push(...factories)

    initializeShadowOfWar(gameState, mapGrid)
    updateShadowOfWar(gameState, units, mapGrid, factories)

    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    updatePowerSupply(gameState.buildings, gameState)

    factories.forEach(factory => {
      factory.rallyPoint = null
      factory.selected = false
    })

    gameState.buildings.forEach(building => {
      if (building.type === 'vehicleFactory') {
        building.rallyPoint = null
      }
    })

    resetAttackDirections()

    this.centerOnPlayerFactory()

    setupInputHandlers(units, factories, mapGrid)

    units.forEach(unit => {
      if (unit.type !== 'harvester') {
        unit.level = unit.level || 0
        unit.experience = unit.experience || 0
        unit.baseCost = unit.baseCost || unitCosts[unit.type] || 1000
      }
    })

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    initSpatialQuadtree(MAP_TILES_X * TILE_SIZE, MAP_TILES_Y * TILE_SIZE)

    updateDangerZoneMaps(gameState)
    updateDangerZoneMaps(gameState)
    updateShadowOfWar(gameState, units, mapGrid, factories)
  }

  centerOnPlayerFactory() {
    const humanPlayer = gameState.humanPlayer || 'player1'
    const playerFactory = factories.find(f => f.id === humanPlayer) || factories.find(f => f.id === 'player')
    if (playerFactory) {
      const factoryPixelX = playerFactory.x * TILE_SIZE
      const factoryPixelY = playerFactory.y * TILE_SIZE

      const gameCanvas = this.canvasManager.getGameCanvas()
      const logicalCanvasWidth = getPlayableViewportWidth(gameCanvas)
      const logicalCanvasHeight = getPlayableViewportHeight(gameCanvas)

      gameState.scrollOffset.x = Math.max(0, Math.min(
        factoryPixelX - logicalCanvasWidth / 2,
        MAP_TILES_X * TILE_SIZE - logicalCanvasWidth
      ))
      gameState.scrollOffset.y = Math.max(0, Math.min(
        factoryPixelY - logicalCanvasHeight / 2,
        MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight
      ))
    }
  }

  setupUI() {
    const moneyEl = document.getElementById('money')
    document.getElementById('gameTime')
    document.getElementById('wins')
    document.getElementById('losses')
    const sidebar = document.getElementById('sidebar')

    const startBtn = document.getElementById('startBtn')
    if (startBtn) {
      startBtn.style.display = 'none'
    }
    sidebar.style.backgroundColor = '#333'
    sidebar.style.color = '#fff'

    addPowerIndicator()
    addMoneyIndicator()

    this.setupSpeedControl()
    this.setupPlayerCountControl()
    this.setupMapShuffle()
    this.setupMapSettings()
    this.productionController.initProductionTabs()
    this.productionController.setupAllProductionButtons()

    this.eventHandlers = new EventHandlers(
      this.canvasManager,
      factories,
      units,
      mapGrid,
      moneyEl,
      this
    )
    this.eventHandlers.setProductionController(this.productionController)

    setupMinimapHandlers(this.canvasManager.getGameCanvas())

    gameState.gamePaused = false

    const pauseBtn = document.getElementById('pauseBtn')
    const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = '⏸'
    }
  }


  setupDeferredStartupTasks() {
    scheduleAfterNextPaint('startup:after-paint-ui', () => {
      initMapEditorControls()
      initTutorialSystem()
      initUserDocs()
      initSidebarMultiplayer()
      initAiPartySync()
      this.setupAutoSaveResume()
    })

    scheduleIdleTask('startup:idle-settings-and-save', () => {
      initSettingsModal()
      attachBenchmarkButton()
      initSaveGameSystem()
    })
  }

  setupAutoSaveResume() {
    initLastGameRecovery()
    maybeResumeLastPausedGame()
  }

  setupSpeedControl() {
    const speedMultiplier = document.getElementById('speedMultiplier')
    if (speedMultiplier) {
      speedMultiplier.value = gameState.speedMultiplier
      speedMultiplier.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value)
        if (value >= 0.25 && value <= 4) {
          gameState.speedMultiplier = value
        } else {
          e.target.value = gameState.speedMultiplier
        }
      })
    }
  }

  setupPlayerCountControl() {
    const playerCountInput = document.getElementById('playerCount')
    if (playerCountInput) {
      playerCountInput.value = gameState.playerCount || 2
      playerCountInput.addEventListener('change', (e) => {
        const value = parseInt(e.target.value)
        if (value >= 2 && value <= 4) {
          gameState.playerCount = value
          try {
            localStorage.setItem(PLAYER_COUNT_STORAGE_KEY, value.toString())
          } catch (err) {
            window.logger.warn('Failed to save player count to localStorage:', err)
          }
          refreshSidebarMultiplayer()
        } else {
          e.target.value = gameState.playerCount || 2
        }
      })
    }
  }

  setupMapShuffle() {
    const seedInput = document.getElementById('mapSeed')
    const mapWidthInput = document.getElementById('mapWidthTiles')
    const mapHeightInput = document.getElementById('mapHeightTiles')
    if (seedInput) {
      seedInput.addEventListener('change', (e) => {
        try {
          localStorage.setItem(MAP_SEED_STORAGE_KEY, e.target.value)
        } catch (err) {
          window.logger.warn('Failed to save map seed to localStorage:', err)
        }
      })
    }

    const persistDimension = (input, storageKey) => {
      if (!input) return
      input.addEventListener('change', () => {
        const fallback = storageKey === MAP_WIDTH_TILES_STORAGE_KEY ? MAP_TILES_X : MAP_TILES_Y
        const sanitized = sanitizeMapDimension(input.value, fallback)
        input.value = sanitized
        try {
          localStorage.setItem(storageKey, sanitized.toString())
        } catch (err) {
          window.logger.warn('Failed to save map dimension to localStorage:', err)
        }
      })
    }

    persistDimension(mapWidthInput, MAP_WIDTH_TILES_STORAGE_KEY)
    persistDimension(mapHeightInput, MAP_HEIGHT_TILES_STORAGE_KEY)

    document.getElementById('shuffleMapBtn').addEventListener('click', () => {
      const seed = seedInput ? seedInput.value || '1' : '1'
      try {
        localStorage.setItem(MAP_SEED_STORAGE_KEY, seed)
      } catch (err) {
        window.logger.warn('Failed to save map seed to localStorage:', err)
      }

      const widthTiles = mapWidthInput ? sanitizeMapDimension(mapWidthInput.value, MAP_TILES_X) : MAP_TILES_X
      const heightTiles = mapHeightInput ? sanitizeMapDimension(mapHeightInput.value, MAP_TILES_Y) : MAP_TILES_Y

      if (mapWidthInput) {
        mapWidthInput.value = widthTiles
      }
      if (mapHeightInput) {
        mapHeightInput.value = heightTiles
      }

      try {
        localStorage.setItem(MAP_WIDTH_TILES_STORAGE_KEY, widthTiles.toString())
      } catch (err) {
        window.logger.warn('Failed to save map width to localStorage:', err)
      }

      try {
        localStorage.setItem(MAP_HEIGHT_TILES_STORAGE_KEY, heightTiles.toString())
      } catch (err) {
        window.logger.warn('Failed to save map height to localStorage:', err)
      }

      const { width, height } = setMapDimensions(widthTiles, heightTiles)
      gameState.mapTilesX = width
      gameState.mapTilesY = height

      this.resetGameWithNewMap(seed)
    })
  }

  setupMapSettings() {
    const settingsBtn = document.getElementById('mapSettingsBtn')
    const mapSettingsToggle = document.getElementById('mapSettingsToggle')
    const mapSettingsContent = document.getElementById('mapSettingsContent')
    const mapSettingsToggleIcon = document.getElementById('mapSettingsToggleIcon')
    const oreCheckbox = document.getElementById('oreSpreadCheckbox')
    const shadowCheckbox = document.getElementById('shadowOfWarCheckbox')
    const edgeAutoscrollCheckbox = document.getElementById('desktopEdgeAutoscrollToggle')
    const selectionHudModeSelect = document.getElementById('selectionHudModeSelect')
    const selectionHudBarThicknessInput = document.getElementById('selectionHudBarThicknessInput')
    const selectionHudPreviewCanvas = document.getElementById('selectionHudPreviewCanvas')
    const versionElement = document.getElementById('appVersion')
    const commitMessageElement = document.getElementById('appCommitMessage')
    const cheatMenuBtn = document.getElementById('cheatMenuBtn')

    const renderSelectionHudPreview = () => {
      if (!selectionHudPreviewCanvas) return

      const ctx = selectionHudPreviewCanvas.getContext('2d')
      if (!ctx) return

      const mode = selectionHudModeSelect?.value || gameState.selectionHudMode || 'modern'
      const barThickness = sanitizeSelectionHudBarThickness(
        selectionHudBarThicknessInput?.value,
        gameState.selectionHudBarThickness
      )
      const donutThickness = Math.max(1, barThickness - 2)

      const canvasWidth = selectionHudPreviewCanvas.width
      const canvasHeight = selectionHudPreviewCanvas.height
      const centerX = Math.floor(canvasWidth / 2)
      const centerY = Math.floor(canvasHeight / 2)
      const halfHud = 22
      const hudBounds = {
        left: centerX - halfHud,
        right: centerX + halfHud,
        top: centerY - halfHud,
        bottom: centerY + halfHud,
        width: halfHud * 2,
        height: halfHud * 2
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      ctx.fillStyle = '#0F131A'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (mode !== 'modern-no-border' && mode !== 'modern-donut') {
        ctx.strokeStyle = '#FF0'
        ctx.lineWidth = 1
        ctx.strokeRect(hudBounds.left, hudBounds.top, hudBounds.width, hudBounds.height)
      }

      const drawRectBar = (edge, ratio, color) => {
        const barSpan = TILE_SIZE * 0.75
        ctx.fillStyle = '#3A3A3A'
        if (edge === 'top' || edge === 'bottom') {
          const y = edge === 'top'
            ? hudBounds.top - (barThickness / 2)
            : hudBounds.bottom - (barThickness / 2)
          const barX = ((hudBounds.left + hudBounds.right) / 2) - (barSpan / 2)
          ctx.fillRect(barX, y, barSpan, barThickness)
          ctx.fillStyle = color
          ctx.fillRect(barX, y, barSpan * ratio, barThickness)
          return
        }

        const x = edge === 'left'
          ? hudBounds.left - (barThickness / 2)
          : hudBounds.right - (barThickness / 2)
        const barY = ((hudBounds.top + hudBounds.bottom) / 2) - (barSpan / 2)
        ctx.fillRect(x, barY, barThickness, barSpan)
        const fillHeight = barSpan * ratio
        ctx.fillStyle = color
        ctx.fillRect(x, barY + barSpan - fillHeight, barThickness, fillHeight)
      }

      const drawDonutBar = (edge, ratio, color) => {
        const donutRadius = (Math.min(hudBounds.width, hudBounds.height) / 2) + 2
        const crewSize = 5
        const crewGap = 3
        const crewHalfSpanAngle = ((crewSize / 2) + crewGap) / donutRadius
        const arcRanges = {
          left: [Math.PI + crewHalfSpanAngle, (Math.PI * 1.5) - crewHalfSpanAngle],
          top: [(Math.PI * 1.5) + crewHalfSpanAngle, (Math.PI * 2) - crewHalfSpanAngle],
          right: [crewHalfSpanAngle, (Math.PI / 2) - crewHalfSpanAngle],
          bottom: [(Math.PI / 2) + crewHalfSpanAngle, Math.PI - crewHalfSpanAngle]
        }
        const selectedArc = arcRanges[edge]
        if (!selectedArc) return

        const [startAngle, endAngle] = selectedArc
        const sweep = endAngle - startAngle

        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineWidth = donutThickness
        ctx.strokeStyle = '#3A3A3A'
        ctx.beginPath()
        ctx.arc(centerX, centerY, donutRadius, startAngle, endAngle)
        ctx.stroke()

        if (ratio > 0) {
          ctx.strokeStyle = color
          ctx.beginPath()
          ctx.arc(centerX, centerY, donutRadius, startAngle, startAngle + (sweep * ratio))
          ctx.stroke()
        }
        ctx.restore()
      }

      const drawBar = mode === 'modern-donut' ? drawDonutBar : drawRectBar
      drawBar('top', 0.65, '#67C23A')
      drawBar('right', 0.55, '#4A90E2')
      drawBar('left', 0.7, '#FFA500')
      drawBar('bottom', 0.5, '#B084F5')

      ctx.fillStyle = '#5B6D7D'
      ctx.fillRect(centerX - 12, centerY - 9, 24, 18)
      ctx.fillStyle = '#33414D'
      ctx.fillRect(centerX - 7, centerY - 13, 14, 8)
      ctx.fillStyle = '#97A6B3'
      ctx.fillRect(centerX - 2, centerY - 20, 4, 8)

      const crewMarkers = [
        { x: centerX, y: centerY - 24, c: '#006400', t: 'C' },
        { x: centerX + 24, y: centerY, c: '#F00', t: 'G' },
        { x: centerX, y: centerY + 24, c: '#FFA500', t: 'L' },
        { x: centerX - 24, y: centerY, c: '#00F', t: 'D' }
      ]

      ctx.save()
      ctx.font = '4px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      crewMarkers.forEach(marker => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.fillRect(marker.x - 4, marker.y - 5, 8, 8)
        ctx.fillStyle = marker.c
        ctx.fillRect(marker.x - 3, marker.y - 4, 6, 6)
        ctx.fillStyle = '#FFF'
        ctx.fillText(marker.t, marker.x, marker.y - 1)
      })
      ctx.restore()

      const starY = mode === 'modern-donut' ? hudBounds.top - 8 : hudBounds.top - 3
      const starSize = 6
      const starSpacing = 8
      const stars = 2
      const totalWidth = (stars * starSpacing) - (starSpacing - starSize)
      const startX = centerX - totalWidth / 2
      ctx.fillStyle = '#FFD700'
      ctx.strokeStyle = '#FFA500'
      ctx.lineWidth = 1
      for (let i = 0; i < stars; i++) {
        const starX = startX + (i * starSpacing)
        ctx.beginPath()
        for (let j = 0; j < 5; j++) {
          const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2
          const outerRadius = starSize / 2
          const innerRadius = starSize / 4
          if (j === 0) {
            ctx.moveTo(starX + outerRadius * Math.cos(angle), starY + outerRadius * Math.sin(angle))
          } else {
            ctx.lineTo(starX + outerRadius * Math.cos(angle), starY + outerRadius * Math.sin(angle))
          }
          const innerAngle = angle + (2 * Math.PI) / 10
          ctx.lineTo(starX + innerRadius * Math.cos(innerAngle), starY + innerRadius * Math.sin(innerAngle))
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }

    if (mapSettingsToggle && mapSettingsContent && mapSettingsToggleIcon) {
      mapSettingsToggle.addEventListener('click', () => {
        const isExpanded = mapSettingsContent.style.display !== 'none'
        mapSettingsToggle.setAttribute('aria-expanded', !isExpanded)
        mapSettingsContent.style.display = isExpanded ? 'none' : 'block'
        mapSettingsToggleIcon.textContent = isExpanded ? '▼' : '▲'

        if (!isExpanded) {
          setTimeout(() => {
            const sidebarScroll = document.getElementById('sidebarScroll')
            if (sidebarScroll && mapSettingsContent) {
              const contentRect = mapSettingsContent.getBoundingClientRect()
              const sidebarRect = sidebarScroll.getBoundingClientRect()

              if (contentRect.bottom > sidebarRect.bottom) {
                const scrollTop = sidebarScroll.scrollTop + (contentRect.bottom - sidebarRect.bottom) + 10
                sidebarScroll.scrollTo({
                  top: scrollTop,
                  behavior: 'smooth'
                })
              }
            }
          }, 50)
        }
      })
    }

    if (!settingsBtn) return

    if (versionElement) {
      const commitHash = versionInfo?.commit || 'unknown'
      versionElement.textContent = `${APP_VERSION} (${commitHash})`
    }

    if (commitMessageElement) {
      commitMessageElement.textContent = versionInfo?.message || ''
      commitMessageElement.style.display = commitMessageElement.textContent ? 'block' : 'none'
    }

    if (oreCheckbox) {
      oreCheckbox.checked = ORE_SPREAD_ENABLED
    }

    if (shadowCheckbox) {
      shadowCheckbox.checked = !!gameState.shadowOfWarEnabled
    }

    if (edgeAutoscrollCheckbox) {
      edgeAutoscrollCheckbox.checked = DESKTOP_EDGE_AUTOSCROLL_ENABLED
    }

    if (selectionHudModeSelect) {
      selectionHudModeSelect.value = gameState.selectionHudMode || 'modern'
    }

    if (selectionHudBarThicknessInput) {
      selectionHudBarThicknessInput.value = sanitizeSelectionHudBarThickness(gameState.selectionHudBarThickness, 3)
    }

    renderSelectionHudPreview()

    const showEnemyResourcesCheckbox = document.getElementById('showEnemyResourcesCheckbox')
    if (showEnemyResourcesCheckbox) {
      showEnemyResourcesCheckbox.checked = !!gameState.showEnemyResources
      showEnemyResourcesCheckbox.addEventListener('change', (e) => {
        gameState.showEnemyResources = e.target.checked
      })
    }

    settingsBtn.addEventListener('click', () => {
      openSettingsModal('runtime')
    })

    if (oreCheckbox) {
      oreCheckbox.addEventListener('change', (e) => {
        setOreSpreadEnabled(e.target.checked)
      })
    }

    if (shadowCheckbox) {
      shadowCheckbox.addEventListener('change', (e) => {
        const enabled = e.target.checked
        gameState.shadowOfWarEnabled = enabled
        try {
          localStorage.setItem(SHADOW_OF_WAR_STORAGE_KEY, enabled.toString())
        } catch (err) {
          window.logger.warn('Failed to save shadow of war setting to localStorage:', err)
        }
        updateShadowOfWar(gameState, units, gameState.mapGrid, gameState.factories)
      })
    }

    if (edgeAutoscrollCheckbox) {
      edgeAutoscrollCheckbox.addEventListener('change', (e) => {
        const enabled = e.target.checked
        setDesktopEdgeAutoscrollEnabled(enabled)
        try {
          localStorage.setItem(DESKTOP_EDGE_AUTOSCROLL_STORAGE_KEY, enabled.toString())
        } catch (err) {
          window.logger.warn('Failed to save desktop edge auto-scroll setting to localStorage:', err)
        }
      })
    }

    if (selectionHudModeSelect) {
      selectionHudModeSelect.addEventListener('change', (e) => {
        const nextMode = e.target.value
        if (nextMode !== 'legacy' && nextMode !== 'modern' && nextMode !== 'modern-no-border' && nextMode !== 'modern-donut') {
          return
        }
        gameState.selectionHudMode = nextMode
        try {
          localStorage.setItem(SELECTION_HUD_MODE_STORAGE_KEY, nextMode)
        } catch (err) {
          window.logger.warn('Failed to save selection HUD mode to localStorage:', err)
        }
        renderSelectionHudPreview()
      })
    }

    if (selectionHudBarThicknessInput) {
      const applyHudBarThickness = () => {
        const nextThickness = sanitizeSelectionHudBarThickness(
          selectionHudBarThicknessInput.value,
          gameState.selectionHudBarThickness
        )
        selectionHudBarThicknessInput.value = nextThickness
        gameState.selectionHudBarThickness = nextThickness
        try {
          localStorage.setItem(SELECTION_HUD_BAR_THICKNESS_STORAGE_KEY, nextThickness.toString())
        } catch (err) {
          window.logger.warn('Failed to save selection HUD bar thickness to localStorage:', err)
        }
        renderSelectionHudPreview()
      }

      selectionHudBarThicknessInput.addEventListener('input', applyHudBarThickness)
      selectionHudBarThicknessInput.addEventListener('change', applyHudBarThickness)
    }

    if (cheatMenuBtn) {
      cheatMenuBtn.addEventListener('click', () => {
        if (isMobileSidebarModalVisible()) {
          closeMobileSidebarModal()
        }

        if (window.cheatSystem && typeof window.cheatSystem.openDialog === 'function') {
          window.cheatSystem.openDialog()
        }
      })
    }
  }

  resetGameWithNewMap(seed) {
    deactivateMapEditMode()
    const normalizedSeed = resolveMapSeed(seed || '1')
    gameState.buildings.length = 0
    gameState.powerSupply = 0
    gameState.playerPowerSupply = 0
    gameState.playerTotalPowerProduction = 0
    gameState.playerPowerConsumption = 0
    gameState.enemyPowerSupply = 0
    gameState.enemyTotalPowerProduction = 0
    gameState.enemyPowerConsumption = 0
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null
    gameState.repairMode = false
    gameState.unitWrecks = []

    const mapRenderer = getMapRenderer()
    if (mapRenderer) {
      mapRenderer.invalidateAllChunks()
    }

    gameState.mapSeed = normalizedSeed
    generateMapFromSetup(normalizedSeed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    factories.length = 0
    initFactories(factories, mapGrid)
    gameState.buildings.push(...factories)

    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    updatePowerSupply(gameState.buildings, gameState)

    units.length = 0
    bullets.length = 0

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
    updateDangerZoneMaps(gameState)

    initializeShadowOfWar(gameState, mapGrid)
    updateShadowOfWar(gameState, units, mapGrid, factories)

    this.centerOnPlayerFactory()

    gameState.gameTime = 0
    gameState.gameOver = false
    gameState.gameStarted = true
    gameState.gamePaused = false

    const pauseBtn = document.getElementById('pauseBtn')
    const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = '⏸'
    }

    productionQueue.resumeProductionAfterUnpause()

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
    updateDangerZoneMaps(gameState)
  }

  async resetGame() {
    window.logger('Resetting game...')

    deactivateMapEditMode()

    const mapRenderer = getMapRenderer()
    if (mapRenderer) {
      mapRenderer.invalidateAllChunks()
    }

    if (this.gameLoop) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop()
      }
      this.gameLoop = null
    }

    const preservedWins = gameState.wins
    const preservedLosses = gameState.losses

    gameState.money = 12000
    gameState.gameTime = 0
    gameState.frameCount = 0
    gameState.gameStarted = true
    gameState.gamePaused = false
    gameState.gameOver = false
    gameState.gameOverMessage = null
    gameState.gameResult = null
    gameState.playerUnitsDestroyed = 0
    gameState.enemyUnitsDestroyed = 0
    gameState.playerBuildingsDestroyed = 0
    gameState.enemyBuildingsDestroyed = 0
    gameState.totalMoneyEarned = 0
    resetLlmUsage()
    gameState.llmStrategic = null
    gameState.llmCommentary = null

    gameState.buildings = []
    gameState.powerSupply = 0
    gameState.playerPowerSupply = 0
    gameState.playerTotalPowerProduction = 0
    gameState.playerPowerConsumption = 0
    gameState.enemyPowerSupply = 0
    gameState.enemyTotalPowerProduction = 0
    gameState.enemyPowerConsumption = 0
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null
    gameState.repairMode = false
    gameState.radarActive = false
    gameState.targetedOreTiles = {}
    gameState.refineryStatus = {}
    gameState.defeatedPlayers = new Set()
    gameState.unitWrecks = []
    gameState._defeatSoundPlayed = false
    gameState.localPlayerDefeated = false
    gameState.isSpectator = false

    gameState.wins = preservedWins
    gameState.losses = preservedLosses

    const seedInput = document.getElementById('mapSeed')
    const seed = resolveMapSeed(gameState.mapSeed || seedInput?.value || '1')
    gameState.mapSeed = seed
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    factories.length = 0
    initFactories(factories, mapGrid)
    gameState.buildings.push(...factories)

    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    updatePowerSupply(gameState.buildings, gameState)

    units.length = 0
    bullets.length = 0

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    initializeShadowOfWar(gameState, mapGrid)
    updateShadowOfWar(gameState, units, mapGrid, factories)

    if (typeof productionQueue !== 'undefined') {
      productionQueue.unitItems.length = 0
      productionQueue.buildingItems.length = 0
      productionQueue.completedBuildings.length = 0
      productionQueue.currentUnit = null
      productionQueue.currentBuilding = null
      productionQueue.pausedUnit = false
      productionQueue.pausedBuilding = false
      productionQueue.unitPaid = 0
      productionQueue.buildingPaid = 0
    }

    try {
      if (milestoneSystem) {
        milestoneSystem.reset()
      }
    } catch (err) {
      window.logger.warn('Could not reset milestone system:', err)
    }

    this.updateUIAfterReset()
    this.centerOnPlayerFactory()
    this.updateStatsDisplay()

    setTimeout(() => {
      this.startGameLoop()
      window.logger('Game reset complete!')
    }, 100)
  }

  updateUIAfterReset() {
    if (this.productionController) {
      this.productionController.updateVehicleButtonStates()
      this.productionController.updateBuildingButtonStates()
    }

    const pauseBtn = document.getElementById('pauseBtn')
    if (pauseBtn) {
      const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
      if (playPauseIcon) {
        playPauseIcon.textContent = '⏸'
      }
    }

    document.querySelectorAll('.production-progress').forEach(bar => {
      bar.style.width = '0%'
    })

    document.querySelectorAll('.batch-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    document.querySelectorAll('.ready-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    document.querySelectorAll('.production-button').forEach(button => {
      button.classList.remove('active', 'paused', 'ready-for-placement')
    })
  }

  updateStatsDisplay() {
    const winsEl = document.getElementById('wins')
    const lossesEl = document.getElementById('losses')

    if (winsEl) {
      winsEl.textContent = gameState.wins
    }

    if (lossesEl) {
      lossesEl.textContent = gameState.losses
    }
  }

  startGameLoop() {
    if (this.gameLoop) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop()
      }
      this.gameLoop = null
    }

    this.gameLoop = new GameLoop(
      this.canvasManager,
      this.productionController,
      mapGrid,
      factories,
      units,
      bullets,
      productionQueue,
      document.getElementById('money'),
      document.getElementById('gameTime')
    )

    setRenderScheduler(() => this.gameLoop.requestRender())
    setMapEditorRenderScheduler(() => this.gameLoop.requestRender())
    setMapEditorProductionController(this.productionController)

    this.gameLoop.setAssetsLoaded(allAssetsLoaded)
    this.gameLoop.start()
  }
}

export const mapGrid = []
export const factories = []
export const units = []
export const bullets = []

gameState.mapGrid = mapGrid
gameState.units = units
gameState.factories = factories

function regenerateMapForClient(seed, widthTiles, heightTiles, playerCount) {
  window.logger('[Main] Regenerating map for client with seed:', seed, 'dimensions:', widthTiles, 'x', heightTiles, 'playerCount:', playerCount)
  deactivateMapEditMode()
  const { value: clientSeed } = sanitizeSeed(seed)
  const normalizedSeed = clientSeed.toString()

  setMapDimensions(widthTiles, heightTiles)

  gameState.mapSeed = normalizedSeed
  gameState.mapTilesX = widthTiles
  gameState.mapTilesY = heightTiles
  if (playerCount) {
    gameState.playerCount = playerCount
  }

  gameState.unitWrecks = []

  mapGrid.length = 0
  generateMapFromSetup(normalizedSeed, mapGrid, widthTiles, heightTiles)

  gameState.occupancyMap = []
  for (let y = 0; y < heightTiles; y++) {
    gameState.occupancyMap[y] = []
    for (let x = 0; x < widthTiles; x++) {
      gameState.occupancyMap[y][x] = 0
    }
  }

  initializeShadowOfWar(gameState, mapGrid)

  const mapRenderer = getMapRenderer()
  if (mapRenderer) {
    mapRenderer.invalidateAllChunks()
  }

  window.logger('[Main] Client map regeneration complete')
}

const buildingCosts = {}
for (const [type, data] of Object.entries(buildingData)) {
  buildingCosts[type] = data.cost
}

buildingCosts['factory'] = 5000

function updateVehicleButtonStates() {
  window.logger.warn('updateVehicleButtonStates called from main.js - should use ProductionController instead')
}

function updateBuildingButtonStates() {
  window.logger.warn('updateBuildingButtonStates called from main.js - should use ProductionController instead')
}

export {
  buildingCosts,
  unitCosts,
  showNotification,
  sanitizeMapDimension,
  resolveMapSeed,
  loadPersistedSettings,
  getCurrentGame,
  Game,
  regenerateMapForClient,
  updateVehicleButtonStates,
  updateBuildingButtonStates
}
