// settingsModal.js
// Tabbed settings modal that hosts runtime config shortcuts and the keybindings editor

import { runtimeConfigDialog } from './runtimeConfigDialog.js'
import { renderKeybindingsEditor } from './keybindingsEditor.js'

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
  document.body.classList.add('config-modal-open')
  const keybindingsPanel = modal.querySelector('[data-config-tab-panel="keybindings"]')
  if (keybindingsPanel) {
    renderKeybindingsEditor(keybindingsPanel)
  }
}

function closeModal(modal) {
  modal.classList.remove('config-modal--open')
  document.body.classList.remove('config-modal-open')
}

export function initSettingsModal() {
  const modal = document.getElementById('configSettingsModal')
  const closeBtn = document.getElementById('configModalCloseBtn')
  const openBtn = document.getElementById('configSettingsBtn')
  const runtimeLaunchBtn = document.getElementById('openRuntimeConfigDialogBtn')

  if (!modal) return

  bindTabs(modal)

  if (openBtn) {
    openBtn.addEventListener('click', () => openModal(modal, 'keybindings'))
  }

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
}

