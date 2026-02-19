import { getLlmSettings, updateLlmSettings } from '../ai/llmSettings.js'
import { fetchCostMap, fetchModelList, formatModelCost, getModelCostInfo } from '../ai/llmProviders.js'
import { showNotification } from './notifications.js'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'xai', label: 'xAI' },
  { id: 'ollama', label: 'Ollama' }
]

const ENABLED_PROVIDER_IDS = new Set(['openai'])

function setSelectOptions(select, options, placeholder = 'Select model') {
  if (!select) return
  select.innerHTML = ''
  const placeholderOption = document.createElement('option')
  placeholderOption.value = ''
  placeholderOption.textContent = placeholder
  select.appendChild(placeholderOption)

  options.forEach(option => {
    const opt = document.createElement('option')
    opt.value = option.value
    opt.textContent = option.label
    select.appendChild(opt)
  })
}

function updateProviderModelSelect(providerId, models, costs) {
  const select = document.getElementById(`llmModel-${providerId}`)
  if (!select) return
  const options = models.map(model => {
    const costInfo = getModelCostInfo(providerId, model, costs)
    return {
      value: model,
      label: `${model}${formatModelCost(costInfo)}`
    }
  })
  setSelectOptions(select, options)
}

function setSelectValue(select, value) {
  if (!select) return
  const hasValue = Array.from(select.options).some(opt => opt.value === value)
  select.value = hasValue ? value : ''
}

function attachVoiceOptions(select, settings) {
  if (!select) return
  const voices = window.speechSynthesis?.getVoices?.() || []
  select.innerHTML = ''
  const defaultOption = document.createElement('option')
  defaultOption.value = ''
  defaultOption.textContent = 'Default'
  select.appendChild(defaultOption)

  voices.forEach(voice => {
    const option = document.createElement('option')
    option.value = voice.name
    option.textContent = `${voice.name} (${voice.lang})`
    select.appendChild(option)
  })
  setSelectValue(select, settings.commentary.voiceName)
}

// Providers that require an API key to fetch models
const PROVIDERS_REQUIRING_KEY = new Set(['openai', 'anthropic', 'xai'])

async function refreshProviderModels(providerId, settings, { silent = false } = {}) {
  if (!ENABLED_PROVIDER_IDS.has(providerId)) return

  // Skip providers that require an API key when none is set
  if (PROVIDERS_REQUIRING_KEY.has(providerId)) {
    const apiKey = settings.providers?.[providerId]?.apiKey || ''
    if (!apiKey.trim()) {
      // Clear model list silently
      const select = document.getElementById(`llmModel-${providerId}`)
      if (select) setSelectOptions(select, [], 'Enter API key first')
      return
    }
  }

  try {
    const costs = await fetchCostMap()
    const models = await fetchModelList(providerId)
    updateProviderModelSelect(providerId, models, costs)
    const current = settings.providers?.[providerId]?.model || ''
    setSelectValue(document.getElementById(`llmModel-${providerId}`), current)
  } catch (err) {
    window.logger.warn('[LLM] Failed to refresh models:', err)
    // Only show notification to user when explicitly requested (not during auto-init)
    if (!silent) {
      showNotification(`Failed to refresh ${providerId} models.`)
    }
  }
}

function readAndStoreProviderInput(providerId) {
  const apiKeyInput = document.getElementById(`llmApiKey-${providerId}`)
  const baseUrlInput = document.getElementById(`llmBaseUrl-${providerId}`)
  const modelSelect = document.getElementById(`llmModel-${providerId}`)
  const riskConfirmInput = document.getElementById(`llmApiKeyRiskConfirm-${providerId}`)
  const providerPatch = {
    apiKey: apiKeyInput?.value || '',
    baseUrl: baseUrlInput?.value || '',
    model: modelSelect?.value || ''
  }
  if (riskConfirmInput) {
    providerPatch.riskAccepted = riskConfirmInput.checked
  }
  updateLlmSettings({
    providers: {
      [providerId]: providerPatch
    }
  })
}


function bindApiKeySecurityDisclosure(providerId, settings) {
  const securityWrap = document.getElementById(`llmApiKeySecurity-${providerId}`)
  const securityNote = document.getElementById(`llmApiKeySecurityNote-${providerId}`)
  const apiKeyInput = document.getElementById(`llmApiKey-${providerId}`)
  const riskConfirmInput = document.getElementById(`llmApiKeyRiskConfirm-${providerId}`)

  if (!securityWrap || !securityNote || !apiKeyInput) return

  const setVisible = visible => {
    securityNote.classList.toggle('is-visible', visible)
  }

  const applyRiskState = () => {
    if (!riskConfirmInput) return
    const riskAccepted = Boolean(riskConfirmInput.checked)
    apiKeyInput.disabled = !riskAccepted
    if (!riskAccepted) {
      apiKeyInput.title = 'Confirm risk acknowledgment to enable API key entry.'
    } else {
      apiKeyInput.title = ''
    }
  }

  securityWrap.addEventListener('mouseenter', () => setVisible(true))
  securityWrap.addEventListener('mouseleave', () => setVisible(false))
  apiKeyInput.addEventListener('focus', () => setVisible(true))
  apiKeyInput.addEventListener('click', () => setVisible(true))

  if (riskConfirmInput) {
    riskConfirmInput.checked = Boolean(settings.providers?.[providerId]?.riskAccepted)
    riskConfirmInput.addEventListener('change', () => {
      applyRiskState()
      readAndStoreProviderInput(providerId)
    })
    applyRiskState()
  }
}

