UTC Timestamp: 20260220T110830Z
LLM: codex (GPT-5.2-Codex)

Prompt:
The user was unsatisfied with the code that the agent previously produced, which can be found as the latest commit in the git history.

<PREVIOUS_PR_TITLE>
Restore animated radar-offline minimap grain effect
</PREVIOUS_PR_TITLE>

<PREVIOUS_PR_DESCRIPTION>
### Motivation
- The minimap’s "RADAR OFFLINE" state showed a static grain background, which made the offline indicator feel frozen and reduced perceived polish; the goal is to restore subtle continuous motion without regenerating noise every frame.

### Description
- Updated `src/rendering/minimapRenderer.js` to keep a cached offline-noise canvas and added a per-frame compositing pass that scrolls the cached grain texture to produce motion while keeping the base generation one-time.  
- Added a lightweight moving scanline gradient overlay to reinforce the offline-monitor effect without obscuring the `RADAR OFFLINE` text.  
- Added tracking artifacts: marked the bug in `TODO/Bugs.md`, added `specs/041-radar-offline-grain-animation.md`, and archived the prompt in `prompt-history/20260220T105513Z_restore-radar-grain-animation.md`.

### Testing
- Ran `npm run lint:fix:changed`, which completed successfully.  
- Attempted an automated screenshot run with Playwright, but the environment could not load `file:///workspace/code-for-battle/index.html` so no screenshot was produced.  
- Changes were committed with message: `Fix animated grain effect for radar-offline minimap`.
</PREVIOUS_PR_DESCRIPTION>

<PREVIOUS_PR_DIFF_AND_COMMENTS>
diff --git a/TODO/Bugs.md b/TODO/Bugs.md
(File changed with 1 additions, 0 deletions)
diff --git a/None b/prompt-history/20260220T105513Z_restore-radar-grain-animation.md
(File changed with 5 additions, 0 deletions)
diff --git a/None b/specs/041-radar-offline-grain-animation.md
(File changed with 15 additions, 0 deletions)
diff --git a/src/rendering/minimapRenderer.js b/src/rendering/minimapRenderer.js
(File changed with 2 additions, 1 deletions)
diff --git a/src/rendering/minimapRenderer.js b/src/rendering/minimapRenderer.js
(File changed with 32 additions, 1 deletions)
</PREVIOUS_PR_DIFF_AND_COMMENTS>

Please address any inline comments on the diff, as well as any additional instructions below.

ensure the animation can be checked on/off in the settings modal. Also ensure that the grain (white snow) effect itself is moving/flickering like on an old TV that has no analogue broadcast connection
