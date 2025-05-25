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

    // Set canvas display size (CSS)
    this.gameCanvas.style.width = `${window.innerWidth - 250}px`
    this.gameCanvas.style.height = `${window.innerHeight}px`

    // Set actual pixel size scaled by device pixel ratio
    this.gameCanvas.width = (window.innerWidth - 250) * pixelRatio
    this.gameCanvas.height = window.innerHeight * pixelRatio

    // Scale the drawing context to counter the device pixel ratio
    this.gameCtx.scale(pixelRatio, pixelRatio)

    // Maintain high-quality rendering
    this.gameCtx.imageSmoothingEnabled = true
    this.gameCtx.imageSmoothingQuality = 'high'

    // Set minimap size - make it fit entirely in the sidebar
    this.minimapCanvas.style.width = '230px' // Slightly smaller than sidebar width (250px)
    this.minimapCanvas.style.height = '138px' // Keep aspect ratio
    this.minimapCanvas.width = 230 * pixelRatio
    this.minimapCanvas.height = 138 * pixelRatio

    // Scale minimap context
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
