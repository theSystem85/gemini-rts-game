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
  - Requests LLM output as `GameTickOutput`.
  - Applies actions via `applyGameTickOutput` with budget overrides.
  - Locks units touched by LLM commands to prevent local AI override.
- Local AI continues micro-management between ticks for units not under an LLM lock.

## Commentary Flow
- If enabled, a lightweight prompt generates short taunts and announcements.
- Speech synthesis reads commentary aloud when enabled.

## UI Hooks
- Settings modal includes LLM sections and provider configuration.
- Clicking an enemy construction yard while LLM strategic AI is enabled shows the latest LLM production plan.
