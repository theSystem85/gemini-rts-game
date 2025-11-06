// main.js
// Refactored main game orchestrator

import { setupInputHandlers, selectedUnits, setRenderScheduler } from './inputHandler.js'
import { unitCosts, initializeOccupancyMap, rebuildOccupancyMapWithTextures } from './units.js'
import { gameState } from './gameState.js'
import { buildingData, updatePowerSupply } from './buildings.js'
import { productionQueue } from './productionQueue.js'
import {
  TILE_SIZE,
  MAP_TILES_X,
  MAP_TILES_Y,
  MIN_MAP_TILES,
  DEFAULT_MAP_TILES_X,
  DEFAULT_MAP_TILES_Y,
  ORE_SPREAD_ENABLED,
  setOreSpreadEnabled,
  setMapDimensions
} from './config.js'
import { runtimeConfigDialog } from './ui/runtimeConfigDialog.js'
import './ui/mobileJoysticks.js'
import { initFactories } from './factories.js'
import { initializeGameAssets, generateMap as generateMapFromSetup, cleanupOreFromBuildings } from './gameSetup.js'
import { initSaveGameSystem } from './saveGame.js'
import { showNotification } from './ui/notifications.js'
import { resetAttackDirections } from './ai/enemyStrategies.js'
import { getTextureManager, preloadTileTextures } from './rendering.js'
import { milestoneSystem } from './game/milestoneSystem.js'
import { updateDangerZoneMaps } from './game/dangerZoneMap.js'
import { APP_VERSION } from './version.js'
import versionInfo from './version.json'
import { initializeShadowOfWar, updateShadowOfWar } from './game/shadowOfWar.js'
import { attachBenchmarkButton } from './benchmark/benchmarkRunner.js'
import { initializeMobileViewportLock } from './ui/mobileViewportLock.js'
import { getPlayableViewportWidth, getPlayableViewportHeight } from './utils/layoutMetrics.js'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed', err)
      })
      return
    }

    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister().catch(err => {
          console.warn('Service worker unregistration failed', err)
        })
      })
    }).catch(err => {
      console.warn('Service worker lookup failed', err)
    })

    if (typeof caches !== 'undefined' && caches?.keys) {
      caches.keys().then(cacheNames => {
        cacheNames
          .filter(name => name.startsWith('codeandconquer-cache-'))
          .forEach(name => {
            caches.delete(name).catch(err => {
              console.warn('Failed to delete service worker cache', name, err)
            })
          })
      }).catch(err => {
        console.warn('Failed to enumerate service worker caches', err)
      })
    }
  })
}

let gameInstance = null
let lastIsTouchState = null
let lastMobileLayoutMode = null
let portraitQuery = null

initializeMobileViewportLock()

const mobileLayoutState = {
  productionArea: null,
  originalParent: null,
  originalNextSibling: null,
  mobileContainer: null,
  sidebarToggle: null,
  isSidebarCollapsed: true,
  sidebarToggleListenerAttached: false,
  actions: null,
  actionsOriginalParent: null,
  actionsOriginalNextSibling: null,
  mobileActionsContainer: null,
  mobileControls: null,
  mobileJoystickContainer: null,
  mobileStatusBar: null,
  mobileMoneyValue: null,
  mobileEnergyBar: null,
  mobileEnergyValue: null,
  sidebarUtilityContainer: null,
  restartButton: null,
  restartOriginalParent: null,
  restartOriginalNextSibling: null,
  musicButton: null,
  musicOriginalParent: null,
  musicOriginalNextSibling: null,
  sidebarMenuButton: null,
  sidebarMenuButtonListenerAttached: false,
  sidebarModal: null,
  sidebarModalContent: null,
  sidebarModalCloseButton: null,
  sidebarModalDismissListenerAttached: false,
  sidebarModalKeydownListenerAttached: false,
  sidebarModalVisible: false,
  saveLoadMenu: null,
  saveLoadOriginalParent: null,
  saveLoadOriginalNextSibling: null,
  statsSection: null,
  statsOriginalParent: null,
  statsOriginalNextSibling: null,
  sidebarSwipeHandlersAttached: false,
  sidebarSwipeState: null,
  sidebarSwipeHandlers: null
}

