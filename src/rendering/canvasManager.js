// canvasManager.js
// Handle canvas setup, resizing, and management

export class CanvasManager {
  constructor() {
    this.gameCanvas = document.getElementById('gameCanvas')
    this.gameCtx = this.gameCanvas.getContext('2d')
    this.minimapCanvas = document.getElementById('minimap')
    this.minimapCtx = this.minimapCanvas.getContext('2d')

    this.setupEventListeners()
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvases())
    this.resizeCanvases()
  }

  resizeCanvases() {
    const pixelRatio = window.devicePixelRatio || 1
    const body = document.body
    const bodyStyle = body ? window.getComputedStyle(body) : null
    const parseSafeInset = (value) => {
      if (!value) return 0
      const parsed = parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    let safeLeft = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-left')) : 0
    let safeRight = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-right')) : 0
    let safeTop = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-top')) : 0
    let safeBottom = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-bottom')) : 0

    const isTouchLayout = body ? body.classList.contains('is-touch') : false

    const viewport = window.visualViewport

    const layoutWidthCandidates = []
    layoutWidthCandidates.push(window.innerWidth)
    if (viewport && viewport.width) {
      layoutWidthCandidates.push(viewport.width)
    }
    if (document.documentElement && document.documentElement.clientWidth) {
      layoutWidthCandidates.push(document.documentElement.clientWidth)
    }

    const validLayoutWidths = layoutWidthCandidates.filter(v => Number.isFinite(v) && v > 0)
    const layoutViewportWidth = validLayoutWidths.length
      ? Math.max(...validLayoutWidths)
      : this.gameCanvas.clientWidth || 0

    const layoutHeightCandidates = []
    layoutHeightCandidates.push(window.innerHeight)
    if (viewport && viewport.height) {
      layoutHeightCandidates.push(viewport.height)
    }
    if (document.documentElement && document.documentElement.clientHeight) {
      layoutHeightCandidates.push(document.documentElement.clientHeight)
    }

    const validLayoutHeights = layoutHeightCandidates.filter(v => Number.isFinite(v) && v > 0)
    const layoutViewportHeight = validLayoutHeights.length
      ? Math.max(...validLayoutHeights)
      : this.gameCanvas.clientHeight || 0

    const screenWidth = isTouchLayout && window.screen && window.screen.width
      ? window.screen.width / pixelRatio
      : 0
    const screenHeight = isTouchLayout && window.screen && window.screen.height
      ? window.screen.height / pixelRatio
      : 0

    if (viewport) {
      const totalWidth = Math.max(layoutViewportWidth, screenWidth)
      const totalHeight = Math.max(layoutViewportHeight, screenHeight)

      const viewportOffsetLeft = Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0
      const viewportOffsetTop = Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0
      const viewportWidth = Number.isFinite(viewport.width) ? viewport.width : 0
      const viewportHeight = Number.isFinite(viewport.height) ? viewport.height : 0

      const fallbackRight = Math.max(0, totalWidth - viewportWidth - viewportOffsetLeft)
      const fallbackBottom = Math.max(0, totalHeight - viewportHeight - viewportOffsetTop)

      safeLeft = Math.max(safeLeft, viewportOffsetLeft)
      safeRight = Math.max(safeRight, fallbackRight)
      safeTop = Math.max(safeTop, viewportOffsetTop)
      safeBottom = Math.max(safeBottom, fallbackBottom)
    }
    const sidebar = document.getElementById('sidebar')
    const rawSidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 250
    const mobileLandscape = body ? body.classList.contains('mobile-landscape') : false
    const safeAdjustment = mobileLandscape ? safeLeft : 0
    const sidebarBaseWidth = Math.max(0, rawSidebarWidth - safeAdjustment)

    if (document.documentElement) {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarBaseWidth}px`)
    }

    const baseCanvasWidth = mobileLandscape
      ? Math.max(layoutViewportWidth + safeLeft + safeRight, screenWidth, 0)
      : layoutViewportWidth
    const baseCanvasHeight = mobileLandscape
      ? Math.max(layoutViewportHeight + safeTop + safeBottom, screenHeight, 0)
      : layoutViewportHeight

    // Set canvas display size (CSS)
    const canvasCssWidth = mobileLandscape
      ? Math.max(0, baseCanvasWidth)
      : Math.max(0, layoutViewportWidth - rawSidebarWidth)
    const canvasCssHeight = Math.max(0, baseCanvasHeight)

    this.gameCanvas.style.position = mobileLandscape ? 'fixed' : 'absolute'

    if (mobileLandscape) {
      this.gameCanvas.style.left = `${-safeLeft}px`
      this.gameCanvas.style.right = `${-safeRight}px`
    } else {
      this.gameCanvas.style.left = `${rawSidebarWidth}px`
      this.gameCanvas.style.right = 'auto'
    }
    this.gameCanvas.style.width = `${canvasCssWidth}px`
    this.gameCanvas.style.height = `${canvasCssHeight}px`
    this.gameCanvas.style.top = mobileLandscape ? `${-safeTop}px` : '0px'
    this.gameCanvas.style.bottom = mobileLandscape ? `${-safeBottom}px` : 'auto'

    // Set actual pixel size scaled by device pixel ratio
    this.gameCanvas.width = Math.max(1, Math.round(canvasCssWidth * pixelRatio))
    this.gameCanvas.height = Math.max(1, Math.round(canvasCssHeight * pixelRatio))

    // Scale the drawing context to counter the device pixel ratio
    this.gameCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.gameCtx.scale(pixelRatio, pixelRatio)

    // Maintain high-quality rendering
    this.gameCtx.imageSmoothingEnabled = true
    this.gameCtx.imageSmoothingQuality = 'high'

    // Set minimap size - make it fit entirely in the sidebar
    const minimapWidth = Math.max(140, Math.round(rawSidebarWidth - 20))
    const minimapHeight = Math.round(minimapWidth * 0.6)
    this.minimapCanvas.style.width = `${minimapWidth}px`
    this.minimapCanvas.style.height = `${minimapHeight}px`
    this.minimapCanvas.width = Math.max(1, Math.round(minimapWidth * pixelRatio))
    this.minimapCanvas.height = Math.max(1, Math.round(minimapHeight * pixelRatio))

    // Scale minimap context
    this.minimapCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.minimapCtx.scale(pixelRatio, pixelRatio)
    this.minimapCtx.imageSmoothingEnabled = true
    this.minimapCtx.imageSmoothingQuality = 'high'
  }

  getGameCanvas() {
    return this.gameCanvas
  }

  getGameContext() {
    return this.gameCtx
  }

  getMinimapCanvas() {
    return this.minimapCanvas
  }

  getMinimapContext() {
    return this.minimapCtx
  }
}
