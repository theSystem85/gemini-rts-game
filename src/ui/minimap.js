// minimap.js
// Handle minimap interaction and navigation

import { gameState } from '../gameState.js'
import { MAP_TILES_X, MAP_TILES_Y, TILE_SIZE } from '../config.js'

export function setupMinimapHandlers(gameCanvas) {
  const minimapElement = document.getElementById('minimap')
  if (!minimapElement) {
    return
  }

  // Handle minimap dragging state
  let isMinimapDragging = false
  let activeTouchId = null

  const handlePointerNavigation = (point) => {
    if (!point) {
      return
    }
    handleMinimapClick({ target: minimapElement, clientX: point.clientX, clientY: point.clientY }, gameCanvas)
  }

  minimapElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
      e.preventDefault()
      isMinimapDragging = true
      handlePointerNavigation(e)
    }
  })

  minimapElement.addEventListener('mousemove', (e) => {
    if (isMinimapDragging) {
      handlePointerNavigation(e)
    }
  })

  // Use mouseup on the document to ensure we catch the event even if released outside the minimap
  document.addEventListener('mouseup', (e) => {
    if (isMinimapDragging) {
      // This is important - process one last time with the final cursor position
      // when it's still in drag mode before ending the drag
      if (e.target === minimapElement) {
        handlePointerNavigation(e)
      }
      isMinimapDragging = false
    }
  })

  minimapElement.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length === 0) {
      return
    }
    const touch = e.touches[0]
    activeTouchId = touch.identifier
    isMinimapDragging = true
    e.preventDefault()
    handlePointerNavigation(touch)
  }, { passive: false })

  minimapElement.addEventListener('touchmove', (e) => {
    if (!isMinimapDragging) {
      return
    }
    const touches = Array.from(e.touches || [])
    const touch = touches.find(t => t.identifier === activeTouchId) || touches[0]
    if (touch) {
      e.preventDefault()
      handlePointerNavigation(touch)
    }
  }, { passive: false })

  const endTouchDrag = (e) => {
    if (!isMinimapDragging) {
      return
    }
    const changedTouches = Array.from(e.changedTouches || [])
    const touch = changedTouches.find(t => t.identifier === activeTouchId) || changedTouches[0]
    if (touch) {
      handlePointerNavigation(touch)
    }
    isMinimapDragging = false
    activeTouchId = null
    e.preventDefault()
  }

  minimapElement.addEventListener('touchend', endTouchDrag, { passive: false })
  minimapElement.addEventListener('touchcancel', endTouchDrag, { passive: false })

  // Prevent context menu on minimap
  minimapElement.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    return false
  })
}

export function handleMinimapClick(e, gameCanvas) {
  // Get minimap dimensions
  const minimap = e.target
  const minimapRect = minimap.getBoundingClientRect()
  // Device pixel ratio not needed for this calculation
  // const pixelRatio = window.devicePixelRatio || 1

  // Calculate click position relative to minimap
  // Use CSS dimensions (display size) for calculating click position
  const clickX = (e.clientX - minimapRect.left) / minimapRect.width
  const clickY = (e.clientY - minimapRect.top) / minimapRect.height

  // Use logical (CSS) dimensions for scroll calculation, not the scaled canvas dimensions
  // The actual game coordinate space should use CSS dimensions
  const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
  const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight

  // Calculate new scroll position
  const newX = clickX * (MAP_TILES_X * TILE_SIZE - logicalCanvasWidth)
  const newY = clickY * (MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight)

  // Update gameState.scrollOffset
  gameState.scrollOffset.x = Math.max(0, Math.min(newX, MAP_TILES_X * TILE_SIZE - logicalCanvasWidth))
  gameState.scrollOffset.y = Math.max(0, Math.min(newY, MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight))
}

const mobileMinimapState = {
  overlay: null,
  button: null,
  originalParent: null,
  originalNextSibling: null,
  holdPointerId: null,
  layoutEnabled: false,
  initialized: false,
  keyActive: false,
  positionFrame: null
}