function ensureMobileLayoutElements() {
  if (typeof document === 'undefined') {
    return
  }

  if (!mobileLayoutState.productionArea || !mobileLayoutState.productionArea.isConnected) {
    const productionArea = document.getElementById('productionArea')
    if (productionArea) {
      mobileLayoutState.productionArea = productionArea
      if (!mobileLayoutState.originalParent) {
        mobileLayoutState.originalParent = productionArea.parentNode || null
        mobileLayoutState.originalNextSibling = productionArea.nextSibling || null
      }
    }
  }

  if (!mobileLayoutState.mobileContainer || !mobileLayoutState.mobileContainer.isConnected) {
    mobileLayoutState.mobileContainer = document.getElementById('mobileBuildMenuContainer')
  }

  if (!mobileLayoutState.actions || !mobileLayoutState.actions.isConnected) {
    const actions = document.getElementById('actions')
    if (actions) {
      mobileLayoutState.actions = actions
      if (!mobileLayoutState.actionsOriginalParent) {
        mobileLayoutState.actionsOriginalParent = actions.parentNode || null
        mobileLayoutState.actionsOriginalNextSibling = actions.nextSibling || null
      }
    }
  }

  if (!mobileLayoutState.mobileActionsContainer || !mobileLayoutState.mobileActionsContainer.isConnected) {
    mobileLayoutState.mobileActionsContainer = document.getElementById('mobileActionsContainer')
  }

  if (!mobileLayoutState.mobileControls || !mobileLayoutState.mobileControls.isConnected) {
    mobileLayoutState.mobileControls = document.getElementById('mobileSidebarControls')
  }

  if (!mobileLayoutState.mobileJoystickContainer || !mobileLayoutState.mobileJoystickContainer.isConnected) {
    mobileLayoutState.mobileJoystickContainer = document.getElementById('mobileJoystickContainer')
  }

  if (!mobileLayoutState.sidebarToggle || !mobileLayoutState.sidebarToggle.isConnected) {
    mobileLayoutState.sidebarToggle = document.getElementById('sidebarToggle')
    mobileLayoutState.sidebarToggleListenerAttached = false
  }

  if (!mobileLayoutState.sidebarUtilityContainer || !mobileLayoutState.sidebarUtilityContainer.isConnected) {
    mobileLayoutState.sidebarUtilityContainer = document.getElementById('sidebarUtilityButtons')
  }

  if (!mobileLayoutState.restartButton || !mobileLayoutState.restartButton.isConnected) {
    const restartButton = document.getElementById('restartBtn')
    if (restartButton) {
      mobileLayoutState.restartButton = restartButton
      if (!mobileLayoutState.restartOriginalParent) {
        mobileLayoutState.restartOriginalParent = restartButton.parentNode || null
        mobileLayoutState.restartOriginalNextSibling = restartButton.nextSibling || null
      }
    }
  }

  if (!mobileLayoutState.musicButton || !mobileLayoutState.musicButton.isConnected) {
    const musicButton = document.getElementById('musicControl')
    if (musicButton) {
      mobileLayoutState.musicButton = musicButton
      if (!mobileLayoutState.musicOriginalParent) {
        mobileLayoutState.musicOriginalParent = musicButton.parentNode || null
        mobileLayoutState.musicOriginalNextSibling = musicButton.nextSibling || null
      }
    }
  }

  if (!mobileLayoutState.sidebarMenuButton || !mobileLayoutState.sidebarMenuButton.isConnected) {
    mobileLayoutState.sidebarMenuButton = document.getElementById('mobileSidebarMenuBtn')
    mobileLayoutState.sidebarMenuButtonListenerAttached = false
  }

  if (!mobileLayoutState.sidebarModal || !mobileLayoutState.sidebarModal.isConnected) {
    mobileLayoutState.sidebarModal = document.getElementById('mobileSidebarModal')
  }

  if (!mobileLayoutState.sidebarModalContent || !mobileLayoutState.sidebarModalContent.isConnected) {
    mobileLayoutState.sidebarModalContent = document.getElementById('mobileSidebarModalContent')
  }

  if (!mobileLayoutState.sidebarModalCloseButton || !mobileLayoutState.sidebarModalCloseButton.isConnected) {
    mobileLayoutState.sidebarModalCloseButton = document.getElementById('mobileSidebarModalClose')
  }

  if (!mobileLayoutState.saveLoadMenu) {
    const saveLoadMenu = document.getElementById('saveLoadMenu')
    if (saveLoadMenu) {
      mobileLayoutState.saveLoadMenu = saveLoadMenu
      if (!mobileLayoutState.saveLoadOriginalParent) {
        mobileLayoutState.saveLoadOriginalParent = saveLoadMenu.parentNode || null
        mobileLayoutState.saveLoadOriginalNextSibling = saveLoadMenu.nextSibling || null
      }
    }
  }

  if (!mobileLayoutState.statsSection) {
    const statsSection = document.getElementById('stats')
    if (statsSection) {
      mobileLayoutState.statsSection = statsSection
      if (!mobileLayoutState.statsOriginalParent) {
        mobileLayoutState.statsOriginalParent = statsSection.parentNode || null
        mobileLayoutState.statsOriginalNextSibling = statsSection.nextSibling || null
      }
    }
  }

  if (mobileLayoutState.sidebarToggle && !mobileLayoutState.sidebarToggleListenerAttached) {
    mobileLayoutState.sidebarToggle.addEventListener('click', () => {
      if (!document.body || !document.body.classList.contains('mobile-landscape')) {
        return
      }
      const currentlyCollapsed = document.body.classList.contains('sidebar-collapsed')
      setSidebarCollapsed(!currentlyCollapsed)
    })
    mobileLayoutState.sidebarToggleListenerAttached = true
  }

  if (mobileLayoutState.sidebarMenuButton && !mobileLayoutState.sidebarMenuButtonListenerAttached) {
    mobileLayoutState.sidebarMenuButton.addEventListener('click', event => {
      event.preventDefault()
      if (!document.body || !document.body.classList.contains('mobile-landscape')) {
        return
      }
      if (mobileLayoutState.sidebarModalVisible) {
        closeMobileSidebarModal()
      } else {
        openMobileSidebarModal()
      }
    })
    mobileLayoutState.sidebarMenuButtonListenerAttached = true
  }

  if (mobileLayoutState.sidebarModal && !mobileLayoutState.sidebarModalDismissListenerAttached) {
    mobileLayoutState.sidebarModal.addEventListener('click', event => {
      const target = event.target
      if (!target || typeof target.closest !== 'function') {
        return
      }
      const dismissTrigger = target.closest('[data-modal-dismiss]')
      if (dismissTrigger) {
        event.preventDefault()
        closeMobileSidebarModal()
      }
    })
    mobileLayoutState.sidebarModalDismissListenerAttached = true
  }

  if (typeof document !== 'undefined' && !mobileLayoutState.sidebarModalKeydownListenerAttached) {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobileLayoutState.sidebarModalVisible) {
        closeMobileSidebarModal()
      }
    })
    mobileLayoutState.sidebarModalKeydownListenerAttached = true
  }
}

