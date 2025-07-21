import { gameState } from '../gameState.js'
import { resetPerformanceStatistics } from '../performanceUtils.js'

class PerformanceDialog {
  constructor() {
    this.container = document.getElementById('performanceDialog')
    this.sortMode = 'duration'
    this.intervalId = null
    if (this.container) {
      this.container.innerHTML = `
        <div class="perf-controls">
          <button id="perfSortName">Name</button>
          <button id="perfSortDuration">Avg</button>
          <button id="perfReset">Reset</button>
        </div>
        <div id="perfContent"></div>
      `
      this.contentEl = document.getElementById('perfContent')
      document.getElementById('perfSortName').addEventListener('click', () => {
        this.sortMode = 'name'
        this.render()
      })
      document.getElementById('perfSortDuration').addEventListener('click', () => {
        this.sortMode = 'duration'
        this.render()
      })
      document.getElementById('perfReset').addEventListener('click', () => {
        resetPerformanceStatistics()
        this.render()
      })
    }
  }

  toggle() {
    if (!this.container) return
    gameState.performanceVisible = !gameState.performanceVisible
    if (gameState.performanceVisible) {
      this.container.classList.add('visible')
      this.start()
    } else {
      this.container.classList.remove('visible')
      this.stop()
    }
  }

  start() {
    this.render()
    this.intervalId = setInterval(() => this.render(), 2000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  render() {
    if (!this.contentEl) return
    const stats = window.performanceStatistics || {}
    const entries = Object.entries(stats)
    if (this.sortMode === 'duration') {
      entries.sort((a, b) => b[1].durationAvg - a[1].durationAvg)
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]))
    }
    this.contentEl.innerHTML = ''
    entries.forEach(([name, data]) => {
      const div = document.createElement('div')
      div.textContent = `${name}: avg ${data.durationAvg.toFixed(2)}ms max ${data.durationMax.toFixed(2)}ms calls ${data.callCount}`
      this.contentEl.appendChild(div)
    })
  }
}

export const performanceDialog = new PerformanceDialog()
