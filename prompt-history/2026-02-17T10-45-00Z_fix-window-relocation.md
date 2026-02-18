# 2026-02-17T10:45:00Z
**LLM:** copilot (GPT-5.3-Codex)

## Prompt
User reported host browser initially opens on large screen, then quickly relocates to smaller screen; RED/YELLOW then also spawn there. Requested to keep windows on largest screen.

## Root cause
All roles were using separate BrowserContexts from one shared Playwright Browser instance. In headed Chromium, CDP window-bounds operations can resolve to shared/native window targets, causing window relocation side-effects across roles.

## Fix
- Updated `tests/e2e/multiplayerNetlifyFourParty.test.js`:
  - Launch HOST/RED/YELLOW as separate Chromium browser processes via `browser.browserType().launch()`.
  - Keep per-role context and page per browser process.
  - Preserve dynamic largest-screen layout and `positionBrowserWindow()` calls.
  - Close role browsers directly in `finally`.

## Verification
- Ran `npm run test:e2e:multiplayer`.
- Logs confirm stable large-screen placement:
  - HOST `(0,40)` `1280x1480`
  - RED `(1280,40)` `1280x1480`
  - YELLOW `(2560,40)` `1280x1480`
- Invite flow and joins still work.
- Remaining failure is later provisioning timeout (unrelated to window placement).