function ensureMobileStatusBar(container, orientation) {
  if (!container) {
    return
  }

  let statusBar = mobileLayoutState.mobileStatusBar
  if (!statusBar || !statusBar.isConnected) {
    statusBar = document.getElementById('mobileStatusBar')
    if (statusBar) {
      mobileLayoutState.mobileStatusBar = statusBar
    }
  }

  if (!statusBar) {
    statusBar = document.createElement('div')
    statusBar.id = 'mobileStatusBar'

    const moneyRow = document.createElement('div')
    moneyRow.id = 'mobileMoneyDisplay'
    moneyRow.className = 'mobile-resource-row'

    const moneyValue = document.createElement('span')
    moneyValue.id = 'mobileMoneyValue'
    moneyValue.className = 'mobile-resource-value'
    moneyValue.textContent = '$0'

    moneyRow.appendChild(moneyValue)

    const energyContainer = document.createElement('div')
    energyContainer.id = 'mobileEnergyBarContainer'
    energyContainer.className = 'mobile-resource-row'

    const energyTrack = document.createElement('div')
    energyTrack.id = 'mobileEnergyTrack'

    const energyBar = document.createElement('div')
    energyBar.id = 'mobileEnergyBar'

    const energyValue = document.createElement('span')
    energyValue.id = 'mobileEnergyValue'
    energyValue.className = 'mobile-resource-value energy-bar-value'
    energyValue.textContent = '0 MW'

    energyTrack.appendChild(energyBar)
    energyTrack.appendChild(energyValue)
    energyContainer.appendChild(energyTrack)

    statusBar.appendChild(moneyRow)
    statusBar.appendChild(energyContainer)

    mobileLayoutState.mobileStatusBar = statusBar
    mobileLayoutState.mobileMoneyValue = moneyValue
    mobileLayoutState.mobileEnergyBar = energyBar
    mobileLayoutState.mobileEnergyValue = energyValue
  } else {
    mobileLayoutState.mobileMoneyValue = document.getElementById('mobileMoneyValue')
    mobileLayoutState.mobileEnergyBar = document.getElementById('mobileEnergyBar')
    mobileLayoutState.mobileEnergyValue = document.getElementById('mobileEnergyValue')
    statusBar = mobileLayoutState.mobileStatusBar
  }

  if (statusBar) {
    statusBar.setAttribute('data-orientation', orientation || '')
  }

  if (statusBar.parentNode !== container) {
    container.insertBefore(statusBar, container.firstChild || null)
  }

  if (mobileLayoutState.mobileMoneyValue) {
    const currentMoney = Math.max(0, Math.floor(gameState.money || 0))
    mobileLayoutState.mobileMoneyValue.textContent = `$${currentMoney}`
  }

  if (typeof updateEnergyBar === 'function') {
    updateEnergyBar()
  }
}

function setSidebarCollapsed(collapsed) {
  if (!document.body) {
    return
  }

  document.body.classList.toggle('sidebar-collapsed', collapsed)
  mobileLayoutState.isSidebarCollapsed = collapsed

  const toggleButton = mobileLayoutState.sidebarToggle
  if (toggleButton) {
    toggleButton.setAttribute('aria-expanded', (!collapsed).toString())
    toggleButton.setAttribute('aria-label', collapsed ? 'Open sidebar' : 'Collapse sidebar')
  }
}

function ensureSidebarSwipeHandlers(enable) {
  if (typeof document === 'undefined') {
    return
  }

  if (!enable) {
    if (mobileLayoutState.sidebarSwipeHandlersAttached && mobileLayoutState.sidebarSwipeHandlers) {
      const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = mobileLayoutState.sidebarSwipeHandlers
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
    mobileLayoutState.sidebarSwipeHandlersAttached = false
    mobileLayoutState.sidebarSwipeHandlers = null
    mobileLayoutState.sidebarSwipeState = null
    return
  }

  if (mobileLayoutState.sidebarSwipeHandlersAttached) {
    return
  }

  const handleTouchStart = (event) => {
    if (!document.body || !document.body.classList.contains('mobile-landscape')) {
      mobileLayoutState.sidebarSwipeState = null
      return
    }

    if (!event.touches || event.touches.length !== 1) {
      mobileLayoutState.sidebarSwipeState = null
      return
    }

    const touch = event.touches[0]
    const collapsed = document.body.classList.contains('sidebar-collapsed')
    const edgeThreshold = 28
    const activeThreshold = 140

    if (collapsed && touch.clientX <= edgeThreshold) {
      mobileLayoutState.sidebarSwipeState = {
        type: 'open',
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY
      }
    } else if (!collapsed && touch.clientX <= activeThreshold) {
      mobileLayoutState.sidebarSwipeState = {
        type: 'close',
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY
      }
    } else {
      mobileLayoutState.sidebarSwipeState = null
    }
  }

  const handleTouchMove = (event) => {
    const swipeState = mobileLayoutState.sidebarSwipeState
    if (!swipeState) {
      return
    }

    if (!event.touches) {
      mobileLayoutState.sidebarSwipeState = null
      return
    }

    const touch = Array.from(event.touches).find(t => t.identifier === swipeState.identifier)
    if (!touch) {
      return
    }

    swipeState.lastX = touch.clientX
    swipeState.lastY = touch.clientY

    const deltaX = Math.abs(touch.clientX - swipeState.startX)
    const deltaY = Math.abs(touch.clientY - swipeState.startY)
    if (deltaX > deltaY && deltaX > 10) {
      event.preventDefault()
    }
  }

  const endSwipe = (event) => {
    const swipeState = mobileLayoutState.sidebarSwipeState
    if (!swipeState) {
      return
    }

    if (!event.changedTouches) {
      mobileLayoutState.sidebarSwipeState = null
      return
    }

    const touch = Array.from(event.changedTouches).find(t => t.identifier === swipeState.identifier)
    if (!touch) {
      return
    }

    const deltaX = touch.clientX - swipeState.startX
    const deltaY = Math.abs(touch.clientY - swipeState.startY)
    const horizontal = Math.abs(deltaX) > deltaY
    const activationThreshold = 40

    if (horizontal) {
      if (swipeState.type === 'open' && deltaX > activationThreshold) {
        setSidebarCollapsed(false)
      } else if (swipeState.type === 'close' && deltaX < -activationThreshold) {
        setSidebarCollapsed(true)
      }
    }

    mobileLayoutState.sidebarSwipeState = null
  }

  const cancelSwipe = () => {
    mobileLayoutState.sidebarSwipeState = null
  }

  document.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', endSwipe)
  document.addEventListener('touchcancel', cancelSwipe)

  mobileLayoutState.sidebarSwipeHandlersAttached = true
  mobileLayoutState.sidebarSwipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: endSwipe,
    onTouchCancel: cancelSwipe
  }
}

