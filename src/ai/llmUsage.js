import { gameState } from '../gameState.js'

export function ensureLlmUsageState() {
  if (!gameState.llmUsage) {
    gameState.llmUsage = {
      totalTokens: 0,
      totalCostUsd: 0,
      byModel: {}
    }
  }
  return gameState.llmUsage
}

export function resetLlmUsage() {
  gameState.llmUsage = {
    totalTokens: 0,
    totalCostUsd: 0,
    byModel: {}
  }
}

export function recordLlmUsage({ provider, model, promptTokens, completionTokens, totalTokens, costUsd }) {
  const usage = ensureLlmUsageState()
  const resolvedTotal = Number.isFinite(totalTokens)
    ? totalTokens
    : (Number(promptTokens || 0) + Number(completionTokens || 0))

  usage.totalTokens += resolvedTotal
  usage.totalCostUsd += Number(costUsd || 0)

  const key = `${provider}:${model}`
  if (!usage.byModel[key]) {
    usage.byModel[key] = {
      provider,
      model,
      totalTokens: 0,
      totalCostUsd: 0
    }
  }
  usage.byModel[key].totalTokens += resolvedTotal
  usage.byModel[key].totalCostUsd += Number(costUsd || 0)
}

export function formatUsd(value) {
  const safe = Number.isFinite(value) ? value : 0
  return `$${safe.toFixed(4)}`
}
