# Implementation Plan: Online Multiplayer Takeover

**Branch**: `001-add-online-multiplayer` | **Date**: 2025-11-24 | **Spec**: [specs/001-add-online-multiplayer/spec.md](specs/001-add-online-multiplayer/spec.md)
**Input**: Feature specification from `/specs/001-add-online-multiplayer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a minimal party invite sidebar that exposes per-party invite links, orchestrate peer-to-peer WebRTC handoff through a tiny Express STUN/signalling endpoint, keep the host as the sole start/pause/cheat authority, and let AI reclaim a party when remote browsers drop so each invite can be reused instantly for the same game instance.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2020+) across the Vite build environment and minimal Express.js for STUN signalling  
**Primary Dependencies**: Vite (build/dev), Canvas + WebRTC browser APIs, Express (only for STUN/signalling), native DOM/Fetch APIs  
**Storage**: LocalStorage for saves + in-memory `gameState` metadata per party  
**Testing**: Manual browser QA (no automated test suite currently defined)  
**Target Platform**: Desktop/web browsers rendering on HTML5 Canvas  
**Project Type**: Web application (frontend Canvas runtime with a minimal `server/` helper for signalling)  
**Performance Goals**: Keep the 60 fps frame budget, make invite join latency <15 s, and drop fallback to AI within 2 s of disconnect  
**Constraints**: Vanilla JS only, minimalistic sidebar, host retains start/pause/cheat authority, invites scoped per `gameInstanceId`, and WebRTC handshake bootstraps via a small Express STUN/signalling layer  
**Scale/Scope**: Single shared map for up to four parties (1 host + up to 3 remote players) with invites bound to each active party in a running or paused match  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution forbids runtime server-side code, but the user specification mandates a minimal Express STUN/signalling service to bootstrap WebRTC. This plan accepts that gate violation because WebRTC requires a signalling medium; we will isolate the Express helper inside `/server/stun.js` and keep all game logic on the client, so friction with the constitution is minimized while still fulfilling the user request.

## Project Structure

### Documentation (this feature)

```text
specs/001-add-online-multiplayer/
├── plan.md              # This file (output of /speckit.plan)
├── research.md          # Phase 0 research summary
├── data-model.md        # Phase 1 entity modeling
├── quickstart.md        # Phase 1 onboarding instructions
├── contracts/           # Phase 1 API contracts (e.g., multiplayer-api.yaml)
└── checklists/
  └── requirements.md  # Spec quality validation checklist
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── ai/
├── input/
├── rendering/
├── ui/
├── network/             # planned multiplayer helpers (invite UI, WebRTC sync)
├── utils/
└── gameState.js

server/
└── stun.js              # express-powered STUN/signalling helper (minimal) 
```

**Structure Decision**: Focus remains on the existing client-side `src/` tree, adding `src/network/` for multiplayer helpers and a tiny `server/stun.js` Express helper solely for WebRTC offers/answers; no other backend is introduced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Minimal Express STUN helper | Needed to bootstrap WebRTC offer/answer exchange per spec | Pure client-only signalling (e.g., shared pastebin) cannot guarantee timely handshake or allow reconnects within the required latency, making the feature unimplementable without a lightweight server |

**Constitution re-check (post Phase 1 design)**: The minimal Express signalling helper still conflicts with the "no server" rule, but its isolation to `/server/stun.js` and the necessity for WebRTC handshakes keeps the violation intentional and documented.
