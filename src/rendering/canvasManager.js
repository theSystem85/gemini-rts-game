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

    const isTouchLayout = body ? body.classList.contains('is-touch') : false

    const widthCandidates = []
    widthCandidates.push(window.innerWidth + safeLeft + safeRight)
    if (window.visualViewport && window.visualViewport.width) {
      widthCandidates.push(window.visualViewport.width + safeLeft + safeRight)
    }
    if (isTouchLayout && window.screen && window.screen.width) {
      widthCandidates.push(window.screen.width / pixelRatio)
    }

    const viewportWidth = Math.max(...widthCandidates.filter(v => Number.isFinite(v) && v > 0))

    const heightCandidates = []
    heightCandidates.push(window.innerHeight)
    if (window.visualViewport && window.visualViewport.height) {
      heightCandidates.push(window.visualViewport.height)
    }

    const viewportHeight = Math.max(...heightCandidates.filter(v => Number.isFinite(v) && v > 0))
    const sidebar = document.getElementById('sidebar')
    const rawSidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 250
    const moveSidebarRight = body ? body.classList.contains('mobile-sidebar-right') : false
    const safeAdjustment = moveSidebarRight ? safeRight : safeLeft
    const sidebarBaseWidth = Math.max(0, rawSidebarWidth - safeAdjustment)

    if (document.documentElement) {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarBaseWidth}px`)
    }

    // Set canvas display size (CSS)
    const availableWidth = Math.max(0, viewportWidth - rawSidebarWidth)
    const logicalHeight = viewportHeight

    if (moveSidebarRight) {
      this.gameCanvas.style.left = '0px'
    } else {
      this.gameCanvas.style.left = `${rawSidebarWidth}px`
    }
    this.gameCanvas.style.right = 'auto'
    this.gameCanvas.style.width = `${availableWidth}px`
    this.gameCanvas.style.height = `${logicalHeight}px`

    // Set actual pixel size scaled by device pixel ratio
    this.gameCanvas.width = Math.max(1, Math.round(availableWidth * pixelRatio))
    this.gameCanvas.height = Math.max(1, Math.round(logicalHeight * pixelRatio))

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
