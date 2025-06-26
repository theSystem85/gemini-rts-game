// fpsDisplay.js - FPS overlay system using DOM element
import { gameState } from '../gameState.js'

export class FPSDisplay {
  constructor() {
    this.frameCount = 0
    this.lastTime = performance.now()
    this.fps = 0
    this.frameTimes = []
    this.maxFrameTimes = 60 // Store last 60 frame times for smooth averaging
    
    // Get the DOM element
    this.fpsElement = document.getElementById('fpsDisplay')
    if (!this.fpsElement) {
      console.error('FPS display element not found!')
    }
  }

  updateFPS(currentTime) {
    this.frameCount++
    
    // Add current frame time to array
    this.frameTimes.push(currentTime)
    
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
      
      // Update the DOM element
      this.updateDisplay()
    }
  }

  updateDisplay() {
    if (!this.fpsElement) return

    if (gameState.fpsVisible) {
      this.fpsElement.textContent = `FPS: ${this.fps}`
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
  render(ctx, canvas) {
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