function restoreProductionArea() {
  const { productionArea, originalParent, originalNextSibling } = mobileLayoutState
  if (!productionArea || !originalParent) {
    return
  }

  if (productionArea.parentNode !== originalParent) {
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(productionArea, originalNextSibling)
    } else {
      originalParent.appendChild(productionArea)
    }
  }
}

function restoreActions() {
  const { actions, actionsOriginalParent, actionsOriginalNextSibling } = mobileLayoutState
  if (!actions || !actionsOriginalParent) {
    return
  }

  if (actions.parentNode !== actionsOriginalParent) {
    if (actionsOriginalNextSibling && actionsOriginalNextSibling.parentNode === actionsOriginalParent) {
      actionsOriginalParent.insertBefore(actions, actionsOriginalNextSibling)
    } else {
      actionsOriginalParent.appendChild(actions)
    }
  }
}

function restoreUtilityButton(button, originalParent, originalNextSibling) {
  if (!button || !originalParent) {
    return
  }

  if (button.parentNode !== originalParent) {
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(button, originalNextSibling)
    } else {
      originalParent.appendChild(button)
    }
  }
}

function restoreSidebarSection(section, originalParent, originalNextSibling) {
  if (!section || !originalParent) {
    return
  }

  if (section.parentNode !== originalParent) {
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(section, originalNextSibling)
    } else {
      originalParent.appendChild(section)
    }
  }
}

function moveSidebarSectionToModal(section) {
  const { sidebarModalContent } = mobileLayoutState
  if (!section || !sidebarModalContent) {
    return
  }

  if (section.parentNode !== sidebarModalContent) {
    sidebarModalContent.appendChild(section)
  }
}

function setMobileSidebarModalVisible(visible) {
  mobileLayoutState.sidebarModalVisible = !!visible

  if (typeof document === 'undefined') {
    return
  }

  const { sidebarModal, sidebarMenuButton } = mobileLayoutState
  if (sidebarModal) {
    sidebarModal.setAttribute('aria-hidden', visible ? 'false' : 'true')
  }

  if (sidebarMenuButton) {
    sidebarMenuButton.setAttribute('aria-expanded', visible ? 'true' : 'false')
  }

  if (document.body) {
    document.body.classList.toggle('mobile-sidebar-modal-open', !!visible)
  }
}

function openMobileSidebarModal() {
  if (typeof document === 'undefined' || !document.body || !document.body.classList.contains('mobile-landscape')) {
    return
  }

  moveSidebarSectionToModal(mobileLayoutState.saveLoadMenu)
  moveSidebarSectionToModal(mobileLayoutState.statsSection)
  setMobileSidebarModalVisible(true)

  const { sidebarModal, sidebarModalCloseButton } = mobileLayoutState
  if (sidebarModal) {
    const focusTarget = sidebarModal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus()
    } else if (sidebarModalCloseButton && typeof sidebarModalCloseButton.focus === 'function') {
      sidebarModalCloseButton.focus()
    }
  }
}

function closeMobileSidebarModal() {
  setMobileSidebarModalVisible(false)
}

function applyMobileSidebarLayout(mode) {
  ensureMobileLayoutElements()

  const {
    productionArea,
    mobileContainer,
    actions,
    mobileActionsContainer,
    mobileControls,
    mobileJoystickContainer,
    sidebarUtilityContainer,
    restartButton,
    musicButton,
    sidebarMenuButton,
    sidebarModal,
    saveLoadMenu,
    statsSection
  } = mobileLayoutState

  if (!productionArea || !mobileContainer || !document.body) {
    return
  }

  if (mode) {
    ensureMobileStatusBar(mobileContainer, mode)
    if (productionArea.parentNode !== mobileContainer) {
      mobileContainer.appendChild(productionArea)
    }
    mobileContainer.setAttribute('aria-hidden', 'false')
    mobileContainer.setAttribute('data-orientation', mode)
    if (mobileControls) {
      mobileControls.setAttribute('aria-hidden', 'false')
      mobileControls.setAttribute('data-orientation', mode)
    }
    if (mobileJoystickContainer) {
      mobileJoystickContainer.setAttribute('aria-hidden', 'false')
      mobileJoystickContainer.setAttribute('data-orientation', mode)
    }
    if (mobileActionsContainer && actions && actions.parentNode !== mobileActionsContainer) {
      mobileActionsContainer.appendChild(actions)
    }
    if (sidebarUtilityContainer) {
      sidebarUtilityContainer.setAttribute('aria-hidden', 'false')
      if (restartButton && restartButton.parentNode !== sidebarUtilityContainer) {
        sidebarUtilityContainer.appendChild(restartButton)
      }
      if (musicButton && musicButton.parentNode !== sidebarUtilityContainer) {
        sidebarUtilityContainer.appendChild(musicButton)
      }
    }
    moveSidebarSectionToModal(saveLoadMenu)
    moveSidebarSectionToModal(statsSection)
    if (sidebarMenuButton) {
      sidebarMenuButton.removeAttribute('aria-hidden')
      sidebarMenuButton.removeAttribute('tabindex')
      sidebarMenuButton.setAttribute('aria-expanded', mobileLayoutState.sidebarModalVisible ? 'true' : 'false')
    }
    if (sidebarModal) {
      sidebarModal.setAttribute('data-orientation', mode)
    }
    setMobileSidebarModalVisible(mobileLayoutState.sidebarModalVisible)
    const shouldCollapse = typeof mobileLayoutState.isSidebarCollapsed === 'boolean'
      ? mobileLayoutState.isSidebarCollapsed
      : true
    setSidebarCollapsed(shouldCollapse)
    ensureSidebarSwipeHandlers(mode === 'landscape')
  } else {
    restoreProductionArea()
    restoreActions()
    mobileContainer.setAttribute('aria-hidden', 'true')
    mobileContainer.removeAttribute('data-orientation')
    if (mobileControls) {
      mobileControls.setAttribute('aria-hidden', 'true')
      mobileControls.removeAttribute('data-orientation')
    }
    if (mobileJoystickContainer) {
      mobileJoystickContainer.setAttribute('aria-hidden', 'true')
      mobileJoystickContainer.removeAttribute('data-orientation')
    }
    if (sidebarUtilityContainer) {
      sidebarUtilityContainer.setAttribute('aria-hidden', 'true')
    }
    restoreUtilityButton(
      mobileLayoutState.restartButton,
      mobileLayoutState.restartOriginalParent,
      mobileLayoutState.restartOriginalNextSibling
    )
    restoreUtilityButton(
      mobileLayoutState.musicButton,
      mobileLayoutState.musicOriginalParent,
      mobileLayoutState.musicOriginalNextSibling
    )
    closeMobileSidebarModal()
    if (sidebarModal) {
      sidebarModal.removeAttribute('data-orientation')
    }
    restoreSidebarSection(
      mobileLayoutState.saveLoadMenu,
      mobileLayoutState.saveLoadOriginalParent,
      mobileLayoutState.saveLoadOriginalNextSibling
    )
    restoreSidebarSection(
      mobileLayoutState.statsSection,
      mobileLayoutState.statsOriginalParent,
      mobileLayoutState.statsOriginalNextSibling
    )
    if (sidebarMenuButton) {
      sidebarMenuButton.setAttribute('aria-expanded', 'false')
      sidebarMenuButton.setAttribute('aria-hidden', 'true')
      sidebarMenuButton.setAttribute('tabindex', '-1')
    }
    document.body.classList.remove('sidebar-collapsed')
    if (mobileLayoutState.sidebarToggle) {
      mobileLayoutState.sidebarToggle.setAttribute('aria-expanded', 'true')
      mobileLayoutState.sidebarToggle.setAttribute('aria-label', 'Collapse sidebar')
    }
    if (mobileLayoutState.mobileStatusBar) {
      mobileLayoutState.mobileStatusBar.removeAttribute('data-orientation')
    }
    ensureSidebarSwipeHandlers(false)
  }
}

