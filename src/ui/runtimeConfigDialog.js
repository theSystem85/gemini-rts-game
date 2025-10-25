// runtimeConfigDialog.js
// UI dialog for runtime configuration without eval()

import {
  getConfigCategories,
  getConfigsByCategory,
  getConfigValue,
  setConfigValue,
  isConfigMutable
} from '../configRegistry.js'
import { showNotification } from './notifications.js'
import { playSound } from '../sound.js'

export class RuntimeConfigDialog {
  constructor() {
    this.isDialogOpen = false
    this.selectedCategory = null
    this.setupStyles()
  }

  setupStyles() {
    // Inject CSS styles for the runtime config dialog
    if (!document.getElementById('runtime-config-dialog-styles')) {
      const style = document.createElement('style')
      style.id = 'runtime-config-dialog-styles'
      style.textContent = `
        .runtime-config-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          backdrop-filter: blur(2px);
        }

        .runtime-config-dialog {
          background: linear-gradient(135deg, #2a2a2a, #333333);
          border: 2px solid #555555;
          border-radius: 8px;
          padding: 20px;
          min-width: 600px;
          max-width: 800px;
          max-height: 80vh;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          font-family: 'Arial', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .runtime-config-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .runtime-config-dialog h2 {
          color: #ecf0f1;
          margin: 0;
          font-size: 18px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .runtime-config-close {
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
          font-weight: bold;
          transition: background 0.3s ease;
        }

        .runtime-config-close:hover {
          background: #c0392b;
        }

        .runtime-config-categories {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }

        .runtime-config-category-btn {
          background: #444444;
          color: #ecf0f1;
          border: 1px solid #666666;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .runtime-config-category-btn:hover {
          background: #555555;
        }

        .runtime-config-category-btn.active {
          background: #666666;
          border-color: #888888;
        }

        .runtime-config-content {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background: rgba(40, 40, 40, 0.5);
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .runtime-config-item {
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(50, 50, 50, 0.5);
          border-radius: 4px;
          border-left: 3px solid #777777;
        }

        .runtime-config-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }

        .runtime-config-item-name {
          color: #aaaaaa;
          font-weight: bold;
          font-size: 14px;
        }

        .runtime-config-item-value {
          color: #ecf0f1;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }

        .runtime-config-item-description {
          color: #bdc3c7;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .runtime-config-item-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .runtime-config-input {
          flex: 1;
          padding: 6px 10px;
          font-size: 13px;
          border: 1px solid #666666;
          border-radius: 4px;
          background: #444444;
          color: #ecf0f1;
          font-family: 'Courier New', monospace;
        }

        .runtime-config-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .runtime-config-input:focus {
          border-color: #888888;
          outline: none;
          box-shadow: 0 0 5px rgba(136, 136, 136, 0.5);
        }

        .runtime-config-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .runtime-config-checkbox:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .runtime-config-readonly {
          color: #95a5a6;
          font-size: 11px;
          font-style: italic;
        }

        .runtime-config-buttons {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .runtime-config-button {
          padding: 8px 16px;
          font-size: 14px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: bold;
          text-transform: uppercase;
        }

        .runtime-config-button.primary {
          background: #27ae60;
          color: white;
          flex: 1;
        }

        .runtime-config-button.primary:hover {
          background: #2ecc71;
        }

        .runtime-config-button.secondary {
          background: #95a5a6;
          color: white;
          flex: 1;
        }

        .runtime-config-button.secondary:hover {
          background: #7f8c8d;
        }
      `
      document.head.appendChild(style)
    }
  }

  openDialog() {
    if (this.isDialogOpen) return

    this.isDialogOpen = true

    // Create dialog overlay
    const overlay = document.createElement('div')
    overlay.className = 'runtime-config-overlay'
    overlay.id = 'runtime-config-overlay'

    // Create dialog
    const dialog = document.createElement('div')
    dialog.className = 'runtime-config-dialog'

    // Get categories
    const categories = getConfigCategories()
    this.selectedCategory = categories[0] || null

    dialog.innerHTML = `
      <div class="runtime-config-header">
        <h2>⚙️ Runtime Configuration</h2>
        <button class="runtime-config-close" id="runtime-config-close">✕</button>
      </div>
      <div class="runtime-config-categories" id="runtime-config-categories"></div>
      <div class="runtime-config-content" id="runtime-config-content"></div>
      <div class="runtime-config-buttons">
        <button class="runtime-config-button secondary" id="runtime-config-refresh">Refresh</button>
        <button class="runtime-config-button primary" id="runtime-config-done">Done</button>
      </div>
    `

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    // Render categories
    this.renderCategories(categories)

    // Render content for selected category
    this.renderContent()

    // Add event listeners
    this.setupDialogEventListeners(overlay)

    // Prevent game inputs while dialog is open
    this.pauseGameInput(true)
  }

  renderCategories(categories) {
    const container = document.getElementById('runtime-config-categories')
    if (!container) return

    container.innerHTML = ''
    categories.forEach(category => {
      const btn = document.createElement('button')
      btn.className = 'runtime-config-category-btn'
      btn.textContent = category
      if (category === this.selectedCategory) {
        btn.classList.add('active')
      }
      btn.addEventListener('click', () => {
        this.selectedCategory = category
        this.renderCategories(categories)
        this.renderContent()
      })
      container.appendChild(btn)
    })
  }

