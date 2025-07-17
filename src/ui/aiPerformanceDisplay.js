// aiPerformanceDisplay.js - Display AI performance metrics
export class AIPerformanceDisplay {
  constructor() {
    this.visible = false
    this.lastUpdateTime = 0
    this.updateInterval = 1000 // Update every second
  }

  /**
   * Toggle visibility of AI performance display
   */
  toggle() {
    this.visible = !this.visible
    console.log('AI Performance Display:', this.visible ? 'enabled' : 'disabled')
  }

  /**
   * Set visibility of AI performance display
   * @param {boolean} visible - Whether to show the display
   */
  setVisible(visible) {
    this.visible = visible
  }

  /**
   * Render AI performance metrics on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} performanceData - AI performance data
   */
  render(ctx, canvas, performanceData) {
    if (!this.visible) {
      return
    }

    const now = performance.now()
    if (now - this.lastUpdateTime < this.updateInterval) {
      return // Don't update too frequently
    }
    this.lastUpdateTime = now

    // Save context state
    ctx.save()

    // Display background
    const x = 10
    const y = canvas.height - 200
    const width = 280
    const height = 160

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(x, y, width, height)

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)

    // Display text
    ctx.fillStyle = '#00ff00'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'

    let textY = y + 20

    // Title
    ctx.fillStyle = '#ffff00'
    ctx.fillText('AI Performance Metrics', x + 10, textY)
    textY += 20

    ctx.fillStyle = '#00ff00'

    // Current interval
    const currentInterval = performanceData.currentInterval || 'N/A'
    ctx.fillText(`Current Interval: ${currentInterval}ms`, x + 10, textY)
    textY += 15

    // Base interval
    const baseInterval = performanceData.baseInterval || 'N/A'
    ctx.fillText(`Base Interval: ${baseInterval}ms`, x + 10, textY)
    textY += 15

    // Average iteration time
    const avgTime = performanceData.averageIterationTime
    const avgTimeStr = avgTime ? avgTime.toFixed(2) + 'ms' : 'N/A'
    ctx.fillText(`Avg Iteration: ${avgTimeStr}`, x + 10, textY)
    textY += 15

    // Last iteration time
    const lastTime = performanceData.lastIterationTime
    const lastTimeStr = lastTime ? lastTime.toFixed(2) + 'ms' : 'N/A'
    ctx.fillText(`Last Iteration: ${lastTimeStr}`, x + 10, textY)
    textY += 15

    // Iteration count
    const iterationCount = performanceData.iterationCount || 0
    ctx.fillText(`Total Iterations: ${iterationCount}`, x + 10, textY)
    textY += 15

    // AI loop status
    const aiLoopActive = performanceData.aiLoopActive ? 'Running' : 'Stopped'
    const statusColor = performanceData.aiLoopActive ? '#00ff00' : '#ff6666'
    ctx.fillStyle = statusColor
    ctx.fillText(`AI Loop: ${aiLoopActive}`, x + 10, textY)
    textY += 15

    // Processing status
    const isProcessing = performanceData.isProcessing ? 'Processing' : 'Idle'
    const processingColor = performanceData.isProcessing ? '#ffff00' : '#00ff00'
    ctx.fillStyle = processingColor
    ctx.fillText(`Status: ${isProcessing}`, x + 10, textY)
    textY += 15

    // Processing mode
    const processingMode = performanceData.processingMode || 'unknown'
    const modeColor = this.getModeColor(processingMode)
    ctx.fillStyle = modeColor
    ctx.fillText(`Mode: ${processingMode.toUpperCase()}`, x + 10, textY)
    textY += 15

    // Worker status
    if (performanceData.workersReady) {
      const { timing, computation } = performanceData.workersReady
      
      ctx.fillStyle = timing ? '#00ff00' : '#ff4444'
      ctx.fillText(`Timing Worker: ${timing ? 'READY' : 'NOT READY'}`, x + 10, textY)
      textY += 15
      
      ctx.fillStyle = computation ? '#00ff00' : '#ff4444'
      ctx.fillText(`Compute Worker: ${computation ? 'READY' : 'NOT READY'}`, x + 10, textY)
      textY += 15
    }

    // Computation metrics
    if (performanceData.computation) {
      const comp = performanceData.computation
      ctx.fillStyle = '#88aaff'
      ctx.fillText(`Compute Avg: ${comp.averageTime?.toFixed(1) || 'N/A'}ms`, x + 10, textY)
      textY += 15
      ctx.fillText(`Compute Total: ${comp.totalIterations || 0}`, x + 10, textY)
      textY += 15
    }

    // Performance history graph (simple)
    if (performanceData.performanceHistory && performanceData.performanceHistory.length > 0) {
      this.renderPerformanceGraph(ctx, x + 10, y + 120, 260, 30, performanceData.performanceHistory)
    }

    // Restore context state
    ctx.restore()
  }

  /**
   * Render a simple performance graph
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Graph width
   * @param {number} height - Graph height
   * @param {Array} data - Performance history data
   */
  renderPerformanceGraph(ctx, x, y, width, height, data) {
    if (!data || data.length === 0) {
      return
    }

    // Graph background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(x, y, width, height)

    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, width, height)

    // Find max value for scaling
    const maxValue = Math.max(...data, 300) // At least 300ms scale

    // Draw data points
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 1
    ctx.beginPath()

    const stepX = width / (data.length - 1)
    
    for (let i = 0; i < data.length; i++) {
      const dataX = x + i * stepX
      const dataY = y + height - (data[i] / maxValue) * height
      
      if (i === 0) {
        ctx.moveTo(dataX, dataY)
      } else {
        ctx.lineTo(dataX, dataY)
      }
    }
    
    ctx.stroke()

    // Draw baseline at base interval (300ms)
    const baselineY = y + height - (300 / maxValue) * height
    ctx.strokeStyle = '#ffff00'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(x, baselineY)
    ctx.lineTo(x + width, baselineY)
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = '#aaa'
    ctx.font = '10px monospace'
    ctx.fillText('Iteration Time History', x, y - 5)
  }

  /**
   * Get color for processing mode
   * @param {string} mode - Processing mode
   * @returns {string} Color code
   */
  getModeColor(mode) {
    switch (mode) {
      case 'worker':
        return '#00ff00'  // Green for worker mode
      case 'chunked':
        return '#ffaa00'  // Orange for chunked mode
      case 'synchronous':
        return '#ff4444'  // Red for synchronous mode
      default:
        return '#888888'  // Gray for unknown
    }
  }
}
