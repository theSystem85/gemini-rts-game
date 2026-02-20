// settingsModal.js
// Tabbed settings modal that hosts runtime config shortcuts and the keybindings editor

import { runtimeConfigDialog } from './runtimeConfigDialog.js'
import { renderKeybindingsEditor } from './keybindingsEditor.js'
import { initLlmSettingsPanel } from './llmSettingsPanel.js'
import { gameState } from '../gameState.js'

const RADAR_OFFLINE_ANIMATION_SETTINGS_KEY = 'rts_radar_offline_animation'

function loadRadarOfflineAnimationSetting() {
  try {
    const stored = localStorage.getItem(RADAR_OFFLINE_ANIMATION_SETTINGS_KEY)
    if (stored === null) return true
    return stored !== 'false'
  } catch (error) {
    window.logger.warn('Failed to load radar-offline animation setting:', error)
    return true
  }
}

function saveRadarOfflineAnimationSetting(enabled) {
  try {
    localStorage.setItem(RADAR_OFFLINE_ANIMATION_SETTINGS_KEY, enabled ? 'true' : 'false')
  } catch (error) {
    window.logger.warn('Failed to save radar-offline animation setting:', error)
  }
}

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
  const radarOfflineAnimationToggle = modal.querySelector('#settingsRadarOfflineAnimationToggle')
  if (frameLimiterToggle) {
    frameLimiterToggle.checked = gameState.frameLimiterEnabled !== false
  }
  if (radarOfflineAnimationToggle) {
    radarOfflineAnimationToggle.checked = gameState.radarOfflineAnimationEnabled !== false
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
  const radarOfflineAnimationToggle = document.getElementById('settingsRadarOfflineAnimationToggle')

  if (!modal) return

  gameState.radarOfflineAnimationEnabled = loadRadarOfflineAnimationSetting()

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

  if (radarOfflineAnimationToggle) {
    radarOfflineAnimationToggle.checked = gameState.radarOfflineAnimationEnabled !== false
    radarOfflineAnimationToggle.addEventListener('change', (event) => {
      const enabled = event.target.checked
      gameState.radarOfflineAnimationEnabled = enabled
      saveRadarOfflineAnimationSetting(enabled)
    })
  }
}
