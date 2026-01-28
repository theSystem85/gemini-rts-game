// keybindingsEditor.js
// Renders the keybindings editor tab and wires capture/export/import controls

import { keybindingManager, KEYBINDING_CONTEXTS } from '../input/keybindings.js'
import versionInfo from '../version.json'

const CONTEXT_LABELS = {
  [KEYBINDING_CONTEXTS.DEFAULT]: 'In-Game',
  [KEYBINDING_CONTEXTS.MAP_EDIT_ON]: 'Map Edit: Enabled',
  [KEYBINDING_CONTEXTS.MAP_EDIT_OFF]: 'Map Edit: Disabled'
}

function formatContextLabel(context) {
  return CONTEXT_LABELS[context] || 'General'
}

/**
 * Check if a key/input is already used by another binding
 * @returns {Object|null} The conflicting binding or null
 */
function findConflictingBinding(device, currentBindingId, newInput, context) {
  const bindings = keybindingManager.getBindingsByDevice(device)
  const normalizedNew = normalizeInputForComparison(newInput)

  return bindings.find(binding => {
    if (binding.id === currentBindingId) return false
    // Only check conflicts within the same context or with DEFAULT context
    if (binding.context !== context && binding.context !== KEYBINDING_CONTEXTS.DEFAULT && context !== KEYBINDING_CONTEXTS.DEFAULT) {
      return false
    }
    const normalizedExisting = normalizeInputForComparison(binding.input)
    return normalizedExisting === normalizedNew
  })
}

function normalizeInputForComparison(input) {
  if (!input) return ''
  return input.toLowerCase().split('+').sort().join('+')
}

/**
 * Show a conflict warning dialog and return a promise that resolves to user's choice
 */
function showConflictDialog(newInput, conflictingBinding) {
  return new Promise(resolve => {
    // Remove any existing dialog
    const existingDialog = document.querySelector('.keybinding-conflict-overlay')
    if (existingDialog) existingDialog.remove()

    const overlay = document.createElement('div')
    overlay.className = 'keybinding-conflict-overlay'

    const dialog = document.createElement('div')
    dialog.className = 'keybinding-conflict-dialog'
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-labelledby', 'conflict-title')

    dialog.innerHTML = `
      <div class="keybinding-conflict-dialog__header">
        <span class="keybinding-conflict-dialog__icon">⚠️</span>
        <h3 id="conflict-title" class="keybinding-conflict-dialog__title">Key Already Assigned</h3>
      </div>
      <div class="keybinding-conflict-dialog__body">
        <p>
          The key <span class="keybinding-conflict-dialog__key">${escapeHtml(newInput)}</span> 
          is already assigned to another action.
        </p>
        <div class="keybinding-conflict-dialog__existing">
          <div class="keybinding-conflict-dialog__existing-label">Currently used by:</div>
          <div class="keybinding-conflict-dialog__existing-action">${escapeHtml(conflictingBinding.label)}</div>
        </div>
        <p style="margin-top: 12px;">Do you want to reassign it anyway? The previous binding will be cleared.</p>
      </div>
      <div class="keybinding-conflict-dialog__footer">
        <button type="button" class="keybinding-conflict-dialog__btn keybinding-conflict-dialog__btn--cancel">Cancel</button>
        <button type="button" class="keybinding-conflict-dialog__btn keybinding-conflict-dialog__btn--confirm">Reassign</button>
      </div>
    `

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    const cancelBtn = dialog.querySelector('.keybinding-conflict-dialog__btn--cancel')
    const confirmBtn = dialog.querySelector('.keybinding-conflict-dialog__btn--confirm')

    const cleanup = () => {
      overlay.remove()
    }

    cancelBtn.addEventListener('click', () => {
      cleanup()
      resolve(false)
    })

    confirmBtn.addEventListener('click', () => {
      cleanup()
      resolve(true)
    })

    // Close on Escape key
    const handleKeydown = event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        cleanup()
        resolve(false)
      }
    }
    document.addEventListener('keydown', handleKeydown, { capture: true, once: true })

    // Focus the cancel button for accessibility
    cancelBtn.focus()
  })
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderDeviceSection(container, device, bindings) {
  const deviceSection = document.createElement('section')
  deviceSection.className = 'keybinding-device'
  const title = document.createElement('h3')
  title.textContent = `${device[0].toUpperCase()}${device.slice(1)} bindings`
  deviceSection.appendChild(title)

  const grouped = bindings.reduce((acc, binding) => {
    const context = binding.context || KEYBINDING_CONTEXTS.DEFAULT
    if (!acc[context]) acc[context] = []
    acc[context].push(binding)
    return acc
  }, {})

  Object.entries(grouped).forEach(([context, entries]) => {
    const contextCard = document.createElement('div')
    contextCard.className = 'keybinding-context'

    const heading = document.createElement('div')
    heading.className = 'keybinding-context__title'
    heading.textContent = formatContextLabel(context)
    contextCard.appendChild(heading)

    entries.forEach(binding => {
      const row = document.createElement('div')
      row.className = 'keybinding-row'
      if (binding.isCustom) {
        row.classList.add('keybinding-row--custom')
      }

      const label = document.createElement('div')
      label.className = 'keybinding-row__label'
      label.textContent = binding.label

      const inputButton = document.createElement('button')
      inputButton.type = 'button'
      inputButton.className = 'keybinding-row__value'
      inputButton.textContent = binding.input || 'Unassigned'
      inputButton.addEventListener('click', () => beginCapture(device, binding, inputButton))

      const resetBtn = document.createElement('button')
      resetBtn.type = 'button'
      resetBtn.className = 'keybinding-row__reset'
      resetBtn.textContent = 'Reset'
      resetBtn.disabled = !binding.isCustom
      resetBtn.addEventListener('click', () => {
        keybindingManager.resetBinding(device, binding.id)
        renderKeybindingsEditor(container.parentElement)
      })

      row.appendChild(label)
      row.appendChild(inputButton)
      row.appendChild(resetBtn)
      contextCard.appendChild(row)
    })

    deviceSection.appendChild(contextCard)
  })

  container.appendChild(deviceSection)
}