function bindProviderInputs(providerId, settings) {
  if (!ENABLED_PROVIDER_IDS.has(providerId)) return

  const apiKeyInput = document.getElementById(`llmApiKey-${providerId}`)
  const baseUrlInput = document.getElementById(`llmBaseUrl-${providerId}`)
  const modelSelect = document.getElementById(`llmModel-${providerId}`)
  const refreshBtn = document.getElementById(`llmRefresh-${providerId}`)

  bindApiKeySecurityDisclosure(providerId, settings)

  if (apiKeyInput) {
    apiKeyInput.value = settings.providers?.[providerId]?.apiKey || ''
    apiKeyInput.addEventListener('change', () => {
      readAndStoreProviderInput(providerId)
    })
  }
  if (baseUrlInput) {
    baseUrlInput.value = settings.providers?.[providerId]?.baseUrl || ''
    baseUrlInput.addEventListener('change', () => {
      readAndStoreProviderInput(providerId)
    })
  }
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      readAndStoreProviderInput(providerId)
    })
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshProviderModels(providerId, getLlmSettings(), { silent: false }))
  }
}

function bindStrategicSettings(settings) {
  const enabledToggle = document.getElementById('llmStrategicEnabled')
  const tickInput = document.getElementById('llmStrategicInterval')
  const providerSelect = document.getElementById('llmStrategicProvider')
  const verbositySelect = document.getElementById('llmStrategicVerbosity')

  if (enabledToggle) {
    enabledToggle.checked = Boolean(settings.strategic.enabled)
    enabledToggle.addEventListener('change', () => {
      updateLlmSettings({ strategic: { enabled: enabledToggle.checked } })
      // If the user enabled LLM strategic planning, trigger an immediate tick
      if (enabledToggle.checked) {
        try {
          // Dynamic import to avoid circular evaluation ordering issues
          import('../ai/llmStrategicController.js').then(mod => {
            if (typeof mod.triggerStrategicNow === 'function') mod.triggerStrategicNow()
          }).catch(err => {
            window.logger.warn('[LLM] Failed to trigger immediate strategic tick:', err)
          })
        } catch (err) {
          window.logger.warn('[LLM] Failed to trigger immediate strategic tick:', err)
        }
      }
    })
  }

  if (tickInput) {
    tickInput.value = settings.strategic.tickSeconds || 30
    tickInput.addEventListener('change', () => {
      const nextValue = Math.max(5, Number.parseInt(tickInput.value, 10) || 30)
      tickInput.value = nextValue
      updateLlmSettings({ strategic: { tickSeconds: nextValue } })
    })
  }

  if (providerSelect) {
    providerSelect.value = 'openai'
    providerSelect.disabled = true
    if (settings.strategic.provider !== 'openai') {
      updateLlmSettings({ strategic: { provider: 'openai' } })
    }
    providerSelect.addEventListener('change', () => {
      updateLlmSettings({ strategic: { provider: 'openai' } })
      providerSelect.value = 'openai'
    })
  }

  if (verbositySelect) {
    verbositySelect.value = settings.strategic.verbosity || 'minimal'
    verbositySelect.addEventListener('change', () => {
      updateLlmSettings({ strategic: { verbosity: verbositySelect.value } })
    })
  }
}

function bindCommentarySettings(settings) {
  const enabledToggle = document.getElementById('llmCommentaryEnabled')
  const providerSelect = document.getElementById('llmCommentaryProvider')
  const promptInput = document.getElementById('llmCommentaryPrompt')
  const ttsToggle = document.getElementById('llmCommentaryTts')
  const voiceSelect = document.getElementById('llmCommentaryVoice')

  if (enabledToggle) {
    enabledToggle.checked = Boolean(settings.commentary.enabled)
    enabledToggle.addEventListener('change', () => {
      updateLlmSettings({ commentary: { enabled: enabledToggle.checked } })
    })
  }

  if (providerSelect) {
    providerSelect.value = 'openai'
    providerSelect.disabled = true
    if (settings.commentary.provider !== 'openai') {
      updateLlmSettings({ commentary: { provider: 'openai' } })
    }
    providerSelect.addEventListener('change', () => {
      updateLlmSettings({ commentary: { provider: 'openai' } })
      providerSelect.value = 'openai'
    })
  }

  if (promptInput) {
    promptInput.value = settings.commentary.promptOverride || ''
    promptInput.addEventListener('change', () => {
      updateLlmSettings({ commentary: { promptOverride: promptInput.value } })
    })
  }

  if (ttsToggle) {
    ttsToggle.checked = settings.commentary.ttsEnabled !== false
    ttsToggle.addEventListener('change', () => {
      updateLlmSettings({ commentary: { ttsEnabled: ttsToggle.checked } })
    })
  }

  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      updateLlmSettings({ commentary: { voiceName: voiceSelect.value } })
    })
  }

  attachVoiceOptions(voiceSelect, settings)
  if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      attachVoiceOptions(voiceSelect, getLlmSettings())
    })
  }
}

function populateProviderSelect(select) {
  if (!select) return
  select.innerHTML = ''
  PROVIDERS.filter(provider => ENABLED_PROVIDER_IDS.has(provider.id)).forEach(provider => {
    const option = document.createElement('option')
    option.value = provider.id
    option.textContent = provider.label
    select.appendChild(option)
  })
}

export function initLlmSettingsPanel() {
  const settings = getLlmSettings()

  populateProviderSelect(document.getElementById('llmStrategicProvider'))
  populateProviderSelect(document.getElementById('llmCommentaryProvider'))

  bindStrategicSettings(settings)
  bindCommentarySettings(settings)

  PROVIDERS.forEach(provider => {
    bindProviderInputs(provider.id, settings)
  })

  PROVIDERS.forEach(provider => {
    refreshProviderModels(provider.id, settings, { silent: true })
  })
}