function updateMobileLayoutClasses() {
  if (!document.body) {
    return
  }

  const isTouch = document.body.classList.contains('is-touch') || !!lastIsTouchState
  const isPortrait = portraitQuery ? portraitQuery.matches : window.matchMedia('(orientation: portrait)').matches
  const shouldApplyMobileLandscape = isTouch && !isPortrait
  const mobileMode = shouldApplyMobileLandscape ? 'landscape' : null

  if (document.body.classList.contains('mobile-sidebar-right')) {
    document.body.classList.remove('mobile-sidebar-right')
  }

  document.body.classList.toggle('mobile-landscape', mobileMode === 'landscape')
  document.body.classList.remove('mobile-portrait')

  applyMobileSidebarLayout(mobileMode)

  if (lastMobileLayoutMode !== mobileMode) {
    lastMobileLayoutMode = mobileMode
    if (gameInstance && gameInstance.canvasManager) {
      gameInstance.canvasManager.resizeCanvases()
    }
  }

  document.dispatchEvent(new CustomEvent('mobile-landscape-layout-changed', {
    detail: { enabled: !!mobileMode, mode: mobileMode }
  }))
}

function updateTouchClass() {
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (document.body) {
    const previous = lastIsTouchState
    document.body.classList.toggle('is-touch', isTouch)
    lastIsTouchState = isTouch
    updateMobileLayoutClasses()
    if (previous !== null && previous !== isTouch && gameInstance && gameInstance.canvasManager) {
      gameInstance.canvasManager.resizeCanvases()
    }
  } else {
    lastIsTouchState = isTouch
  }
}

const coarsePointerQuery = window.matchMedia('(pointer: coarse)')
updateTouchClass()
if (typeof coarsePointerQuery.addEventListener === 'function') {
  coarsePointerQuery.addEventListener('change', updateTouchClass)
} else if (typeof coarsePointerQuery.addListener === 'function') {
  coarsePointerQuery.addListener(updateTouchClass)
}

portraitQuery = window.matchMedia('(orientation: portrait)')
updateMobileLayoutClasses()
if (typeof portraitQuery.addEventListener === 'function') {
  portraitQuery.addEventListener('change', updateMobileLayoutClasses)
} else if (typeof portraitQuery.addListener === 'function') {
  portraitQuery.addListener(updateMobileLayoutClasses)
}

window.addEventListener('resize', updateMobileLayoutClasses)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateMobileLayoutClasses)
}

function setupDoubleTapPrevention() {
  let lastTouchEnd = 0

  if (document.documentElement) {
    document.documentElement.style.touchAction = 'manipulation'
  }
  if (document.body) {
    document.body.style.touchAction = 'manipulation'
  }

  document.addEventListener('touchstart', (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault()
    }
  }, { passive: false })

  document.addEventListener('touchend', (event) => {
    if (event.touches && event.touches.length > 0) {
      lastTouchEnd = Date.now()
      return
    }

    const target = event.target
    if (target && typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable="true"]')) {
      lastTouchEnd = Date.now()
      return
    }

    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      event.preventDefault()
    }
    lastTouchEnd = now
  }, { passive: false })
}

// Import new modules
import { CanvasManager } from './rendering/canvasManager.js'
import { ProductionController } from './ui/productionController.js'
import { EventHandlers } from './ui/eventHandlers.js'
import { GameLoop } from './game/gameLoop.js'
import { setupMinimapHandlers } from './ui/minimap.js'
import { addPowerIndicator, updateEnergyBar } from './ui/energyBar.js'
import { addMoneyIndicator, updateMoneyBar } from './ui/moneyBar.js'

