import { exportGameTickInput } from '../ai-api/exporter.js'
import { applyGameTickOutput } from '../ai-api/applier.js'
import { getLlmSettings } from './llmSettings.js'
import { fetchCostMap, getModelCostInfo, requestLlmCompletion } from './llmProviders.js'
import { recordLlmUsage } from './llmUsage.js'
import { showNotification } from '../ui/notifications.js'
import { isHost } from '../network/gameCommandSync.js'
import { gameState } from '../gameState.js'

const DEFAULT_STRATEGIC_PROMPT = `You are the enemy strategic AI in a real-time strategy game.
Return ONLY valid JSON matching the GameTickOutput schema.
Your actions must be explicit, deterministic, and executable by the engine.
Include a brief taunting comment for the player in "notes".
Do not include markdown or extra commentary outside JSON.`

const DEFAULT_COMMENTARY_PROMPT = `You are a mean RTS opponent.
Taunt the player, announce future plans (sometimes bluff), and comment on their battlefield actions.
Keep it under 30 words.`

function getAiPlayers(state) {
  const humanPlayer = state.humanPlayer || 'player1'
  const playerCount = state.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)

  if (!Array.isArray(state.partyStates) || state.partyStates.length === 0) {
    return allPlayers.filter(playerId => playerId !== humanPlayer)
  }

  return allPlayers.filter(playerId => {
    if (playerId === humanPlayer) return false
    const partyState = state.partyStates.find(p => p.partyId === playerId)
    return !partyState || partyState.aiActive !== false
  })
}

function ensureStrategicState(state) {
  if (!state.llmStrategic) {
    state.llmStrategic = {
      lastTickAt: 0,
      lastTickFrame: 0,
      pending: false,
      lastSummary: '',
      plansByPlayer: {}
    }
  }
  return state.llmStrategic
}

function ensureCommentaryState(state) {
  if (!state.llmCommentary) {
    state.llmCommentary = {
      lastTickAt: 0,
      pending: false
    }
  }
  return state.llmCommentary
}

function summarizeInput(input, previousSummary) {
  const resources = input.snapshot?.resources || {}
  const unitCount = Array.isArray(input.snapshot?.units) ? input.snapshot.units.length : 0
  const buildingCount = Array.isArray(input.snapshot?.buildings) ? input.snapshot.buildings.length : 0
  const transitions = Array.isArray(input.transitions?.events) ? input.transitions.events : []
  const recentEvents = transitions.slice(-6).map(evt => evt.type).join(', ')
  const summaryParts = [
    `Tick ${input.tick}`,
    `Money ${Math.round(resources.money || 0)}`,
    `Units ${unitCount}`,
    `Buildings ${buildingCount}`
  ]
  if (recentEvents) {
    summaryParts.push(`Recent: ${recentEvents}`)
  }
  const summary = summaryParts.join(' | ')
  if (!previousSummary) return summary
  return `${previousSummary}\n${summary}`.split('\n').slice(-6).join('\n')
}

function extractJsonBlock(text) {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

function parseOutput(text) {
  const jsonText = extractJsonBlock(text)
  if (!jsonText) return null
  try {
    return JSON.parse(jsonText)
  } catch (err) {
    window.logger.warn('[LLM] Failed to parse JSON output:', err)
    return null
  }
}

function applyUsageCost(providerId, model, usage, costMap) {
  if (!usage) return
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
  const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens)
  const costInfo = getModelCostInfo(providerId, model, costMap)
  let costUsd = 0
  if (costInfo) {
    const divisor = costInfo.unit === 'per_1k' ? 1000 : 1000000
    const inputCost = (promptTokens / divisor) * (costInfo.input || 0)
    const outputCost = (completionTokens / divisor) * (costInfo.output || 0)
    costUsd = inputCost + outputCost
  }
  recordLlmUsage({
    provider: providerId,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd
  })
}

function buildStrategicMessages(input, summary) {
  return [
    {
      role: 'user',
      content: JSON.stringify({
        summary,
        input
      })
    }
  ]
}

function buildCommentaryMessages(input, summary) {
  return [
    {
      role: 'user',
      content: JSON.stringify({
        summary,
        transitions: input.transitions?.events?.slice(-8) || []
      })
    }
  ]
}

function applyLlmLocks(units, unitIds, now, lockMs) {
  unitIds.forEach(id => {
    const unit = units.find(entry => entry.id === id)
    if (unit) {
      unit.llmOrderLockUntil = now + lockMs
    }
  })
}

function updatePlanCache(state, playerId, output) {
  const plan = {
    updatedAt: state.gameTime || performance.now(),
    actions: output.actions || [],
    notes: output.notes || ''
  }
  state.llmStrategic.plansByPlayer[playerId] = plan
}