function beginCapture(device, binding, buttonEl) {
  buttonEl.textContent = 'Press keys or click…'
  buttonEl.classList.add('keybinding-row__value--listening')

  const context = binding.context || KEYBINDING_CONTEXTS.DEFAULT

  const finish = async(input) => {
    buttonEl.classList.remove('keybinding-row__value--listening')
    if (!input) {
      buttonEl.textContent = binding.input || 'Unassigned'
      return
    }

    // Check for conflicts
    const conflict = findConflictingBinding(device, binding.id, input, context)
    if (conflict) {
      const shouldReassign = await showConflictDialog(input, conflict)
      if (!shouldReassign) {
        buttonEl.textContent = binding.input || 'Unassigned'
        return
      }
      // Clear the conflicting binding before assigning the new one
      keybindingManager.updateBinding(device, conflict.id, '')
    }

    keybindingManager.updateBinding(device, binding.id, input)
    const editorRoot = buttonEl.closest('#keybindingsEditor')
    if (editorRoot) {
      renderKeybindingsEditor(editorRoot.parentElement)
    }
  }

  const stopAll = () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('touchstart', onTouchStart, true)
  }

  const onKeyDown = event => {
    event.preventDefault()
    event.stopPropagation()
    stopAll()
    const normalized = keybindingManager.normalizeKeyboardEvent(event)
    finish(normalized || event.key)
  }

  const onMouseDown = event => {
    event.preventDefault()
    event.stopPropagation()
    stopAll()
    const buttonNames = ['Mouse1', 'Mouse2', 'Mouse3']
    const name = buttonNames[event.button] || `Mouse${event.button + 1}`
    const modifiers = []
    if (event.ctrlKey) modifiers.push('Ctrl')
    if (event.metaKey) modifiers.push('Meta')
    if (event.shiftKey) modifiers.push('Shift')
    if (event.altKey) modifiers.push('Alt')
    const clickPrefix = event.detail >= 2 ? 'Double ' : ''
    modifiers.push(`${clickPrefix}${name}`.trim())
    finish(modifiers.join('+'))
  }

  const onTouchStart = event => {
    stopAll()
    const touchCount = event.touches?.length || event.changedTouches?.length || 0
    const label = touchCount >= 2 ? 'Double Finger Tap' : (event.detail >= 2 ? 'Double Tap' : 'Tap')
    finish(label)
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('touchstart', onTouchStart, true)
}

function attachExportImport(root, onRefresh) {
  const exportBtn = root.querySelector('#keybindingsExportBtn')
  const importBtn = root.querySelector('#keybindingsImportBtn')
  const importInput = root.querySelector('#keybindingsImportInput')
  const messageEl = root.querySelector('#keybindingsMessage')

  if (exportBtn) {
    exportBtn.onclick = () => {
      const json = keybindingManager.exportBindings()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = `keybindings-${versionInfo?.version || 'dev'}-${versionInfo?.commit || 'local'}.json`
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      if (messageEl) messageEl.textContent = `Exported as ${filename}`
    }
  }

  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click()
    importInput.onchange = event => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result)
          keybindingManager.importBindings(data)
          onRefresh()
          if (messageEl) messageEl.textContent = 'Bindings imported successfully'
        } catch (err) {
          if (messageEl) messageEl.textContent = 'Import failed: invalid JSON'
          console.warn('Failed to import bindings', err)
        }
      }
      reader.readAsText(file)
      importInput.value = ''
    }
  }
}

export function renderKeybindingsEditor(modalBody) {
  const editor = modalBody.querySelector('#keybindingsEditor')
  if (!editor) return

  editor.innerHTML = ''

  const intro = document.createElement('p')
  intro.className = 'keybinding-intro'
  intro.textContent = 'Click a binding to capture new keys, mouse buttons, or touch gestures. Custom mappings are highlighted so you can spot overrides at a glance.'
  editor.appendChild(intro)

  renderDeviceSection(editor, 'keyboard', keybindingManager.getBindingsByDevice('keyboard'))
  renderDeviceSection(editor, 'mouse', keybindingManager.getBindingsByDevice('mouse'))
  renderDeviceSection(editor, 'touch', keybindingManager.getBindingsByDevice('touch'))

  attachExportImport(modalBody, () => renderKeybindingsEditor(modalBody))
}

