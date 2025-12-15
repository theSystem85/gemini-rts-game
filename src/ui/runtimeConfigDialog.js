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
import { renderKeyBindingsEditor } from './keyBindingsEditor.js'

export class RuntimeConfigDialog {
  constructor() {
    this.isDialogOpen = false
    this.selectedCategory = null
    this.activeTab = 'runtime'
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

        .runtime-config-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .runtime-config-tab {
          background: #3a3a3a;
          color: #ecf0f1;
          border: 1px solid #555;
          border-radius: 6px;
          padding: 6px 14px;
          cursor: pointer;
          font-weight: 600;
          letter-spacing: 0.3px;
          transition: background 0.2s ease, transform 0.1s ease;
        }

        .runtime-config-tab:hover {
          background: #4c4c4c;
          transform: translateY(-1px);
        }

        .runtime-config-tab.active {
          background: linear-gradient(135deg, #4b75ff, #6cb4ff);
          border-color: #7bb1ff;
          color: #0b1021;
        }

        .runtime-config-panels {
          margin-top: 10px;
        }

        .runtime-config-panel {
          display: none;
        }

        .runtime-config-panel--active {
          display: block;
        }

        .keybinds-container {
          background: rgba(40, 40, 40, 0.6);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid #444;
        }

        .keybinds-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .keybinds-subtitle {
          margin: 4px 0 0;
          color: #b0bec5;
          font-size: 12px;
        }

        .keybinds-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .keybinds-section {
          margin-top: 14px;
          border: 1px solid #444;
          border-radius: 8px;
          padding: 12px;
          background: rgba(32, 32, 32, 0.6);
        }

        .keybinds-section__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .keybinds-section__description {
          margin: 4px 0 0;
          color: #a0a0a0;
          font-size: 12px;
        }

        .keybinds-device-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .keybinds-device {
          background: rgba(28, 28, 28, 0.8);
          border: 1px solid #3f3f3f;
          border-radius: 8px;
          padding: 10px;
        }

        .keybinds-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .keybinds-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid #444;
          background: rgba(24, 24, 24, 0.8);
        }

        .keybinds-row--custom {
          background: rgba(255, 238, 170, 0.12);
          border-color: #d9c97a;
        }

        .keybinds-row__info {
          flex: 1;
        }

        .keybinds-row__label {
          font-weight: 700;
          color: #e8eaed;
        }

        .keybinds-row__description {
          margin-top: 4px;
          color: #b8c0c5;
          font-size: 12px;
        }

        .keybinds-row__controls {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .keybinds-row__binding {
          min-width: 120px;
          background: #2f3640;
          color: #fff;
          border: 1px solid #4b5d6b;
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 700;
          letter-spacing: 0.4px;
          transition: background 0.2s ease, transform 0.1s ease;
        }

        .keybinds-row__binding--capturing {
          background: linear-gradient(135deg, #ffd166, #f7a33b);
          color: #2a2a2a;
          border-color: #f0a835;
        }

        .keybinds-row__binding:hover {
          background: #3b4855;
          transform: translateY(-1px);
        }

        .keybinds-row__reset {
          background: #444;
          color: #fff;
          border: 1px solid #555;
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
        }

        .keybinds-row__reset:hover {
          background: #555;
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
        <div>
          <h2>⚙️ Settings</h2>
          <div class="runtime-config-tabs" id="runtime-config-tabs">
            <button class="runtime-config-tab active" data-tab="runtime">Runtime Config</button>
            <button class="runtime-config-tab" data-tab="bindings">Key Bindings</button>
          </div>
        </div>
        <button class="runtime-config-close" id="runtime-config-close">✕</button>
      </div>
      <div class="runtime-config-panels">
        <div class="runtime-config-panel runtime-config-panel--active" id="runtime-config-panel">
          <div class="runtime-config-categories" id="runtime-config-categories"></div>
          <div class="runtime-config-content" id="runtime-config-content"></div>
        </div>
        <div class="runtime-config-panel" id="runtime-bindings-panel">
          <div id="runtime-bindings-container" class="keybinds-container"></div>
        </div>
      </div>
      <div class="runtime-config-buttons">
        <button class="runtime-config-button secondary" id="runtime-config-refresh">Refresh</button>
        <button class="runtime-config-button primary" id="runtime-config-done">Done</button>
      </div>
    `

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    this.activeTab = 'runtime'

    // Render categories
    this.renderCategories(categories)

    // Render content for selected category
    this.renderContent()
    this.renderKeyBindingsTab()

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

  renderKeyBindingsTab() {
    const container = document.getElementById('runtime-bindings-container')
    if (!container) return
    renderKeyBindingsEditor(container)
  }

  updateTabVisibility() {
    const runtimePanel = document.getElementById('runtime-config-panel')
    const bindingsPanel = document.getElementById('runtime-bindings-panel')
    const tabs = document.querySelectorAll('.runtime-config-tab')

    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === this.activeTab
      tab.classList.toggle('active', isActive)
    })

    if (runtimePanel) {
      runtimePanel.classList.toggle('runtime-config-panel--active', this.activeTab === 'runtime')
    }
    if (bindingsPanel) {
      bindingsPanel.classList.toggle('runtime-config-panel--active', this.activeTab === 'bindings')
    }
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
    const tabButtons = document.querySelectorAll('.runtime-config-tab')

    const closeDialog = () => {
      this.closeDialog()
    }

    const refreshDialog = () => {
      if (this.activeTab === 'runtime') {
        this.renderContent()
        showNotification('Configuration refreshed', 1500)
      } else {
        this.renderKeyBindingsTab()
        showNotification('Key bindings refreshed', 1500)
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDialog)
    if (doneBtn) doneBtn.addEventListener('click', closeDialog)
    if (refreshBtn) refreshBtn.addEventListener('click', refreshDialog)
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab === 'bindings' ? 'bindings' : 'runtime'
        this.updateTabVisibility()
        if (this.activeTab === 'bindings') {
          this.renderKeyBindingsTab()
        } else {
          this.renderContent()
        }
      })
    })

    this.updateTabVisibility()

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
