UTC Timestamp: 2026-02-06T10:57:10Z
LLM: GPT-5.2-Codex

Prompt:
The user was unsatisfied with the code that the agent previously produced, which can be found as the latest commit in the git history.

<PREVIOUS_PR_TITLE>
Fix mobile Apache helipad landing and remote-control takeoff
</PREVIOUS_PR_TITLE>

<PREVIOUS_PR_DESCRIPTION>
### Motivation
- Mobile players reported Apaches kept hovering instead of landing when selected because touch joystick idle input interfered with helipad commands.
- Remote-control should still work: if a grounded Apache is remote-controlled it must auto-lift and then accept steering inputs.

### Description
- Clear helipad targets when remote-control input starts by setting `unit.helipadTargetId = null` and canceling `helipadLandingRequested` in `src/game/remoteControl.js` so remote control overrides landing state.
- Make remote control trigger an automatic takeoff for grounded Apaches by treating a remote-active (non-descend) start as a `takeoff` condition in `src/game/remoteControl.js`.
- On touch layouts, ignore small/idle absolute joystick inputs while a helipad landing is in progress by applying a `landingOverrideThreshold` so tiny mobile inputs do not cancel or block helipad landings (logic in `src/game/remoteControl.js`).
- Kept the prior change that routes helipad clicks for selected Apaches (`src/input/mouseCommands.js`) and updated tracking docs and spec files (`TODO/Bugs.md`, `specs/004-advanced-unit-control/spec.md`) and added a prompt-history entry for traceability.

### Testing
- Ran `npm run lint:fix`; eslint autofix completed successfully with no blocking errors.
- Reviewed and exercised the Apache remote-control and helipad landing flows to confirm that touch joystick idle input no longer blocks mobile landings and that initiating remote control from grounded state causes an automatic takeoff then normal remote control steering.
- Commit created with message: `Fix mobile apache helipad landing`
</PREVIOUS_PR_DESCRIPTION>

<PREVIOUS_PR_DIFF_AND_COMMENTS>
diff --git a/TODO/Bugs.md b/TODO/Bugs.md
(File changed with 2 additions, 0 deletions)
diff --git a/None b/prompt-history/20260205T183925Z_apache-landing-selected.md
(File changed with 5 additions, 0 deletions)
diff --git a/None b/prompt-history/20260206T080435Z_mobile-apache-landing.md
(File changed with 39 additions, 0 deletions)
diff --git a/specs/004-advanced-unit-control/spec.md b/specs/004-advanced-unit-control/spec.md
(File changed with 2 additions, 0 deletions)
diff --git a/src/game/remoteControl.js b/src/game/remoteControl.js
(File changed with 2 additions, 1 deletions)
diff --git a/src/game/remoteControl.js b/src/game/remoteControl.js
(File changed with 12 additions, 9 deletions)
diff --git a/src/input/mouseCommands.js b/src/input/mouseCommands.js
(File changed with 19 additions, 0 deletions)
</PREVIOUS_PR_DIFF_AND_COMMENTS>

Please address any inline comments on the diff, as well as any additional instructions below.

1) The issue is still not solved. Try harder to find the root cause and fix it! 2) Also ensure the heli does not use the same path finding like the ground units because it does not need to avoid ground obstacles. Ensure heli stops at max range before target so heli can attack at max possible distance! 3) Ensure heli makes 3x more damage as now on tanker trucks and ammo trucks. 4) ensure enemy helis attack other helis immediately when in range and after nearby targets are destroyed the enemy helis continues on its former task or target!
