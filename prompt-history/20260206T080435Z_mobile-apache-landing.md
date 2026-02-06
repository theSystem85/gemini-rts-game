UTC Timestamp: 2026-02-06T08:04:35Z
LLM: GPT-5.2-Codex

Prompt:
The user was unsatisfied with the code that the agent previously produced, which can be found as the latest commit in the git history.

<PREVIOUS_PR_TITLE>
Allow Apache helipad landing while selected
</PREVIOUS_PR_TITLE>

<PREVIOUS_PR_DESCRIPTION>
### Motivation
- Users were unable to order selected Apache helicopters to land on a helipad without first deselecting them, which breaks standard command flow for air units.
- The change documents the requirement in the feature spec and marks the bug tracker so the behavior is tracked and visible.

### Description
- Added handling in `src/input/mouseCommands.js` inside `handleStandardCommands` to detect when all commandable units are Apaches and the clicked tile is a `helipad`, and call `unitCommands.handleApacheHelipadCommand(...)` to issue landing orders while units remain selected.
- Updated `TODO/Bugs.md` to mark the helipad-selection landing issue as addressed.
- Added `FR-054` to `specs/004-advanced-unit-control/spec.md` to require that Apaches can receive helipad landing commands while still selected.
- Recorded the incoming prompt in `prompt-history/20260205T183925Z_apache-landing-selected.md` for traceability.

### Testing
- Ran `npm run lint:fix` to apply lint fixes; autofix completed without blocking errors.
- Verified the code change is limited to command routing and does not alter helipad logic itself by calling the existing handler `handleApacheHelipadCommand`.
- Git commit created with message: `Fix apache helipad landing when selected`.
</PREVIOUS_PR_DESCRIPTION>

<PREVIOUS_PR_DIFF_AND_COMMENTS>
diff --git a/TODO/Bugs.md b/TODO/Bugs.md
(File changed with 1 additions, 0 deletions)
diff --git a/None b/prompt-history/20260205T183925Z_apache-landing-selected.md
(File changed with 5 additions, 0 deletions)
diff --git a/specs/004-advanced-unit-control/spec.md b/specs/004-advanced-unit-control/spec.md
(File changed with 1 additions, 0 deletions)
diff --git a/src/input/mouseCommands.js b/src/input/mouseCommands.js
(File changed with 19 additions, 0 deletions)
</PREVIOUS_PR_DIFF_AND_COMMENTS>

the landing of the heli on the pad when still selected only works on desktop. on mobile it keeps being airborne. I assume it might interfere with the remote control feature on mobile. Ensure the heli can land on the pad while still selected on mobile though but do not break the remote control feature as well. keep both working. when heli is landed and user tries to remote control it, the heli automatically lifts up first, then it can be steered in all direction like normal remote control.
