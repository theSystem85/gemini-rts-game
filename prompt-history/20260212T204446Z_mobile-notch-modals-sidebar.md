# Prompt History
- UTC Timestamp: 2026-02-12T20:44:46Z
- LLM: codex (GPT-5.2-Codex)

## Prompt
The user was unsatisfied with the code that the agent previously produced, which can be found as the latest commit in the git history.

<PREVIOUS_PR_TITLE>
fix: offset portrait notifications below top safe area
</PREVIOUS_PR_TITLE>

<PREVIOUS_PR_DESCRIPTION>
### Motivation
- Ensure transient top notifications on mobile portrait are rendered below device notches by honoring the top safe-area inset and to document the requirement in project tracking and specs.

### Description
- Add `top: calc(var(--safe-area-top) + 10px) !important;` to the `body.mobile-portrait .notification` rule in `styles/notificationHistory.css`, update `TODO/Improvements.md` to record the completed improvement, append a Notification Safe Area note to `specs/010-mobile-portrait-sidebar-toggle/spec.md`, and archive the incoming prompt in `prompt-history/20260212T194140Z_mobile-notch-notifications.md`.

### Testing
- Ran `npm run lint:fix:changed` which completed successfully (no changed lintable files); an attempted Playwright screenshot check to visually validate placement failed to load the local `index.html` in this environment so no screenshot artifact was produced.
</PREVIOUS_PR_DESCRIPTION>

<PREVIOUS_PR_DIFF_AND_COMMENTS>
diff --git a/TODO/Improvements.md b/TODO/Improvements.md
(File changed with 1 additions, 0 deletions)
diff --git a/None b/prompt-history/20260212T194140Z_mobile-notch-notifications.md
(File changed with 6 additions, 0 deletions)
diff --git a/specs/010-mobile-portrait-sidebar-toggle/spec.md b/specs/010-mobile-portrait-sidebar-toggle/spec.md
(File changed with 4 additions, 0 deletions)
diff --git a/styles/notificationHistory.css b/styles/notificationHistory.css
(File changed with 2 additions, 1 deletions)
</PREVIOUS_PR_DIFF_AND_COMMENTS>

Please address any inline comments on the diff, as well as any additional instructions below.

Also ensure in mobile portrait all modals and expanded sidebar content sits below the top notch safe area as well as the notification list button toggle!