export const MAP_SEED_STORAGE_KEY = 'rts-map-seed'
const PLAYER_COUNT_STORAGE_KEY = 'rts-player-count'
export const MAP_WIDTH_TILES_STORAGE_KEY = 'rts-map-width-tiles'
export const MAP_HEIGHT_TILES_STORAGE_KEY = 'rts-map-height-tiles'
const SHADOW_OF_WAR_STORAGE_KEY = 'rts-shadow-of-war-enabled'

function sanitizeMapDimension(value, fallback) {
  const parsed = parseInt(value, 10)
  if (Number.isFinite(parsed)) {
    return Math.max(MIN_MAP_TILES, parsed)
  }
  return Math.max(MIN_MAP_TILES, Number.isFinite(fallback) ? Math.floor(fallback) : MIN_MAP_TILES)
}

function loadPersistedSettings() {
  try {
    const seedInput = document.getElementById('mapSeed')
    const storedSeed = localStorage.getItem(MAP_SEED_STORAGE_KEY)
    if (seedInput && storedSeed !== null) {
      seedInput.value = storedSeed
    }
  } catch (e) {
    console.warn('Failed to load map seed from localStorage:', e)
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
    console.warn('Failed to load map width from localStorage:', e)
  }

  try {
    const storedHeight = localStorage.getItem(MAP_HEIGHT_TILES_STORAGE_KEY)
    if (storedHeight !== null) {
      heightTiles = sanitizeMapDimension(storedHeight, DEFAULT_MAP_TILES_Y)
    }
  } catch (e) {
    console.warn('Failed to load map height from localStorage:', e)
  }

  if (widthInput) {
    widthInput.value = widthTiles
  }
  if (heightInput) {
    heightInput.value = heightTiles
  }

  const { width, height } = setMapDimensions(widthTiles, heightTiles)
  gameState.mapTilesX = width
  gameState.mapTilesY = height

  try {
    localStorage.setItem(MAP_WIDTH_TILES_STORAGE_KEY, width.toString())
  } catch (e) {
    console.warn('Failed to save map width to localStorage:', e)
  }

  try {
    localStorage.setItem(MAP_HEIGHT_TILES_STORAGE_KEY, height.toString())
  } catch (e) {
    console.warn('Failed to save map height to localStorage:', e)
  }

  try {
    const playerInput = document.getElementById('playerCount')
    const storedCount = localStorage.getItem(PLAYER_COUNT_STORAGE_KEY)
    if (playerInput && storedCount !== null) {
      const parsed = parseInt(storedCount)
      if (!isNaN(parsed) && parsed >= 2 && parsed <= 4) {
        playerInput.value = parsed
        gameState.playerCount = parsed
      }
    }
  } catch (e) {
    console.warn('Failed to load player count from localStorage:', e)
  }

  try {
    const storedShadowSetting = localStorage.getItem(SHADOW_OF_WAR_STORAGE_KEY)
    if (storedShadowSetting !== null) {
      gameState.shadowOfWarEnabled = storedShadowSetting === 'true'
    } else {
      gameState.shadowOfWarEnabled = false
    }
  } catch (e) {
    console.warn('Failed to load shadow of war setting from localStorage:', e)
  }
}

// Initialize loading states
let allAssetsLoaded = false

// Export function to get current game instance
export function getCurrentGame() {
  return gameInstance
}

// Game class to orchestrate everything
class Game {
  constructor() {
    this.canvasManager = new CanvasManager()
    this.productionController = new ProductionController()

    gameInstance = this
    this.initializeGame()
  }

  async initializeGame() {
    // Initialize game assets
    await this.loadAssets()

    // Setup game world
    this.setupGameWorld()

    // Setup UI components
    this.setupUI()

    // Start game loop
    this.startGameLoop()
  }

  async loadAssets() {
    return new Promise((resolve) => {
      initializeGameAssets(() => {
        allAssetsLoaded = true

        // Load textures and rebuild occupancy map once they're loaded
        preloadTileTextures(() => {
          console.log('Textures loaded, rebuilding occupancy map...')
          const newOccupancyMap = rebuildOccupancyMapWithTextures(units, mapGrid, getTextureManager())
          if (newOccupancyMap) {
            gameState.occupancyMap = newOccupancyMap
            console.log('Occupancy map updated with impassable grass tiles')
          }
        })

        resolve()
      })
    })
  }

  setupGameWorld() {
    // Generate map using the seed from the input and store it
    const seed = document.getElementById('mapSeed').value || '1'
    gameState.mapSeed = seed
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)

    // Initialize factories and units
    initFactories(factories, mapGrid)

    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    // Treat initial factories as standard buildings
    gameState.buildings.push(...factories)

    // Initialize shadow of war visibility for the freshly generated map
    initializeShadowOfWar(gameState, mapGrid)
    updateShadowOfWar(gameState, units, mapGrid, factories)

    // Ensure no ore overlaps with buildings or factories
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    updatePowerSupply(gameState.buildings, gameState)

    // Initialize rally points as null
    factories.forEach(factory => {
      factory.rallyPoint = null
      factory.selected = false
    })

    // Also initialize rally points for vehicle factories only
    gameState.buildings.forEach(building => {
      if (building.type === 'vehicleFactory') {
        building.rallyPoint = null
      }
    })

    // Reset enemy AI attack directions for fresh game
    resetAttackDirections()

    // Center viewport on player factory
    this.centerOnPlayerFactory()

    // Setup input handlers
    setupInputHandlers(units, factories, mapGrid)

    // Initialize leveling for any existing units
    units.forEach(unit => {
      if (unit.type !== 'harvester') {
        unit.level = unit.level || 0
        unit.experience = unit.experience || 0
        unit.baseCost = unit.baseCost || unitCosts[unit.type] || 1000
      }
    })

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
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
    // Get UI elements
    const moneyEl = document.getElementById('money')
    // Store these elements for potential future use
    document.getElementById('gameTime')
    document.getElementById('wins')
    document.getElementById('losses')
    const sidebar = document.getElementById('sidebar')

