# Single Path Lock for Player Moves

**UTC Timestamp:** 2026-01-31T20:39:00Z
**LLM:** GitHub Copilot (GPT-5.1-Codex-Max)

## Prompt Summary
User reports path still recalculates immediately after issuing a move command; wants exactly one path calculation and no detours.

## Investigation
- Rechecked path-setting hotspots; main suspect is `movementStuck` detours (random moves/dodge) that can override the freshly issued player path.

## Fix Applied
- In `movementStuck.handleStuckUnit`, skip all stuck/dodge detours for human-controlled units that already have an active moveTarget and path (and are not retreating/dodging/sweeping). This preserves the original player-issued path until consumed.

## Notes
- No AI behavior changes; only human-controlled move commands are protected from automatic detours.
