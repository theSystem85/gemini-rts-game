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
    const mobileLandscape = body ? body.classList.contains('mobile-landscape') : false
    const safeAdjustment = mobileLandscape ? safeLeft : safeLeft
    const sidebarBaseWidth = Math.max(0, rawSidebarWidth - safeAdjustment)

    if (document.documentElement) {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarBaseWidth}px`)
    }

    // Set canvas display size (CSS)
    const availableWidth = mobileLandscape
      ? Math.max(0, viewportWidth)
      : Math.max(0, viewportWidth - rawSidebarWidth)
    const logicalHeight = viewportHeight

    this.gameCanvas.style.left = mobileLandscape ? '0px' : `${rawSidebarWidth}px`
    this.gameCanvas.style.right = 'auto'
    this.gameCanvas.style.width = `${availableWidth}px`
    this.gameCanvas.style.height = `${logicalHeight}px`

    // Set actual pixel size scaled by device pixel ratio
    this.gameCanvas.width = Math.max(1, Math.round(availableWidth * pixelRatio))
    this.gameCanvas.height = Math.max(1, Math.round(logicalHeight * pixelRatio))

    // Calculate visible canvas dimensions (accounting for overlaying panels in mobile landscape)
    if (mobileLandscape) {
      const mobileBuildMenu = document.getElementById('mobileBuildMenuContainer')
      const buildMenuWidth = mobileBuildMenu ? mobileBuildMenu.getBoundingClientRect().width : 0
      const sidebarCollapsed = body ? body.classList.contains('sidebar-collapsed') : true
      const effectiveSidebarWidth = sidebarCollapsed ? 0 : rawSidebarWidth
      
      // Store visible dimensions for use by game logic
      this.visibleWidth = Math.max(0, availableWidth - effectiveSidebarWidth - buildMenuWidth)
      this.visibleHeight = logicalHeight
      this.visibleOffsetX = effectiveSidebarWidth
      this.visibleOffsetY = 0
    } else {
      // In desktop mode, the entire canvas is visible
      this.visibleWidth = availableWidth
      this.visibleHeight = logicalHeight
      this.visibleOffsetX = 0
      this.visibleOffsetY = 0
    }

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

  getVisibleCanvasWidth() {
    return this.visibleWidth !== undefined ? this.visibleWidth : this.gameCanvas.width
  }

  getVisibleCanvasHeight() {
    return this.visibleHeight !== undefined ? this.visibleHeight : this.gameCanvas.height
  }

  getVisibleCanvasOffsetX() {
    return this.visibleOffsetX !== undefined ? this.visibleOffsetX : 0
  }

  getVisibleCanvasOffsetY() {
    return this.visibleOffsetY !== undefined ? this.visibleOffsetY : 0
  }
}
