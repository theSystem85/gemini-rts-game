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

  const finish = input => {
    buttonEl.classList.remove('keybinding-row__value--listening')
    if (!input) {
      buttonEl.textContent = binding.input
      return
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

