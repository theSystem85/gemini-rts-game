import { gameState } from '../gameState.js'
import { TILE_SIZE } from '../config.js'
import { getLlmSettings } from '../ai/llmSettings.js'

let tooltipOpen = false
let listenersAttached = false

function ensureTooltip() {
  let tooltip = document.getElementById('llmQueueTooltip')
  if (tooltip) return tooltip

  tooltip = document.createElement('div')
  tooltip.id = 'llmQueueTooltip'
  tooltip.className = 'llm-queue-tooltip money-tooltip'
  tooltip.setAttribute('aria-hidden', 'true')
  tooltip.innerHTML = `
    <div class="money-tooltip__panel">
      <div class="money-tooltip__header">
        <span>Enemy LLM Queue</span>
        <button class="money-tooltip__close" type="button" aria-label="Close">×</button>
      </div>
      <div class="money-tooltip__content"></div>
    </div>
  `

  document.body.appendChild(tooltip)
  const closeButton = tooltip.querySelector('.money-tooltip__close')
  closeButton?.addEventListener('click', () => hideLlmQueueTooltip())

  return tooltip
}

function renderQueueContent(playerId) {
  const tooltip = ensureTooltip()
  const content = tooltip.querySelector('.money-tooltip__content')
  if (!content) return

  const plan = gameState.llmStrategic?.plansByPlayer?.[playerId]
  const actions = plan?.actions || []
  const queueActions = actions.filter(action => action.type === 'build_queue')

  if (!queueActions.length) {
    content.innerHTML = '<div class="money-tooltip__empty">No queued production from the LLM yet.</div>'
    return
  }

  const rows = queueActions.map((action, index) => {
    const count = action.count || 1
    return `
      <div class="money-tooltip__item llm-queue-tooltip__row">
        <span class="money-tooltip__item-title">#${index + 1} ${action.unitType}</span>
        <span class="money-tooltip__item-value">x${count}</span>
      </div>
    `
  }).join('')

  content.innerHTML = `
    <div class="money-tooltip__section">
      <div class="money-tooltip__section-header">Production Plan</div>
      <div class="money-tooltip__list">${rows}</div>
    </div>
  `
}

function positionTooltip(anchorX, anchorY) {
  const tooltip = ensureTooltip()
  tooltip.style.transform = 'translate(-50%, 0)'
  const tooltipRect = tooltip.getBoundingClientRect()
  const gutter = 12
  let left = anchorX
  let top = anchorY + 16

  if (left - tooltipRect.width / 2 < gutter) {
    left = tooltipRect.width / 2 + gutter
  }
  if (left + tooltipRect.width / 2 > window.innerWidth - gutter) {
    left = window.innerWidth - tooltipRect.width / 2 - gutter
  }
  if (top + tooltipRect.height > window.innerHeight - gutter) {
    top = anchorY - tooltipRect.height - 16
  }
  if (top < gutter) {
    top = gutter
  }

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true

  document.addEventListener('click', (event) => {
    if (!tooltipOpen) return
    const tooltip = document.getElementById('llmQueueTooltip')
    if (tooltip && tooltip.contains(event.target)) return
    hideLlmQueueTooltip()
  })

  window.addEventListener('resize', () => {
    if (!tooltipOpen) return
    hideLlmQueueTooltip()
  })
}

export function showLlmQueueTooltip(building, event) {
  const settings = getLlmSettings()
  if (!settings.strategic.enabled) return
  if (!building || building.type !== 'constructionYard') return
  const humanPlayer = gameState.humanPlayer || 'player1'
  if (building.owner === humanPlayer || (humanPlayer === 'player1' && building.owner === 'player')) return

  attachListeners()
  renderQueueContent(building.owner)

  const tooltip = ensureTooltip()
  tooltip.setAttribute('aria-hidden', 'false')
  tooltip.classList.add('money-tooltip--visible')
  tooltipOpen = true

  if (event?.clientX && event?.clientY) {
    positionTooltip(event.clientX, event.clientY)
  } else {
    const screenX = (building.x + building.width / 2) * TILE_SIZE - gameState.scrollOffset.x
    const screenY = (building.y + building.height / 2) * TILE_SIZE - gameState.scrollOffset.y
    positionTooltip(screenX, screenY)
  }
}

export function hideLlmQueueTooltip() {
  const tooltip = document.getElementById('llmQueueTooltip')
  if (!tooltip) return
  tooltip.setAttribute('aria-hidden', 'true')
  tooltip.classList.remove('money-tooltip--visible')
  tooltipOpen = false
}
