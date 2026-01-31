# Prompt History - 2026-01-31T16:09:23Z

**LLM**: GPT-5.2-Codex (OpenAI)
**UTC Timestamp**: 2026-01-31T16:09:23Z

## Summary
Add a headless browser smoke test that fails on console errors and ensure it runs in CI and Netlify before merging to main.

## Full Prompt
implement an integration test for smoke testing if there are any console errors when the game is run in browser (headless). Ensure this test will be run in pipeline before one can merge to main. Ensure the netlify pipeline executes that smoke test as well.
