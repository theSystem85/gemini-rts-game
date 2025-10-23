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
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const sidebar = document.getElementById('sidebar')
    const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 250

    if (document.documentElement) {
      document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    }

    // Set canvas display size (CSS)
    const availableWidth = Math.max(0, viewportWidth - sidebarWidth)
    const logicalHeight = viewportHeight

    this.gameCanvas.style.left = `${sidebarWidth}px`
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
    const minimapWidth = Math.max(140, Math.round(sidebarWidth - 20))
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
