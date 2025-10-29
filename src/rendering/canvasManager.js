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

    const safeLeft = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-left')) : 0
    const safeRight = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-right')) : 0
    const safeTop = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-top')) : 0
    const safeBottom = bodyStyle ? parseSafeInset(bodyStyle.getPropertyValue('--safe-area-bottom')) : 0

    const isTouchLayout = body ? body.classList.contains('is-touch') : false

    const widthCandidates = []
    widthCandidates.push(window.innerWidth)
    if (window.visualViewport && window.visualViewport.width) {
      widthCandidates.push(window.visualViewport.width)
    }
    if (document.documentElement && document.documentElement.clientWidth) {
      widthCandidates.push(document.documentElement.clientWidth)
    }
    if (isTouchLayout && window.screen && window.screen.width) {
      widthCandidates.push(window.screen.width / pixelRatio)
    }

    const validWidths = widthCandidates.filter(v => Number.isFinite(v) && v > 0)
    const baseViewportWidth = validWidths.length
      ? Math.max(...validWidths)
      : this.gameCanvas.clientWidth || 0

    const heightCandidates = []
    heightCandidates.push(window.innerHeight)
    if (window.visualViewport && window.visualViewport.height) {
      heightCandidates.push(window.visualViewport.height)
    }
    if (document.documentElement && document.documentElement.clientHeight) {
      heightCandidates.push(document.documentElement.clientHeight)
    }

    const validHeights = heightCandidates.filter(v => Number.isFinite(v) && v > 0)
    const baseViewportHeight = validHeights.length
      ? Math.max(...validHeights)
      : this.gameCanvas.clientHeight || 0
    const sidebar = document.getElementById('sidebar')
    const rawSidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 250
    const mobileLandscape = body ? body.classList.contains('mobile-landscape') : false
    const safeAdjustment = mobileLandscape ? safeLeft : safeLeft
    const sidebarBaseWidth = Math.max(0, rawSidebarWidth - safeAdjustment)

    if (document.documentElement) {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarBaseWidth}px`)
    }

    const safeHorizontalPadding = mobileLandscape ? safeLeft + safeRight : 0
    const safeVerticalPadding = mobileLandscape ? safeTop + safeBottom : 0

    // Set canvas display size (CSS)
    const canvasCssWidth = mobileLandscape
      ? Math.max(0, baseViewportWidth + safeHorizontalPadding)
      : Math.max(0, baseViewportWidth - rawSidebarWidth)
    const canvasCssHeight = Math.max(0, baseViewportHeight + safeVerticalPadding)

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