    // Hide start button and style sidebar
    const startBtn = document.getElementById('startBtn')
    if (startBtn) {
      startBtn.style.display = 'none'
    }
    sidebar.style.backgroundColor = '#333'
    sidebar.style.color = '#fff'

    // Initialize energy bar
    addPowerIndicator()

    // Initialize money bar
    addMoneyIndicator()

    // Setup speed control
    this.setupSpeedControl()

    // Setup player count control
    this.setupPlayerCountControl()

    // Setup map shuffle
    this.setupMapShuffle()

    // Setup map settings
    this.setupMapSettings()

    // Setup production tabs and buttons
    this.productionController.initProductionTabs()
    this.productionController.setupAllProductionButtons()

    // Setup event handlers
    this.eventHandlers = new EventHandlers(
      this.canvasManager,
      factories,
      units,
      mapGrid,
      moneyEl,
      this // Pass the game instance
    )
    this.eventHandlers.setProductionController(this.productionController)

    // Setup minimap handlers
    setupMinimapHandlers(this.canvasManager.getGameCanvas())

    // Initialize save game system
    initSaveGameSystem()

    // Set game state
    gameState.gameStarted = true
    gameState.gamePaused = false  // Start the game immediately

    // Update pause button to show pause icon since game is now running
    const pauseBtn = document.getElementById('pauseBtn')
    const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = '⏸'
    }

    // Background music is loaded on demand via the music control button
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
            console.warn('Failed to save player count to localStorage:', err)
          }
          // Note: Map will be regenerated on next shuffle
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
          console.warn('Failed to save map seed to localStorage:', err)
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
          console.warn('Failed to save map dimension to localStorage:', err)
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
        console.warn('Failed to save map seed to localStorage:', err)
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
        console.warn('Failed to save map width to localStorage:', err)
      }

      try {
        localStorage.setItem(MAP_HEIGHT_TILES_STORAGE_KEY, heightTiles.toString())
      } catch (err) {
        console.warn('Failed to save map height to localStorage:', err)
      }

      const { width, height } = setMapDimensions(widthTiles, heightTiles)
      gameState.mapTilesX = width
      gameState.mapTilesY = height

      this.resetGameWithNewMap(seed)
    })
  }

  setupMapSettings() {
    const settingsBtn = document.getElementById('mapSettingsBtn')
    const settingsMenu = document.getElementById('mapSettingsMenu')
    const mapSettingsToggle = document.getElementById('mapSettingsToggle')
    const mapSettingsContent = document.getElementById('mapSettingsContent')
    const mapSettingsToggleIcon = document.getElementById('mapSettingsToggleIcon')
    const oreCheckbox = document.getElementById('oreSpreadCheckbox')
    const shadowCheckbox = document.getElementById('shadowOfWarCheckbox')
    const versionElement = document.getElementById('appVersion')
    const commitMessageElement = document.getElementById('appCommitMessage')
    const configSettingsBtn = document.getElementById('configSettingsBtn')
    const cheatMenuBtn = document.getElementById('cheatMenuBtn')
    attachBenchmarkButton()

    // Handle map settings accordion toggle
    if (mapSettingsToggle && mapSettingsContent && mapSettingsToggleIcon) {
      mapSettingsToggle.addEventListener('click', () => {
        const isExpanded = mapSettingsContent.style.display !== 'none'
        mapSettingsToggle.setAttribute('aria-expanded', !isExpanded)
        mapSettingsContent.style.display = isExpanded ? 'none' : 'block'
        mapSettingsToggleIcon.textContent = isExpanded ? '▼' : '▲'

        // Scroll to make the expanded content visible
        if (!isExpanded) {
          // Content is being expanded, scroll to make it visible
          setTimeout(() => {
            const sidebarScroll = document.getElementById('sidebarScroll')
            if (sidebarScroll && mapSettingsContent) {
              const contentRect = mapSettingsContent.getBoundingClientRect()
              const sidebarRect = sidebarScroll.getBoundingClientRect()

              // Check if the content is below the visible area
              if (contentRect.bottom > sidebarRect.bottom) {
                const scrollTop = sidebarScroll.scrollTop + (contentRect.bottom - sidebarRect.bottom) + 10
                sidebarScroll.scrollTo({
                  top: scrollTop,
                  behavior: 'smooth'
                })
              }
            }
          }, 50) // Small delay to allow the content to render
        }
      })
    }

    if (!settingsBtn || !settingsMenu) return

    // Display version number
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

    settingsBtn.addEventListener('click', () => {
      settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none'
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
          console.warn('Failed to save shadow of war setting to localStorage:', err)
        }
        updateShadowOfWar(gameState, units, gameState.mapGrid, gameState.factories)
      })
    }

    // Use the new runtime config dialog instead of the old eval-based modal
    if (configSettingsBtn) {
      configSettingsBtn.addEventListener('click', () => {
        runtimeConfigDialog.openDialog()
      })
    }

    if (cheatMenuBtn) {
      cheatMenuBtn.addEventListener('click', () => {
        if (mobileLayoutState.sidebarModalVisible) {
          closeMobileSidebarModal()
        }

        if (window.cheatSystem && typeof window.cheatSystem.openDialog === 'function') {
          window.cheatSystem.openDialog()
        }
      })
    }
  }

  resetGameWithNewMap(seed) {
    // Clear existing buildings before generating new map
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

    // Remember the seed so further restarts use the same map
    gameState.mapSeed = seed
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)

    factories.length = 0
    initFactories(factories, mapGrid)

    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    gameState.buildings.push(...factories)

    // Ensure no ore overlaps with buildings or factories
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
    gameState.gamePaused = false  // Auto-start the game immediately

    // Update pause button to show pause icon since game is now running
    const pauseBtn = document.getElementById('pauseBtn')
    const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = '⏸'
    }

    // Resume production after unpause since game is now running
    productionQueue.resumeProductionAfterUnpause()

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
    updateDangerZoneMaps(gameState)
  }

  async resetGame() {
    console.log('Resetting game...')

    // Stop existing game loop to prevent conflicts
    if (this.gameLoop) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop()
      }
      this.gameLoop = null
    }

    // Preserve win/loss statistics
    const preservedWins = gameState.wins
    const preservedLosses = gameState.losses

    // Reset game state
    gameState.money = 12000
    gameState.gameTime = 0
    gameState.frameCount = 0
    gameState.gameStarted = true  // Auto-start the game
    gameState.gamePaused = false  // Make sure it's not paused
    gameState.gameOver = false
    gameState.gameOverMessage = null
    gameState.gameResult = null
    gameState.playerUnitsDestroyed = 0
    gameState.enemyUnitsDestroyed = 0
    gameState.playerBuildingsDestroyed = 0
    gameState.enemyBuildingsDestroyed = 0
    gameState.totalMoneyEarned = 0

    // Reset other game state properties
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
    gameState.defeatedPlayers = new Set() // Reset defeated players tracking

    // Restore preserved statistics
    gameState.wins = preservedWins
    gameState.losses = preservedLosses

    // Reset map and units using the stored seed so the layout stays the same
    const seed = gameState.mapSeed || document.getElementById('mapSeed').value || '1'
    gameState.mapSeed = seed
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)

    gameState.mapTilesX = MAP_TILES_X
    gameState.mapTilesY = MAP_TILES_Y

    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)

    factories.length = 0
    initFactories(factories, mapGrid)

    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    gameState.buildings.push(...factories)

    // Ensure no ore overlaps with buildings or factories
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    updatePowerSupply(gameState.buildings, gameState)

    units.length = 0
    bullets.length = 0

    // Reinitialize occupancy map for the fresh map
    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    initializeShadowOfWar(gameState, mapGrid)
    updateShadowOfWar(gameState, units, mapGrid, factories)

    // Reset production queue and clear all pending items
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

    // Reset milestone system
    try {
      if (milestoneSystem) {
        milestoneSystem.reset()
      }
    } catch (err) {
      console.warn('Could not reset milestone system:', err)
    }

    // Reset UI elements
    this.updateUIAfterReset()

    // Center camera on player factory
    this.centerOnPlayerFactory()

    // Update win/loss display to show preserved statistics
    this.updateStatsDisplay()

    // Start new game loop with a small delay to ensure cleanup is complete
    setTimeout(() => {
      this.startGameLoop()
      console.log('Game reset complete!')
    }, 100)
  }

  updateUIAfterReset() {
    // Reset production button states
    if (this.productionController) {
      this.productionController.updateVehicleButtonStates()
      this.productionController.updateBuildingButtonStates()
    }

    // Reset pause button state for auto-start
    const pauseBtn = document.getElementById('pauseBtn')
    if (pauseBtn) {
      const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
      if (playPauseIcon) {
        playPauseIcon.textContent = '⏸'  // Show pause icon since game is running
      }
    }

    // Clear all progress bars and counters
    document.querySelectorAll('.production-progress').forEach(bar => {
      bar.style.width = '0%'
    })

    document.querySelectorAll('.batch-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    document.querySelectorAll('.ready-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    // Remove active states from production buttons
    document.querySelectorAll('.production-button').forEach(button => {
      button.classList.remove('active', 'paused', 'ready-for-placement')
    })
  }

  updateStatsDisplay() {
    // Update wins/losses display
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
    // Ensure any existing game loop is stopped first
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

    this.gameLoop.setAssetsLoaded(allAssetsLoaded)
    this.gameLoop.start()
  }
}

