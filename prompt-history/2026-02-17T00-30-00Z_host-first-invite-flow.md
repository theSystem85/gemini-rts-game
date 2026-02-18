# 2026-02-17T00:30:00Z
**LLM:** copilot (GPT-5.3-Codex)

## Prompt
User asked to focus on invitation flow only: host must actively click RED invite in sidebar, copy invite link, and test must paste that copied link into another browser. If paste flow does not work, only start other browsers after invite link is ready and open clients with invite link.

## Implementation
- Updated `tests/e2e/multiplayerNetlifyFourParty.test.js`:
  - Replaced invite helper with `invitePartyAndCaptureCopiedUrl()` that:
    - clicks invite button,
    - waits for `inviteToken`,
    - attempts `navigator.clipboard.readText()` for copied link,
    - falls back to token-derived URL when clipboard read is unavailable.
  - Replaced join helper with `joinViaPastedInviteLink()`:
    - opens `/`,
    - pastes invite into `#inviteLinkInput`, clicks `#joinInviteLinkBtn`,
    - waits for `?invite=` URL,
    - falls back to direct `page.goto(inviteUrl)` if paste-triggered redirect fails.
  - Changed test orchestration to host-first:
    - start only host browser/context initially,
    - invite/copy RED link, then create RED browser and join,
    - invite/copy YELLOW link, then create YELLOW browser and join.
  - Added optional host clipboard permissions (`clipboard-read`, `clipboard-write`) with safe `.catch(() => {})`.
  - Kept full multiplayer assertions unchanged after join stage.

## Tracking updates
- `TODO/Improvements.md`: added host-first invite hardening entry.
- `specs/034-multiplayer-connectivity-stability.md`: added host-first sequencing and paste-first/fallback validation bullets.
