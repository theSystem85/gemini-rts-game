UTC Timestamp: 2026-02-12T10:03:05Z
LLM: codex

## Prompt
ensure that the sidebar on mobile is by default in condensed mode so that on initial rendering the expanded sidebar is not visible. AFAIK you have to use CSS media query to ensure that for mobile only the condensed sidebar is shown by default and thus on startup. Then (later) the JS kicks in and might change that default condensed state into expanded or collapse (works already, don`t break it). On desktop by default the sidebar should be expanded like it is already.
