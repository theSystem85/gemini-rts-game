# Prompt History Entry
- UTC: 2026-02-17T21-09-59Z
- LLM: copilot (GPT-5.3-Codex)

## Prompt
looks like the AGF selection does not work so well in an e2e test like that. so make sure you can do it programmatically but also make sure for the game engine it is like AGF was used. I want the attack targets to be all visible when I select the buildings during the test.

## Requirements Captured
- Replace flaky E2E mouse-drag AGF with deterministic programmatic AGF behavior.
- Ensure engine state matches AGF semantics (selected combat units and AGF target/attack queues).
- Keep all BLUE structure targets visibly highlighted during selection in the test.