function ensureMobileMinimapElements() {
  if (typeof document === 'undefined') {
    return false
  }

  if (!mobileMinimapState.overlay || !mobileMinimapState.overlay.isConnected) {
    mobileMinimapState.overlay = document.getElementById('mobileMinimapOverlay')
  }

  if (!mobileMinimapState.button || !mobileMinimapState.button.isConnected) {
    mobileMinimapState.button = document.getElementById('mobileMinimapButton')
  }

  return !!(mobileMinimapState.overlay && mobileMinimapState.button)
}

function restoreMinimapToOriginalParent() {
  if (typeof document === 'undefined') {
    return
  }

  const minimap = document.getElementById('minimap')
  const { overlay, originalParent, originalNextSibling } = mobileMinimapState
  if (!minimap) {
    return
  }

  if (overlay && overlay.contains(minimap) && originalParent) {
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(minimap, originalNextSibling)
    } else {
      originalParent.appendChild(minimap)
    }
  }

  mobileMinimapState.originalParent = null
  mobileMinimapState.originalNextSibling = null
}

function setMobileMinimapOverlayVisible(visible) {
  if (!ensureMobileMinimapElements()) {
    return
  }

  const minimap = document.getElementById('minimap')
  const { overlay, button } = mobileMinimapState
  if (!minimap || !overlay) {
    return
  }

  if (visible) {
    if (!mobileMinimapState.layoutEnabled) {
      return
    }
    const currentParent = minimap.parentNode
    if (currentParent && currentParent !== overlay) {
      mobileMinimapState.originalParent = currentParent
      mobileMinimapState.originalNextSibling = minimap.nextSibling
    }
    if (minimap.parentNode !== overlay) {
      overlay.appendChild(minimap)
    }
    overlay.classList.add('visible')
    overlay.setAttribute('aria-hidden', 'false')
    if (button) {
      button.setAttribute('aria-pressed', 'true')
    }
    scheduleMobileOverlayPositionUpdate()
  } else {
    restoreMinimapToOriginalParent()
    if (overlay) {
      overlay.classList.remove('visible')
      overlay.setAttribute('aria-hidden', 'true')
      overlay.style.left = ''
      overlay.style.right = ''
      overlay.style.top = ''
      overlay.style.bottom = ''
      overlay.style.transform = ''
    }
    if (button) {
      button.setAttribute('aria-pressed', 'false')
    }
    if (mobileMinimapState.positionFrame !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(mobileMinimapState.positionFrame)
    }
    mobileMinimapState.positionFrame = null
  }
}

function updateMobileOverlayPosition() {
  mobileMinimapState.positionFrame = null

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }

  if (!mobileMinimapState.layoutEnabled) {
    return
  }

  if (!ensureMobileMinimapElements()) {
    return
  }

  const { overlay, button } = mobileMinimapState
  if (!overlay || !button || !overlay.classList.contains('visible')) {
    return
  }

  const buttonRect = button.getBoundingClientRect()
  if ((buttonRect.width === 0 && buttonRect.height === 0) || !Number.isFinite(buttonRect.left)) {
    return
  }

  const overlayRect = overlay.getBoundingClientRect()
  const overlayHeight = overlayRect.height || overlay.offsetHeight || 0
  const viewport = window.visualViewport
  const viewportTop = viewport ? viewport.offsetTop : 0
  const viewportLeft = viewport ? viewport.offsetLeft : 0

  const left = Math.max(buttonRect.left + viewportLeft, 0)
  const top = buttonRect.bottom - overlayHeight + viewportTop

  overlay.style.left = `${left}px`
  overlay.style.top = `${top}px`
  overlay.style.bottom = ''
  overlay.style.right = ''
  overlay.style.transform = ''
}

