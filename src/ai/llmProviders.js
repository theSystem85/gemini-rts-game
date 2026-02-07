import { getProviderSettings } from './llmSettings.js'

const REMOTE_COSTS_URL = 'https://raw.githubusercontent.com/codeandconquer/llm-costs/main/llm-costs.json'
const LOCAL_COSTS_URL = '/data/llm-costs.json'

let cachedCosts = null
let costFetchInFlight = null

function normalizeBaseUrl(url) {
  if (!url) return ''
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export async function fetchCostMap() {
  if (cachedCosts) return cachedCosts
  if (costFetchInFlight) return costFetchInFlight

  costFetchInFlight = (async() => {
    const urls = [REMOTE_COSTS_URL, LOCAL_COSTS_URL].filter(Boolean)
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) continue
        const data = await response.json()
        cachedCosts = data
        return cachedCosts
      } catch (err) {
        window.logger.warn('[LLM] Failed to fetch cost map from', url, err)
      }
    }
    cachedCosts = { models: {} }
    return cachedCosts
  })()

  return costFetchInFlight
}

export function getModelCostInfo(providerId, modelId, costMap) {
  if (!costMap || !costMap.models) return null
  const providerCosts = costMap.models[providerId]
  if (!providerCosts) return null
  return providerCosts[modelId] || null
}

export function formatModelCost(costInfo) {
  if (!costInfo) return ''
  const input = Number.isFinite(costInfo.input) ? costInfo.input : null
  const output = Number.isFinite(costInfo.output) ? costInfo.output : null
  if (input === null && output === null) return ''
  const unit = costInfo.unit === 'per_1k' ? '1k' : '1M'
  if (input !== null && output !== null) {
    return ` ($${input}/${unit} in, $${output}/${unit} out)`
  }
  if (input !== null) {
    return ` ($${input}/${unit} in)`
  }
  return ` ($${output}/${unit} out)`
}

export async function fetchModelList(providerId) {
  const settings = getProviderSettings(providerId)
  if (!settings) return []
  const baseUrl = normalizeBaseUrl(settings.baseUrl)

  switch (providerId) {
    case 'openai': {
      if (!settings.apiKey) return []
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${settings.apiKey}`
        }
      })
      if (!response.ok) {
        throw new Error(`OpenAI model fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      return (payload.data || [])
        .map(model => model.id)
        .filter(Boolean)
        .sort()
    }
    case 'anthropic': {
      if (!settings.apiKey) return []
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        }
      })
      if (!response.ok) {
        throw new Error(`Anthropic model fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      return (payload.data || [])
        .map(model => model.id)
        .filter(Boolean)
        .sort()
    }
    case 'xai': {
      if (!settings.apiKey) return []
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${settings.apiKey}`
        }
      })
      if (!response.ok) {
        throw new Error(`xAI model fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      return (payload.data || [])
        .map(model => model.id)
        .filter(Boolean)
        .sort()
    }
    case 'ollama': {
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) {
        throw new Error(`Ollama model fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      return (payload.models || [])
        .map(model => model.name)
        .filter(Boolean)
        .sort()
    }
    default:
      return []
  }
}

export async function requestLlmCompletion(providerId, { model, messages, system, maxTokens = 600, temperature = 0.4 }) {
  const settings = getProviderSettings(providerId)
  if (!settings) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  const baseUrl = normalizeBaseUrl(settings.baseUrl)

  switch (providerId) {
    case 'openai':
    case 'xai': {
      if (!settings.apiKey) {
        throw new Error(`${providerId} API key missing`)
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            ...messages
          ],
          temperature,
          max_tokens: maxTokens
        })
      })
      if (!response.ok) {
        throw new Error(`${providerId} completion failed: ${response.status}`)
      }
      const payload = await response.json()
      const content = payload.choices?.[0]?.message?.content || ''
      return {
        text: content,
        usage: payload.usage || null
      }
    }
    case 'anthropic': {
      if (!settings.apiKey) {
        throw new Error('Anthropic API key missing')
      }
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages
        })
      })
      if (!response.ok) {
        throw new Error(`Anthropic completion failed: ${response.status}`)
      }
      const payload = await response.json()
      const content = payload.content?.[0]?.text || ''
      return {
        text: content,
        usage: payload.usage || null
      }
    }
    case 'ollama': {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            ...messages
          ],
          stream: false,
          options: {
            temperature
          }
        })
      })
      if (!response.ok) {
        throw new Error(`Ollama completion failed: ${response.status}`)
      }
      const payload = await response.json()
      return {
        text: payload.message?.content || '',
        usage: payload.usage || {
          prompt_tokens: payload.prompt_eval_count,
          completion_tokens: payload.eval_count,
          total_tokens: payload.prompt_eval_count + payload.eval_count
        }
      }
    }
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}