  renderContent() {
    const container = document.getElementById('runtime-config-content')
    if (!container || !this.selectedCategory) return

    const configs = getConfigsByCategory(this.selectedCategory)
    container.innerHTML = ''

    Object.entries(configs).forEach(([id, entry]) => {
      const item = document.createElement('div')
      item.className = 'runtime-config-item'

      const currentValue = getConfigValue(id)
      const isMutable = isConfigMutable(id)

      let controlHtml = ''
      if (entry.type === 'boolean') {
        controlHtml = `
          <input
            type="checkbox"
            class="runtime-config-checkbox"
            id="config-${id}"
            ${currentValue ? 'checked' : ''}
            ${!isMutable ? 'disabled' : ''}
          >
        `
      } else if (entry.type === 'number') {
        const attrs = []
        if (entry.min !== undefined) attrs.push(`min="${entry.min}"`)
        if (entry.max !== undefined) attrs.push(`max="${entry.max}"`)
        if (entry.step !== undefined) attrs.push(`step="${entry.step}"`)
        if (!isMutable) attrs.push('disabled')

        controlHtml = `
          <input
            type="number"
            class="runtime-config-input"
            id="config-${id}"
            value="${currentValue}"
            ${attrs.join(' ')}
          >
        `
      } else if (entry.type === 'string') {
        controlHtml = `
          <input
            type="text"
            class="runtime-config-input"
            id="config-${id}"
            value="${currentValue}"
            ${!isMutable ? 'disabled' : ''}
          >
        `
      }

      item.innerHTML = `
        <div class="runtime-config-item-header">
          <span class="runtime-config-item-name">${entry.name}</span>
          <span class="runtime-config-item-value">${this.formatValue(currentValue, entry.type)}</span>
        </div>
        <div class="runtime-config-item-description">
          ${entry.description}
          ${!isMutable ? '<span class="runtime-config-readonly"> (read-only)</span>' : ''}
        </div>
        <div class="runtime-config-item-control">
          ${controlHtml}
        </div>
      `

      container.appendChild(item)

      // Add change listener for mutable configs
      if (isMutable) {
        const input = document.getElementById(`config-${id}`)
        if (input) {
          input.addEventListener('change', (e) => {
            let newValue
            if (entry.type === 'boolean') {
              newValue = e.target.checked
            } else if (entry.type === 'number') {
              newValue = parseFloat(e.target.value)
            } else {
              newValue = e.target.value
            }

            const success = setConfigValue(id, newValue)
            if (success) {
              showNotification(`Updated ${entry.name}`, 2000)
              playSound('confirmed', 0.5)
              this.updateValueDisplay(id, newValue, entry.type)
            } else {
              showNotification(`Failed to update ${entry.name}`, 2000)
              playSound('error', 0.5)
            }
          })
        }
      }
    })
  }

  formatValue(value, type) {
    if (type === 'boolean') {
      return value ? 'true' : 'false'
    } else if (type === 'number') {
      return typeof value === 'number' ? value.toFixed(3).replace(/\.?0+$/, '') : value
    }
    return String(value)
  }

  updateValueDisplay(configId, newValue, type) {
    const item = document.getElementById(`config-${configId}`)
    if (!item) return

    const parent = item.closest('.runtime-config-item')
    if (!parent) return

    const valueSpan = parent.querySelector('.runtime-config-item-value')
    if (valueSpan) {
      valueSpan.textContent = this.formatValue(newValue, type)
    }
  }

  setupDialogEventListeners(overlay) {
    const closeBtn = document.getElementById('runtime-config-close')
    const doneBtn = document.getElementById('runtime-config-done')
    const refreshBtn = document.getElementById('runtime-config-refresh')

    const closeDialog = () => {
      this.closeDialog()
    }

    const refreshDialog = () => {
      this.renderContent()
      showNotification('Configuration refreshed', 1500)
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDialog)
    if (doneBtn) doneBtn.addEventListener('click', closeDialog)
    if (refreshBtn) refreshBtn.addEventListener('click', refreshDialog)

    // ESC key to close
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDialog()
      }
    }
    document.addEventListener('keydown', keyHandler)

    // Store handler for cleanup
    overlay.dataset.keyHandler = 'attached'
    overlay._keyHandler = keyHandler

    // Click overlay to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog()
      }
    })
  }

  closeDialog() {
    if (!this.isDialogOpen) return

    const overlay = document.getElementById('runtime-config-overlay')
    if (overlay) {
      // Remove key handler
      if (overlay._keyHandler) {
        document.removeEventListener('keydown', overlay._keyHandler)
      }
      overlay.remove()
    }

    this.isDialogOpen = false
    this.pauseGameInput(false)
  }

  pauseGameInput(paused) {
    // Import gameState dynamically to avoid circular dependencies
    import('../gameState.js').then(({ gameState }) => {
      if (paused) {
        gameState.runtimeConfigDialogOpen = true
      } else {
        gameState.runtimeConfigDialogOpen = false
      }
    })
  }

  toggle() {
    if (this.isDialogOpen) {
      this.closeDialog()
    } else {
      this.openDialog()
    }
  }

  isOpen() {
    return this.isDialogOpen
  }
}

// Create singleton instance
export const runtimeConfigDialog = new RuntimeConfigDialog()
