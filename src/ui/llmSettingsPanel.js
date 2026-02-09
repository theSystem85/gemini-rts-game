import { getLlmSettings, updateLlmSettings } from '../ai/llmSettings.js'
import { fetchCostMap, fetchModelList, formatModelCost, getModelCostInfo } from '../ai/llmProviders.js'
import { showNotification } from './notifications.js'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'xai', label: 'xAI' },
  { id: 'ollama', label: 'Ollama' }
]

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

async function refreshProviderModels(providerId, settings) {
  try {
    const costs = await fetchCostMap()
    const models = await fetchModelList(providerId)
    updateProviderModelSelect(providerId, models, costs)
    const current = settings.providers?.[providerId]?.model || ''
    setSelectValue(document.getElementById(`llmModel-${providerId}`), current)
  } catch (err) {
    window.logger.warn('[LLM] Failed to refresh models:', err)
    showNotification(`Failed to refresh ${providerId} models.`)
  }
}

function readAndStoreProviderInput(providerId) {
  const apiKeyInput = document.getElementById(`llmApiKey-${providerId}`)
  const baseUrlInput = document.getElementById(`llmBaseUrl-${providerId}`)
  const modelSelect = document.getElementById(`llmModel-${providerId}`)
  updateLlmSettings({
    providers: {
      [providerId]: {
        apiKey: apiKeyInput?.value || '',
        baseUrl: baseUrlInput?.value || '',
        model: modelSelect?.value || ''
      }
    }
  })
}

function bindProviderInputs(providerId, settings) {
  const apiKeyInput = document.getElementById(`llmApiKey-${providerId}`)
  const baseUrlInput = document.getElementById(`llmBaseUrl-${providerId}`)
  const modelSelect = document.getElementById(`llmModel-${providerId}`)
  const refreshBtn = document.getElementById(`llmRefresh-${providerId}`)

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
    refreshBtn.addEventListener('click', () => refreshProviderModels(providerId, getLlmSettings()))
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
    providerSelect.value = settings.strategic.provider || 'openai'
    providerSelect.addEventListener('change', () => {
      updateLlmSettings({ strategic: { provider: providerSelect.value } })
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
    providerSelect.value = settings.commentary.provider || 'openai'
    providerSelect.addEventListener('change', () => {
      updateLlmSettings({ commentary: { provider: providerSelect.value } })
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
  PROVIDERS.forEach(provider => {
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
    refreshProviderModels(provider.id, settings)
  })
}
