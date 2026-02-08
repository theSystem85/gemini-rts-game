# 2026-02-07T14:00:00Z
Processed by: GitHub Copilot (Claude Sonnet 4.5)

## User Prompt:

when LLM AI is enabled and I get this network request response then ensure that the game will no longer be polling the LLM and show the user the proper error message, that he ran out of quota for the specific provider. In that case let the enemy AI fallback to the local AI only:

```json
{
    "error": {
        "message": "You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.",
        "type": "insufficient_quota",
        "param": null,
        "code": "insufficient_quota"
    }
}
```

## Implementation Summary:

### Changes Made:

1. **Created QuotaExceededError class** in `src/ai/llmProviders.js`:
   - Custom error class to identify quota exceeded errors
   - Includes provider ID for better error reporting

2. **Updated error detection** in `src/ai/llmProviders.js`:
   - Added quota error detection for OpenAI and xAI providers
   - Added quota error detection for Anthropic provider
   - Checks for both `error.code` and `error.type` fields
   - Throws QuotaExceededError when quota is exceeded

3. **Added fallback mechanism** in `src/ai/llmStrategicController.js`:
   - Imported `updateLlmSettings` to disable LLM AI
   - Created `disableLlmAI()` function to disable strategic/commentary AI
   - Wrapped LLM requests in try-catch blocks
   - Catches QuotaExceededError and:
     - Displays user-friendly notification (6 seconds)
     - Logs warning message
     - Automatically disables the affected LLM feature
     - Allows fallback to local AI for strategic planning
   - Separate handling for strategic AI and commentary AI

### Behavior:

- When quota exceeded error is detected:
  - User sees: "{Provider} API quota exceeded. LLM Strategic AI disabled, falling back to local AI only."
  - LLM polling stops immediately
  - Setting is persisted to localStorage
  - Local enemy AI continues to function normally
  - Only the affected feature (strategic or commentary) is disabled

### Files Modified:

- `src/ai/llmProviders.js`
- `src/ai/llmStrategicController.js`
