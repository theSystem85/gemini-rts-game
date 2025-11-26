---

description: "Task list for implementing online multiplayer takeover"
---

# Tasks: Online Multiplayer Takeover

**Input**: Design docs from `/specs/001-add-online-multiplayer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the project structure and minimal backend helper referenced by the plan.

- [x] T001 Create `src/network` directory and placeholder `invites.js`, `signalling.js`, `hostNotifications.js` entry modules per implementation plan
- [x] T002 Add `server/stun.js` Express helper that exposes `/signalling/offer`, `/signalling/answer`, `/signalling/candidate`, `/game-instance/:instanceId/invite-regenerate` endpoints as documented in `specs/001-add-online-multiplayer/contracts/multiplayer-api.yaml`
- [x] T003 Update `package.json` scripts and dev tooling notes (in `package.json` and `Documentation.md`) to mention how to start the Express STUN helper alongside the Vite dev server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire shared game state, config updates, and session tracking that underpin all user stories.

- [x] T004 Introduce multiplayer constants in `src/config.js` (invite token TTL, max parties, party colors) referenced by `data-model.md`
- [x] T005 Extend `src/gameState.js` to track `partyStates`, `gameInstanceId`, and the host identifier used by `PartyState` and `InviteLink` entries in `data-model.md`
- [x] T006 Implement `src/network/webrtcSession.js` to manage `WebRTCSession` lifecycles (offer/answer storage, ICE candidates, lastHeartbeat) using the structures in `data-model.md`
- [x] T007 Create `src/network/multiplayerStore.js` that exposes helpers to generate/validate invite tokens per `InviteLink` rules and to notify `PartyState` about AI/human ownership changes

---

## Phase 3: User Story 1 - Host invites remote player (Priority: P1) 🎯 MVP

**Goal**: Render minimal sidebar rows per party, show invite buttons, and generate sharable links without disturbing the Canvas.

**Independent Test**: Host opens sidebar, clicks a party’s invite button, copies the token/URL, and confirms no canvas UI shift while the notification appears.

### Implementation for User Story 1

- [x] T008 [US1] Render party list rows below the `Players:` input in `src/ui/sidebarMultiplayer.js` using `PartyState` data so each row shows color, owner label, and invite button
- [x] T009 [US1] Implement invite button flow in `src/ui/sidebarMultiplayer.js` that calls `src/network/multiplayerStore.js` to build the link and logs it to `src/network/hostNotifications.js` so the host sees a confirmation
- [x] T010 [US1] Wire `src/network/multiplayerStore.js` link builder to `server/stun.js` via fetch POST to `/signalling/offer` so the generated token matches the Express helper contract
	- [x] T011 [US1] Persist host invite visibility state in `src/gameState.js` so the party rows stay minimalistic while the host uses the invite immediately

**Checkpoint**: Party invites can be generated and shared without blocking gameplay; host sees notifications confirming invite creation.

---

## Phase 4: User Story 2 - Remote player joins running/paused match (Priority: P2)

**Goal**: Allow remote players to enter an alias, post offers, receive answers, and gain control while host remains authoritative for start/pause/cheats.

**Independent Test**: Remote browser opens invite, submits alias, and immediately observes the running/paused state mirrored while host retains start/pause/cheat buttons disabled for non-hosts.

### Implementation for User Story 2

- [x] T012 [US2] Create `src/network/remoteConnection.js` and deliver the invite landing alias UI so that invite links collect a name and call `createRemoteConnection` to post the offer, poll answers, and exchange ICE candidates per `contracts/multiplayer-api.yaml`
- [x] T013 [US2] Add WebRTC DataChannel synchronization in `src/network/webrtcSession.js` so remote commands stream to the host and host commands include metadata about the running/paused flag (per research decision)
	- done: the host polls `/signalling/pending`, answers offers, consumes remote input, and broadcasts the pause/running state back to each peer
- [x] T014 [US2] Update `src/ui/sidebarMultiplayer.js` and `src/input/inputHandler.js` to respect host-only start/pause/cheat rights by disabling those buttons for non-host sessions while still allowing remote control inputs to transmit through WebRTC (host-only controls now listen for session events)
- [x] T015 [US2] Emit join notification from `src/network/hostNotifications.js` when `WebRTCSession` connection goes from `pending` to `connected`, honoring the spec requirement for host alerts

**Checkpoint**: Remote player can join seamlessly, issue commands, and host remains the sole authority for game control actions.

---

## Phase 5: User Story 3 - AI fallback and host handover (Priority: P3)

**Goal**: Automatically revert parties to AI on disconnect, regenerate invites on save loads, and assign the save loader as new host with new tokens.

**Independent Test**: Close the remote tab and confirm AI resumes within 2 s; load a save from a non-host and confirm new invite tokens plus new host rights.

### Implementation for User Story 3

- [x] T016 [US3] Detect WebRTC disconnects in `src/network/webrtcSession.js`, flip `aiActive` to true in `src/network/multiplayerStore.js`, and display a re-activation notification in `src/network/hostNotifications.js`
  - done: HostSession state change handler detects DISCONNECTED/FAILED, calls markPartyControlledByAi, emits AI_REACTIVATION_EVENT, and shows notification
- [x] T017 [US3] Trigger `/game-instance/:instanceId/invite-regenerate` from `src/saveGame.js` when a save loads under a non-host, update `gameInstanceId`, regenerate tokens via `src/network/multiplayerStore.js`, and refresh the sidebar invite UI
  - done: multiplayerStore exports regenerateAllInviteTokens() and isHost(); saveGame.js calls regeneration on load
- [x] T018 [US3] Ensure AI controllers in `src/ai/` reinitialize party assignments when `multiStore` reports `aiActive`, so gameplay continues immediately if a remote disconnect occurs before the next invite is consumed
  - done: aiPartySync.js module observes AI reactivation events and reinitializes AI controllers for disconnected parties

**Checkpoint**: Invite links survive disconnects, saves reload with new hosts/tokens, and AI immediately retakes disconnected parties.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification, and ensuring multiplayer behavior fits the quickstart guidance.

- [ ] T019 [P] Document the multiplayer workflow and STUN startup in `specs/001-add-online-multiplayer/quickstart.md` (update steps if implementations shifted)
- [ ] T020 [P] Add UX verification notes to `Documentation.md` showing how to test host notifications, invite reuse, and host-only controls across browsers
- [ ] T021 [P] Confirm `specs/001-add-online-multiplayer/checklists/requirements.md` still passes by reviewing updated spec against checklist
- [ ] T022 [P] Run manual quickstart steps (per `quickstart.md`) and verify the remote join path works, then log results in `specs/001-add-online-multiplayer/plan.md` notes section

---

## Phase 7: Map Synchronization & Client UI

**Purpose**: Ensure clients receive and use the host's map configuration rather than their own local settings.

- [x] T034 [US2] Sync map seed and dimensions from host to client
  - done: Added mapSeed to game state snapshot; Client regenerates map using host's seed via regenerateMapForClient() in main.js; Map settings UI hidden for clients when invite token detected and when connected; Settings restored on disconnect

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Foundation for backend helper and repo structure
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories until complete
- **User Stories (Phase 3–5)**: Can begin after Phase 2; ordered by priority but remain independently testable
- **Polish (Phase 6)**: Depends on all user stories being implemented

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (config/state/session scaffolding) but not on other stories
- **User Story 2 (P2)**: Depends on Phase 2 and on WebRTC DataChannel/session work introduced in Story 1 and foundational tasks (but not strictly on Story 3)
- **User Story 3 (P3)**: Depends on Phase 2 plus Stories 1/2 for invite links and remote connections already being in place

### Parallel Opportunities

- **Phase 1**: Tasks T001-T003 can run in parallel because they touch distinct folders (`src/network` vs `server/` vs config docs)
- **Phase 2**: Each foundational task updates different modules (`config.js`, `gameState.js`, `src/network/`), so T004-T007 are parallelizable
- **Story Phases**: Different stories target different subsystems (UI invites, remote join, AI fallback), so teams can work on US1, US2, and US3 concurrently once the foundation is ready
- **Polish**: All T019-T022 are [P] and can occur together after user stories are implemented

## Parallel Example: User Story 1

- Task: "T008 [US1] Render party list rows below the `Players:` input in `src/ui/sidebarMultiplayer.js`"
- Task: "T009 [US1] Implement invite button flow that calls `src/network/multiplayerStore.js`"

## Implementation Strategy

### MVP First (User Story 1 only)
1. Complete Phase 1 + Phase 2
2. Implement Story 1 (invite UI + notifications)
3. Verify invites appear and host receives notifications; this is the MVP content
4. Deploy or ship the MVP and gather feedback before adding Story 2 and Story 3 behaviors

### Incremental Delivery
1. After MVP, implement Story 2 remote client join
2. Once Story 2 works, implement Story 3 AI failover and save handover
3. Each story remains independently testable per the spec

### Parallel Team Strategy
1. Team A works Setup + Foundation
2. Team B picks up Story 1 while Team C starts Story 2 once foundational blocks are in place
3. Story 3 can follow with overlap; cross-cutting polish (Phase 6) can run concurrently with final story verification

---

Contact: Run `/speckit.tasks` again if user stories or requirements change radically
