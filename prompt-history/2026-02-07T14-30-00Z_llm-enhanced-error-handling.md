# 2026-02-07T14:30:00Z
Processed by: GitHub Copilot (Claude Sonnet 4.5)

## User Prompt:

1. Only show error messages when the LLM provider actually has an API key entered by the user
2. Handle 401 authentication/permission errors from OpenAI API
3. Handle 400 parameter errors (specifically `max_tokens` vs `max_completion_tokens`)

### Example Errors to Handle:

**401 Authentication Error:**
```json
{
  "error": {
    "message": "You have insufficient permissions for this operation. Missing scopes: model.request...",
    "type": "invalid_request_error",
    "param": null,
    "code": null
  }
}
```

**400 Parameter Error:**
```json
{
  "error": {
    "message": "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    "type": "invalid_request_error",
    "param": "max_tokens",
    "code": "unsupported_parameter"
  }
}
```

## Implementation Summary:

### Changes Made:

1. **Added new error classes** in `src/ai/llmProviders.js`:
   - `AuthenticationError`: For 401 authentication/permission errors
   - `ApiParameterError`: For 400 API parameter errors (like max_tokens issues)

2. **Updated OpenAI/xAI completion requests** in `src/ai/llmProviders.js`:
   - Changed `max_tokens` to `max_completion_tokens` for newer OpenAI API compatibility
   - Added specific error detection for authentication errors (401 status)
   - Added specific error detection for parameter errors (400 status with param field)
   - All error types throw appropriate custom error classes

3. **Updated Anthropic completion requests** in `src/ai/llmProviders.js`:
   - Added authentication error detection for Anthropic API
   - Checks for both 401 status and `authentication_error` type

4. **Enhanced error handling** in `src/ai/llmStrategicController.js`:
   - Imported `getProviderSettings` to check if API key is configured
   - Added `hasApiKey` check before showing any error notifications
   - When no API key is configured, errors are only logged to console (not shown to user)
   - Added separate catch handlers for:
     - `QuotaExceededError`: Shows quota exceeded message and disables LLM AI
     - `AuthenticationError`: Shows authentication failed message and disables LLM AI
     - `ApiParameterError`: Shows API error message and disables LLM AI
   - Applied to both strategic AI and commentary functions

### Behavior:

When API errors occur:
- ✅ **No API key configured**: Error logged to console only, no user notification
- ✅ **401 Authentication Error**: User sees "{Provider} authentication failed: {message}. LLM {Feature} disabled."
- ✅ **400 Parameter Error**: User sees "{Provider} API error: {message}"
- ✅ **Quota Exceeded**: User sees "{Provider} API quota exceeded. LLM {Feature} disabled, falling back to local AI only."
- ✅ All errors automatically disable the affected LLM feature and persist setting to localStorage
- ✅ Uses `max_completion_tokens` parameter for OpenAI API compatibility with newer models

### Files Modified:

- `src/ai/llmProviders.js`
- `src/ai/llmStrategicController.js`