function scheduleMobileOverlayPositionUpdate() {
  if (typeof window === 'undefined') {
    updateMobileOverlayPosition()
    return
  }

  if (mobileMinimapState.positionFrame !== null && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(mobileMinimapState.positionFrame)
    mobileMinimapState.positionFrame = null
  }

  if (typeof window.requestAnimationFrame === 'function') {
    mobileMinimapState.positionFrame = window.requestAnimationFrame(updateMobileOverlayPosition)
  } else {
    updateMobileOverlayPosition()
  }
}

function endMobileMinimapHold(pointerId) {
  if (mobileMinimapState.holdPointerId !== pointerId) {
    return
  }
  mobileMinimapState.holdPointerId = null
  setMobileMinimapOverlayVisible(false)
}

function handleMobileMinimapPointerDown(event) {
  if (!mobileMinimapState.layoutEnabled) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  if (!ensureMobileMinimapElements()) {
    return
  }

  mobileMinimapState.holdPointerId = event.pointerId

  setMobileMinimapOverlayVisible(true)
}

function handleMobileMinimapPointerUp(event) {
  endMobileMinimapHold(event.pointerId)
}

function handleMobileMinimapKeyDown(event) {
  if (event.repeat) {
    return
  }
  if (!mobileMinimapState.layoutEnabled) {
    return
  }
  if (event.code !== 'Space' && event.code !== 'Enter') {
    return
  }
  mobileMinimapState.keyActive = true
  event.preventDefault()
  setMobileMinimapOverlayVisible(true)
}

function handleMobileMinimapKeyUp(event) {
  if (!mobileMinimapState.keyActive) {
    return
  }
  if (event.code !== 'Space' && event.code !== 'Enter') {
    return
  }
  mobileMinimapState.keyActive = false
  event.preventDefault()
  setMobileMinimapOverlayVisible(false)
}

function initializeMobileMinimapToggle() {
  if (mobileMinimapState.initialized || typeof document === 'undefined') {
    return
  }

  if (!ensureMobileMinimapElements()) {
    return
  }

  const { button } = mobileMinimapState
  if (!button) {
    return
  }

  button.setAttribute('aria-pressed', 'false')
  button.addEventListener('pointerdown', handleMobileMinimapPointerDown)
  button.addEventListener('pointerup', handleMobileMinimapPointerUp)
  button.addEventListener('pointercancel', handleMobileMinimapPointerUp)
  button.addEventListener('keydown', handleMobileMinimapKeyDown)
  button.addEventListener('keyup', handleMobileMinimapKeyUp)
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault()
  })

  document.addEventListener('pointerup', handleMobileMinimapPointerUp)
  document.addEventListener('pointercancel', handleMobileMinimapPointerUp)

  mobileMinimapState.initialized = true
}

function disableMobileMinimapOverlay() {
  mobileMinimapState.holdPointerId = null
  mobileMinimapState.keyActive = false
  setMobileMinimapOverlayVisible(false)
}

if (typeof document !== 'undefined') {
  const init = () => {
    initializeMobileMinimapToggle()
    if (document.body) {
      mobileMinimapState.layoutEnabled = document.body.classList.contains('mobile-landscape')
    }
    if (!mobileMinimapState.layoutEnabled) {
      setMobileMinimapOverlayVisible(false)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }

  document.addEventListener('mobile-landscape-layout-changed', (event) => {
    const enabled = !!(event && event.detail && event.detail.enabled)
    mobileMinimapState.layoutEnabled = enabled
    if (!enabled) {
      disableMobileMinimapOverlay()
    } else if (mobileMinimapState.initialized) {
      // Ensure the minimap returns to its sidebar when re-entering mobile layout
      restoreMinimapToOriginalParent()
      setMobileMinimapOverlayVisible(false)
    }
    scheduleMobileOverlayPositionUpdate()
  })

  window.addEventListener('blur', () => {
    disableMobileMinimapOverlay()
  })

  window.addEventListener('resize', scheduleMobileOverlayPositionUpdate)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleMobileOverlayPositionUpdate)
    window.visualViewport.addEventListener('scroll', scheduleMobileOverlayPositionUpdate)
  }
}
