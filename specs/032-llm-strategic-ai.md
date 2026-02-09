# LLM Strategic AI & Commentary Integration

## Overview
Introduce configurable LLM support for enemy strategic planning and optional enemy commentary. The system integrates with the `ai-api` control protocol, lets players supply API keys and model selections per provider, and tracks token usage + cost per session.

## Goals
- Allow players to enable/disable LLM strategic control of the enemy AI.
- Provide optional “mean opponent” commentary with configurable prompt override and TTS voice selection.
- Fetch model lists from provider APIs (OpenAI, Anthropic, xAI, Ollama) and show token costs in the model pickers.
- Track token consumption and spend per session and surface in the performance overlay.
- Keep LLM input compact with summaries of recent events and decisions.

## Settings & Persistence
- Settings are persisted to localStorage under `rts_llm_settings`.
- Per-provider settings:
  - API key
  - Base URL
  - Selected model
- Strategic settings:
  - Enable toggle
  - Tick interval (seconds)
  - Provider selection
  - Verbosity (minimal/normal/full)
- Commentary settings:
  - Enable toggle
  - Provider selection
  - Prompt override
  - Read-aloud toggle (default enabled)
  - Voice selection (browser TTS voices)

## LLM Providers
- OpenAI: `GET /v1/models`, `POST /v1/chat/completions`
- Anthropic: `GET /v1/models`, `POST /v1/messages`
- xAI: `GET /v1/models`, `POST /v1/chat/completions`
- Ollama: `GET /api/tags`, `POST /api/chat`

## Cost Tracking
- Costs fetched from a remote JSON file when available, with a local fallback (`public/data/llm-costs.json`).
- Usage tallies:
  - Total tokens + cost per session
  - Per provider/model breakdown
- Performance overlay shows LLM tokens and spend.

## Strategic Control Flow
- Every N seconds (default 30s) the strategic controller:
  - Exports `GameTickInput` for each AI player.
  - Adds a compact summary of recent state and transitions.
  - On the first prompt per AI player, sends a full system brief with game overview + control schema.
  - On subsequent prompts, only sends the current state + transitions while keeping the session context.
  - Requests LLM output as `GameTickOutput`.
  - Applies actions via `applyGameTickOutput` with budget overrides.
  - Locks units touched by LLM commands to prevent local AI override.
- Local AI continues micro-management between ticks for units not under an LLM lock.
- OpenAI uses `/v1/responses` with `previous_response_id` and a simplified `json_schema` (protocolVersion, tick, actions, intent, confidence, notes all required) to satisfy provider-side strict validation; bootstrap prompt + schema are included only on the first tick and full validation occurs locally.

## Commentary Flow
- If enabled, a lightweight prompt generates short taunts and announcements.
- Speech synthesis reads commentary aloud when enabled.
- Commentary skips ticks where no interesting events occurred (no combat, production, or destruction events) to avoid spamming.
- When the LLM chooses to skip commentary it responds with `{"skip": true}` which is silently accepted.
- The last 10 commentary messages are tracked and included in the prompt to prevent repetition; the LLM is instructed to vary vocabulary and never repeat itself.
- All commentary notifications are recorded in a persistent notification history log (up to 100 entries) accessible via a bell icon in the top-right corner.

## Fog-of-War Awareness
- The LLM strategic AI only receives information about enemy units and buildings that are visible to its own forces.
- Visibility is computed on-the-fly per AI tick using the AI player's own units and buildings with appropriate vision ranges per unit type.
- If shadow-of-war is disabled in game settings, the full game state is passed without filtering.

## Unit/Building Catalogs in Bootstrap
- The initial strategic system prompt includes a full JSON catalog of all unit types with cost, HP, speed, armor, ammo capacity, damage, weapon type, fire range, spawn building, and tactical role.
- A full JSON catalog of all building types with cost, power consumption, HP, size, weapon stats, requirements, and tactical notes is also included.
- These catalogs give the LLM full knowledge of the game's economy and military capabilities on its first tick.

## Owner-Aware State Updates
- Game state snapshots sent to the LLM include an `owner` field on every unit and building.
- The `summarizeInput()` function provides owner-specific breakdowns (e.g., MyUnits/EnemyUnits/MyBuildings/EnemyBuildings counts).

## LLM-Locked Unit Behavior
- Units under LLM command lock (`llmOrderLockUntil`) still retaliate against attackers within 1.2× their fire range.
- LLM-locked units also auto-target the nearest enemy within fire range if they have no current target.
- After retaliation/auto-targeting, the LLM's strategic orders continue to be respected (units skip normal AI strategic decisions).
- The bootstrap prompt includes guidance on tactical retreat (pull back damaged units below 30% HP to repair buildings).

## UI Hooks
- Settings modal includes LLM sections and provider configuration.
- Hovering an enemy construction yard while LLM strategic AI is enabled shows the latest LLM production plan.
- The production plan tooltip renders a scrollable, ordered list with unit/building names and images.
