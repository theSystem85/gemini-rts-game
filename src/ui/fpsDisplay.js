// fpsDisplay.js - FPS overlay system using DOM element
import { gameState } from '../gameState.js'
import { notifyBenchmarkFrame } from '../benchmark/benchmarkTracker.js'

export class FPSDisplay {
  constructor() {
    this.frameCount = 0
    this.lastTime = performance.now()
    this.fps = 0
    this.frameTimes = []
    this.maxFrameTimes = 60 // Store last 60 frame times for smooth averaging

    // Frame time tracking
    this.lastFrameTimestamp = performance.now()
    this.frameTimeSamples = []
    this.lastFrameTimeUpdate = performance.now()
    this.avgFrameTime = 0
    this.minFrameTime = 0
    this.maxFrameTime = 0
    this.lastDomUpdate = performance.now()

    // Get the DOM element
    this.fpsElement = document.getElementById('fpsDisplay')
    if (!this.fpsElement) {
      console.error('FPS display element not found!')
    }

    this.fpsValueEl = document.getElementById('fpsValue')
    this.frameTimeEl = document.getElementById('frameTimeValue')
    this.frameTimeMinEl = document.getElementById('frameTimeMin')
    this.frameTimeMaxEl = document.getElementById('frameTimeMax')
  }

  updateFPS(currentTime) {
    this.frameCount++

    // Add current frame time to array
    this.frameTimes.push(currentTime)

    // Track frame time for display
    const frameTime = currentTime - this.lastFrameTimestamp
    this.lastFrameTimestamp = currentTime
    this.frameTimeSamples.push(frameTime)

    notifyBenchmarkFrame({ timestamp: currentTime, frameTime })

    // Keep only the last 60 frame times
    if (this.frameTimes.length > this.maxFrameTimes) {
      this.frameTimes.shift()
    }

    // Calculate FPS every 10 frames for better performance
    if (this.frameCount % 10 === 0 && this.frameTimes.length >= 2) {
      const timeDiff = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0]
      const frameCount = this.frameTimes.length - 1

      if (timeDiff > 0) {
        this.fps = Math.round((frameCount * 1000) / timeDiff)
      }

      // Update gameState for consistency
      gameState.fpsCounter.fps = this.fps
      gameState.fpsCounter.frameCount = this.frameCount
      gameState.fpsCounter.lastTime = currentTime
      gameState.fpsCounter.frameTimes = [...this.frameTimes]

      // Throttle DOM updates to once per second
      if (currentTime - this.lastDomUpdate >= 1000) {
        this.updateDisplay(currentTime)
      }
    }

    // Update frame time display every second
    if (currentTime - this.lastFrameTimeUpdate >= 1000) {
      const len = this.frameTimeSamples.length
      if (len > 0) {
        const sum = this.frameTimeSamples.reduce((a, b) => a + b, 0)
        this.avgFrameTime = sum / len
        this.minFrameTime = Math.min(...this.frameTimeSamples)
        this.maxFrameTime = Math.max(...this.frameTimeSamples)

        // Update gameState for consistency
        gameState.fpsCounter.avgFrameTime = this.avgFrameTime
        gameState.fpsCounter.minFrameTime = this.minFrameTime
        gameState.fpsCounter.maxFrameTime = this.maxFrameTime
      }

      this.frameTimeSamples = []
      this.lastFrameTimeUpdate = currentTime
      if (currentTime - this.lastDomUpdate >= 1000) {
        this.updateDisplay(currentTime)
      }
    }
  }

  updateDisplay(currentTime = performance.now()) {
    if (currentTime - this.lastDomUpdate < 1000) {
      return
    }
    this.lastDomUpdate = currentTime
    if (!this.fpsElement) return

    if (gameState.fpsVisible) {
      if (this.fpsValueEl) {
        this.fpsValueEl.textContent = `FPS: ${this.fps}`
      } else {
        this.fpsElement.textContent = `FPS: ${this.fps}`
      }

      if (this.frameTimeEl) {
        this.frameTimeEl.textContent = `Frame: ${this.avgFrameTime.toFixed(1)} ms`
      }
      if (this.frameTimeMinEl) {
        this.frameTimeMinEl.textContent = `Min: ${this.minFrameTime.toFixed(1)} ms`
      }
      if (this.frameTimeMaxEl) {
        this.frameTimeMaxEl.textContent = `Max: ${this.maxFrameTime.toFixed(1)} ms`
      }

      this.fpsElement.classList.add('visible')

      // Remove old color classes
      this.fpsElement.classList.remove('fps-good', 'fps-ok', 'fps-poor', 'fps-bad')

      // Add appropriate color class based on FPS
      const colorClass = this.getFPSColorClass(this.fps)
      this.fpsElement.classList.add(colorClass)
    } else {
      this.fpsElement.classList.remove('visible')
    }
  }

  getFPSColorClass(fps) {
    // Return CSS class based on FPS performance
    if (fps >= 60) {
      return 'fps-good' // Green for good performance
    } else if (fps >= 30) {
      return 'fps-ok' // Yellow for acceptable performance
    } else if (fps >= 15) {
      return 'fps-poor' // Orange for poor performance
    } else {
      return 'fps-bad' // Red for very poor performance
    }
  }

  // Legacy render method for compatibility (now just updates display)
  render(_ctx, _canvas) {
    this.updateDisplay()
  }

  toggleVisibility() {
    gameState.fpsVisible = !gameState.fpsVisible
    this.updateDisplay()
  }

  isVisible() {
    return gameState.fpsVisible
  }
}
