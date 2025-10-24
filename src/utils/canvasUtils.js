// canvasUtils.js
// Utility functions for getting actual visible canvas dimensions
// Accounts for overlaying UI panels in mobile landscape mode

/**
 * Gets the visible canvas dimensions, accounting for overlaying panels
 * @returns {Object} { width, height, offsetX, offsetY }
 */
export function getVisibleCanvasDimensions() {
  const gameCanvas = document.getElementById('gameCanvas')
  if (!gameCanvas) {
    return { width: 800, height: 600, offsetX: 0, offsetY: 0 }
  }

  const body = document.body
  const mobileLandscape = body ? body.classList.contains('mobile-landscape') : false

  if (mobileLandscape) {
    // In mobile landscape mode, panels overlay the canvas
    const sidebar = document.getElementById('sidebar')
    const mobileBuildMenu = document.getElementById('mobileBuildMenuContainer')
    const sidebarCollapsed = body ? body.classList.contains('sidebar-collapsed') : true
    
    const sidebarWidth = (sidebar && !sidebarCollapsed) ? sidebar.getBoundingClientRect().width : 0
    const buildMenuWidth = mobileBuildMenu ? mobileBuildMenu.getBoundingClientRect().width : 0
    
    const canvasWidth = parseInt(gameCanvas.style.width, 10) || gameCanvas.width
    const canvasHeight = parseInt(gameCanvas.style.height, 10) || gameCanvas.height
    
    return {
      width: Math.max(0, canvasWidth - sidebarWidth - buildMenuWidth),
      height: canvasHeight,
      offsetX: sidebarWidth,
      offsetY: 0
    }
  } else {
    // In desktop mode, use the full canvas dimensions
    const canvasWidth = parseInt(gameCanvas.style.width, 10) || gameCanvas.width
    const canvasHeight = parseInt(gameCanvas.style.height, 10) || gameCanvas.height
    
    return {
      width: canvasWidth,
      height: canvasHeight,
      offsetX: 0,
      offsetY: 0
    }
  }
}
