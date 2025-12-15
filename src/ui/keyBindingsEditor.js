import {
  DOUBLE_TAP_THRESHOLD,
  captureMouseGesture,
  captureTouchGesture,
  formatInputLabel,
  formatKeyboardEventForDisplay,
  getContexts,
  getExportPayload,
  importBindings,
  isCustomBinding,
  resetAllBindings,
  resetBinding,
  updateBinding
} from '../input/keyBindingsManager.js'

export class KeyBindingsEditor {
  constructor() {
    this.isCapturing = false
    this.captureResolver = null
  }

  render(container) {
    if (!container) return
    container.innerHTML = ''
    const header = document.createElement('div')
    header.className = 'keybinds-header'
    header.innerHTML = `
      <div>
        <h3>Key Bindings</h3>
        <p class="keybinds-subtitle">Customize keyboard, mouse, and touch controls. Non-default entries are highlighted.</p>
      </div>
      <div class="keybinds-actions">
        <button class="runtime-config-button secondary" id="keybinds-export">Export JSON</button>
        <button class="runtime-config-button secondary" id="keybinds-import">Import JSON</button>
        <button class="runtime-config-button primary" id="keybinds-reset">Reset All</button>
        <input type="file" accept="application/json" id="keybinds-import-input" style="display:none" />
      </div>
    `
    container.appendChild(header)

    const contexts = getContexts()
    Object.values(contexts).forEach(context => {
      const section = document.createElement('section')
      section.className = 'keybinds-section'
      section.innerHTML = `
        <div class="keybinds-section__header">
          <div>
            <h4>${context.label}</h4>
            <p class="keybinds-section__description">${context.description}</p>
          </div>
        </div>
      `
      const deviceWrapper = document.createElement('div')
      deviceWrapper.className = 'keybinds-device-grid'
      ;['keyboard', 'mouse', 'touch'].forEach(device => {
        if (!context[device] || context[device].length === 0) return
        const panel = document.createElement('div')
        panel.className = 'keybinds-device'
        panel.innerHTML = `<h5>${device.charAt(0).toUpperCase() + device.slice(1)}</h5>`
        const list = document.createElement('div')
        list.className = 'keybinds-list'
        context[device].forEach(binding => {
          list.appendChild(this.renderBindingRow(context.id, device, binding))
        })
        panel.appendChild(list)
        deviceWrapper.appendChild(panel)
      })
      section.appendChild(deviceWrapper)
      container.appendChild(section)
    })

    this.bindActions(container)
  }

  renderBindingRow(contextId, device, binding) {
    const row = document.createElement('div')
    row.className = 'keybinds-row'
    if (isCustomBinding(contextId, device, binding.id) || binding.isCustom) {
      row.classList.add('keybinds-row--custom')
    }
    row.innerHTML = `
      <div class="keybinds-row__info">
        <div class="keybinds-row__label">${binding.label}</div>
        <div class="keybinds-row__description">${binding.description || ''}</div>
      </div>
      <div class="keybinds-row__controls">
        <button class="keybinds-row__binding" data-context="${contextId}" data-device="${device}" data-binding="${binding.id}">${formatInputLabel(binding.input)}</button>
        <button class="keybinds-row__reset" data-context="${contextId}" data-device="${device}" data-binding="${binding.id}">Reset</button>
      </div>
    `
    return row
  }

  bindActions(container) {
    const exportBtn = container.querySelector('#keybinds-export')
    const importBtn = container.querySelector('#keybinds-import')
    const resetBtn = container.querySelector('#keybinds-reset')
    const fileInput = container.querySelector('#keybinds-import-input')

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const payload = getExportPayload()
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'keybindings-export.json'
        a.click()
        URL.revokeObjectURL(url)
      })
    }

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result)
            if (importBindings(parsed)) {
              this.render(container)
            }
          } catch (err) {
            window.logger?.warn?.('Failed to import key bindings file', err)
          }
        }
        reader.readAsText(file)
      })
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetAllBindings()
        this.render(container)
      })
    }

    container.querySelectorAll('.keybinds-row__binding').forEach(btn => {
      btn.addEventListener('click', () => this.beginCapture(btn, container))
    })

    container.querySelectorAll('.keybinds-row__reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const contextId = btn.dataset.context
        const device = btn.dataset.device
        const bindingId = btn.dataset.binding
        resetBinding(contextId, device, bindingId)
        this.render(container)
      })
    })
  }

  beginCapture(button, container) {
    if (this.isCapturing) return
    this.isCapturing = true
    const originalText = button.textContent
    button.textContent = 'Press keys or click…'
    button.classList.add('keybinds-row__binding--capturing')

    const contextId = button.dataset.context
    const device = button.dataset.device
    const bindingId = button.dataset.binding

    const finish = (input) => {
      this.isCapturing = false
      button.classList.remove('keybinds-row__binding--capturing')
      button.textContent = formatInputLabel(input || originalText)
      if (input) {
        updateBinding(contextId, device, bindingId, input)
        this.render(container)
      }
      cleanup()
    }

    const handleKey = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const descriptor = formatKeyboardEventForDisplay(event)
      finish(descriptor)
    }

    const handleMouse = (event) => {
      event.preventDefault()
      const gesture = captureMouseGesture(event)
      if (gesture) finish(gesture)
    }

    let tapTimer = null
    const handleTouch = (event) => {
      const gesture = captureTouchGesture(event)
      if (gesture === 'tap') {
        // wait to detect double tap
        clearTimeout(tapTimer)
        tapTimer = setTimeout(() => finish('tap'), DOUBLE_TAP_THRESHOLD)
      } else if (gesture === 'double-tap' || gesture === 'two-finger-tap') {
        finish(gesture)
      }
    }

    const handlePointer = (event) => {
      if (event.pointerType === 'touch') return
      handleMouse(event)
    }

    const cleanup = () => {
      window.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('mousedown', handleMouse, true)
      window.removeEventListener('pointerdown', handlePointer, true)
      window.removeEventListener('touchstart', handleTouch, { capture: true })
      window.removeEventListener('touchend', handleTouch, { capture: true })
    }

    window.addEventListener('keydown', handleKey, { capture: true })
    window.addEventListener('mousedown', handleMouse, { capture: true })
    window.addEventListener('pointerdown', handlePointer, { capture: true })
    window.addEventListener('touchstart', handleTouch, { capture: true })
    window.addEventListener('touchend', handleTouch, { capture: true })
  }
}

export function renderKeyBindingsEditor(container) {
  const editor = new KeyBindingsEditor()
  editor.render(container)
}