async function runStrategicTickForPlayer(playerId, state, settings, now) {
  const factories = state.factories || []
  const enemyFactory = factories.find(factory => factory.id === playerId)
  const budget = enemyFactory?.budget ?? 0

  const viewState = {
    ...state,
    money: budget,
    humanPlayer: state.humanPlayer
  }

  const lastTickFrame = state.llmStrategic.lastTickFrame || 0
  const input = exportGameTickInput(viewState, lastTickFrame, {
    playerId,
    verbosity: settings.strategic.verbosity,
    maxActionsPerTick: settings.strategic.maxActions
  })

  const summary = summarizeInput(input, state.llmStrategic.lastSummary)
  state.llmStrategic.lastSummary = summary

  const providerId = settings.strategic.provider
  const model = settings.providers?.[providerId]?.model
  if (!providerId || !model) {
    showNotification('LLM strategic AI needs a provider and model selected.')
    return
  }

  const costMap = await fetchCostMap()
  const messages = buildStrategicMessages(input, summary)
  const response = await requestLlmCompletion(providerId, {
    model,
    system: DEFAULT_STRATEGIC_PROMPT,
    messages
  })

  applyUsageCost(providerId, model, response.usage, costMap)

  const parsed = parseOutput(response.text)
  if (!parsed) {
    showNotification('LLM strategic response was not valid JSON.')
    return
  }

  const result = applyGameTickOutput(state, parsed, {
    playerId,
    money: budget,
    onMoneyChange: (nextBudget) => {
      if (enemyFactory) {
        enemyFactory.budget = nextBudget
      }
    }
  })

  const acceptedCommands = result.accepted.filter(action => action.type === 'unit_command')
  acceptedCommands.forEach(action => {
    applyLlmLocks(state.units || [], action.unitIds || [], now, settings.strategic.tickSeconds * 1000)
  })

  updatePlanCache(state, playerId, parsed)

  if (parsed.notes) {
    showNotification(parsed.notes, 4000)
  }
}

async function runCommentaryTick(state, settings, _now) {
  const providerId = settings.commentary.provider
  const model = settings.providers?.[providerId]?.model
  if (!providerId || !model) {
    showNotification('LLM commentary needs a provider and model selected.')
    return
  }

  const input = exportGameTickInput(state, state.llmStrategic?.lastTickFrame || 0, {
    verbosity: 'minimal'
  })
  const summary = summarizeInput(input, state.llmStrategic?.lastSummary || '')
  const systemPrompt = settings.commentary.promptOverride?.trim() || DEFAULT_COMMENTARY_PROMPT
  const costMap = await fetchCostMap()
  const messages = buildCommentaryMessages(input, summary)
  const response = await requestLlmCompletion(providerId, {
    model,
    system: systemPrompt,
    messages,
    maxTokens: 120,
    temperature: 0.8
  })

  applyUsageCost(providerId, model, response.usage, costMap)

  const comment = response.text?.trim()
  if (!comment) return
  state.llmCommentary.lastText = comment
  showNotification(comment, 5000)
  if (settings.commentary.ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(comment)
    const voices = window.speechSynthesis.getVoices()
    if (settings.commentary.voiceName) {
      const selected = voices.find(v => v.name === settings.commentary.voiceName)
      if (selected) {
        utterance.voice = selected
      }
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }
}

export function updateLlmStrategicAI(units, factories, _bullets, _mapGrid, state = gameState, now = performance.now()) {
  if (!isHost()) return
  const settings = getLlmSettings()
  if (!settings.strategic.enabled && !settings.commentary.enabled) return

  const strategicState = ensureStrategicState(state)
  const commentaryState = ensureCommentaryState(state)

  const tickIntervalMs = Math.max(5, settings.strategic.tickSeconds || 30) * 1000

  if (settings.strategic.enabled && !strategicState.pending && now - strategicState.lastTickAt >= tickIntervalMs) {
    strategicState.pending = true
    strategicState.lastTickAt = now
    strategicState.lastTickFrame = state.frameCount || 0
    const aiPlayers = getAiPlayers(state)
    Promise.all(aiPlayers.map(playerId => runStrategicTickForPlayer(playerId, state, settings, now)))
      .catch(err => {
        window.logger.warn('[LLM] Strategic tick failed:', err)
      })
      .finally(() => {
        strategicState.pending = false
      })
  }

  if (settings.commentary.enabled && !commentaryState.pending && now - commentaryState.lastTickAt >= tickIntervalMs) {
    commentaryState.pending = true
    commentaryState.lastTickAt = now
    runCommentaryTick(state, settings, now)
      .catch(err => {
        window.logger.warn('[LLM] Commentary tick failed:', err)
      })
      .finally(() => {
        commentaryState.pending = false
      })
  }
}
