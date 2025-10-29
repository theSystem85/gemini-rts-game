// layoutMetrics.js
// Utility helpers for computing canvas and viewport dimensions that account for
// safe-area insets and mobile overlays.

const DEFAULT_SIDEBAR_WIDTH = 250

function parsePixelValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function getRootComputedStyle() {
  if (!document.documentElement) {
    return null
  }
  try {
    return window.getComputedStyle(document.documentElement)
  } catch {
    return null
  }
}

function getBodyComputedStyle() {
  if (!document.body) {
    return null
  }
  try {
    return window.getComputedStyle(document.body)
  } catch {
    return null
  }
}

export function getSidebarWidth() {
  const rootStyle = getRootComputedStyle()
  if (!rootStyle) {
    return DEFAULT_SIDEBAR_WIDTH
  }
  const sidebarWidth = parsePixelValue(rootStyle.getPropertyValue('--sidebar-width'))
  return sidebarWidth > 0 ? sidebarWidth : DEFAULT_SIDEBAR_WIDTH
}

export function getSafeAreaInset(side) {
  const bodyStyle = getBodyComputedStyle()
  if (!bodyStyle) {
    return 0
  }
  return parsePixelValue(bodyStyle.getPropertyValue(`--safe-area-${side}`))
}

export function getCanvasLogicalWidth(gameCanvas) {
  if (gameCanvas) {
    const styleWidth = parsePixelValue(gameCanvas.style?.width)
    if (styleWidth > 0) {
      return styleWidth
    }
    const clientWidth = gameCanvas.clientWidth
    if (Number.isFinite(clientWidth) && clientWidth > 0) {
      return clientWidth
    }
    if (typeof gameCanvas.getBoundingClientRect === 'function') {
      const rect = gameCanvas.getBoundingClientRect()
      if (rect && Number.isFinite(rect.width) && rect.width > 0) {
        return rect.width
      }
    }
  }

  const baseWidth = Number.isFinite(window.innerWidth) ? window.innerWidth : 0
  return Math.max(0, baseWidth - getSidebarWidth())
}

export function getCanvasLogicalHeight(gameCanvas) {
  if (gameCanvas) {
    const styleHeight = parsePixelValue(gameCanvas.style?.height)
    if (styleHeight > 0) {
      return styleHeight
    }
    const clientHeight = gameCanvas.clientHeight
    if (Number.isFinite(clientHeight) && clientHeight > 0) {
      return clientHeight
    }
    if (typeof gameCanvas.getBoundingClientRect === 'function') {
      const rect = gameCanvas.getBoundingClientRect()
      if (rect && Number.isFinite(rect.height) && rect.height > 0) {
        return rect.height
      }
    }
  }

  return Number.isFinite(window.innerHeight) ? window.innerHeight : 0
}

export function getMobileLandscapeRightUiWidth() {
  if (!document?.body || !document.body.classList.contains('mobile-landscape')) {
    return 0
  }

  const buildMenu = document.getElementById('mobileBuildMenuContainer')
  if (!buildMenu || buildMenu.getAttribute('aria-hidden') === 'true') {
    return 0
  }

  const rect = typeof buildMenu.getBoundingClientRect === 'function'
    ? buildMenu.getBoundingClientRect()
    : null

  if (rect && Number.isFinite(rect.width) && rect.width > 0) {
    return rect.width
  }

  return 0
}

export function getPlayableViewportWidth(gameCanvas) {
  const logicalWidth = getCanvasLogicalWidth(gameCanvas)
  if (logicalWidth <= 0) {
    return 0
  }

  const safeLeft = getSafeAreaInset('left')
  const safeRight = getSafeAreaInset('right')
  const rightUiWidth = getMobileLandscapeRightUiWidth()
  const rightObstruction = Math.max(safeRight, rightUiWidth)

  return Math.max(0, logicalWidth - safeLeft - rightObstruction)
}

export function getPlayableViewportHeight(gameCanvas) {
  const logicalHeight = getCanvasLogicalHeight(gameCanvas)
  if (logicalHeight <= 0) {
    return 0
  }

  const safeTop = getSafeAreaInset('top')
  const safeBottom = getSafeAreaInset('bottom')

  return Math.max(0, logicalHeight - safeTop - safeBottom)
}