// Seeded random generator
// eslint-disable-next-line no-unused-vars
function seededRandom(seed) {
  const m = 0x80000000, a = 1103515245, c = 12345
  let state = seed
  return function() {
    state = (a * state + c) % m
    return state / (m - 1)
  }
}

// Export game data for use by other modules
export const mapGrid = []
export const factories = []
export const units = []
export const bullets = []

// Add buildingCosts based on our building data
export const buildingCosts = {}
for (const [type, data] of Object.entries(buildingData)) {
  buildingCosts[type] = data.cost
}

// Add factory repair cost
buildingCosts['factory'] = 5000

// Export for backward compatibility
export { unitCosts }
export { showNotification }

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', async() => {
  // NOTE: The old eval-based config override system has been removed and replaced with
  // the new configRegistry.js system. Config overrides from localStorage and external
  // files are no longer automatically loaded on startup. The new runtime config dialog
  // (press K) now handles config changes using direct function references instead of eval.

  updateTouchClass()
  updateMobileLayoutClasses()
  setupDoubleTapPrevention()
  loadPersistedSettings()
  gameInstance = new Game()

  // Also make it available globally for debugging
  window.gameInstance = gameInstance
  window.gameInstance.units = units
})

// Debug helper to access selectedUnits
window.debugGetSelectedUnits = () => selectedUnits

// Debug helper to test narrated sound stacking
import { testNarratedSounds, playSound, preloadSounds, getSoundCacheStatus, clearSoundCache } from './sound.js'
window.testNarratedSounds = testNarratedSounds
window.debugPlaySound = playSound
window.getSoundCacheStatus = getSoundCacheStatus
window.clearSoundCache = clearSoundCache

// Preload all sound files for optimal performance (async)
preloadSounds().then(() => {
  console.log('Sound preloading completed')
}).catch(e => {
  console.error('Sound preloading failed:', e)
})

// Export functions for backward compatibility - these are now handled by ProductionController
export function updateVehicleButtonStates() {
  // This function is now handled by ProductionController
  console.warn('updateVehicleButtonStates called from main.js - should use ProductionController instead')
}

export function updateBuildingButtonStates() {
  // This function is now handled by ProductionController
  console.warn('updateBuildingButtonStates called from main.js - should use ProductionController instead')
}
