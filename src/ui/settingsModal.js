// settingsModal.js
// Tabbed settings modal that hosts runtime config shortcuts and the keybindings editor

import { runtimeConfigDialog } from './runtimeConfigDialog.js'
import { renderKeybindingsEditor } from './keybindingsEditor.js'
import { initLlmSettingsPanel } from './llmSettingsPanel.js'
import { gameState } from '../gameState.js'

function setActiveTab(modal, tabId) {
  const tabs = modal.querySelectorAll('[data-config-tab]')
  const panels = modal.querySelectorAll('[data-config-tab-panel]')
  tabs.forEach(tab => {
    const isActive = tab.dataset.configTab === tabId
    tab.classList.toggle('config-modal__tab--active', isActive)
    tab.setAttribute('aria-selected', isActive)
  })
  panels.forEach(panel => {
    const isActive = panel.dataset.configTabPanel === tabId
    panel.classList.toggle('config-modal__content--active', isActive)
    panel.hidden = !isActive
  })
}

function bindTabs(modal) {
  modal.querySelectorAll('[data-config-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.configTab
      setActiveTab(modal, tabId)
    })
  })
}

function openModal(modal, defaultTab = 'keybindings') {
  setActiveTab(modal, defaultTab)
  modal.classList.add('config-modal--open')
  modal.setAttribute('aria-hidden', 'false')
  document.body.classList.add('config-modal-open')
  const keybindingsPanel = modal.querySelector('[data-config-tab-panel="keybindings"]')
  const frameLimiterToggle = modal.querySelector('#settingsFrameLimiterToggle')
  if (frameLimiterToggle) {
    frameLimiterToggle.checked = gameState.frameLimiterEnabled !== false
  }
  if (keybindingsPanel) {
    renderKeybindingsEditor(keybindingsPanel)
  }
}

function closeModal(modal) {
  modal.classList.remove('config-modal--open')
  modal.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('config-modal-open')
}

export function openSettingsModal(defaultTab = 'keybindings') {
  const modal = document.getElementById('configSettingsModal')
  if (!modal) return
  openModal(modal, defaultTab)
}

export function closeSettingsModal() {
  const modal = document.getElementById('configSettingsModal')
  if (!modal) return
  closeModal(modal)
}

export function initSettingsModal() {
  const modal = document.getElementById('configSettingsModal')
  const closeBtn = document.getElementById('configModalCloseBtn')
  const runtimeLaunchBtn = document.getElementById('openRuntimeConfigDialogBtn')
  const frameLimiterToggle = document.getElementById('settingsFrameLimiterToggle')

  if (!modal) return

  bindTabs(modal)
  initLlmSettingsPanel()

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(modal))
  }

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal(modal)
    }
  })

  if (runtimeLaunchBtn) {
    runtimeLaunchBtn.addEventListener('click', () => {
      runtimeConfigDialog.openDialog()
    })
  }

  if (frameLimiterToggle) {
    frameLimiterToggle.checked = gameState.frameLimiterEnabled !== false
    frameLimiterToggle.addEventListener('change', (event) => {
      gameState.frameLimiterEnabled = event.target.checked
    })
  }
}
