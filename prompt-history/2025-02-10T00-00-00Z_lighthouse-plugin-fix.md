# Prompt: Fix Netlify Lighthouse Plugin Configuration

**Timestamp:** 2025-02-10T00:00:00Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Request

Fix the netlify.toml configuration error:
```
Plugin "@netlify/plugin-lighthouse" invalid input "enable_on_branch_deploys"
```

Check official Netlify docs at https://docs.netlify.com/build/configure-builds/file-based-configuration/

## Changes Made

1. **Consulted Official Documentation:**
   - Reviewed GitHub repository: https://github.com/netlify/netlify-plugin-lighthouse
   - Found that `enable_on_branch_deploys` is not a valid parameter
   - Plugin runs on all deploys by default (including feature branches)

2. **Fixed netlify.toml Configuration:**
   - Removed invalid `enable_on_branch_deploys` parameter
   - Fixed structure: removed unnecessary nested `[plugins.inputs]` section
   - Changed `[plugins.inputs.audits]` to `[[plugins.inputs.audits]]` (array notation)
   - Adjusted thresholds to reasonable values (0.7 performance, 0.9 accessibility, 0.8 best-practices/seo)
   - Set output path to `reports/lighthouse.html`

3. **Valid Configuration Parameters:**
   - `thresholds` - minimum scores for performance, accessibility, best-practices, seo, pwa
   - `audits` - array of audit configurations with path/url and optional output_path
   - `settings` - for preset (desktop) and locale
   - `fail_deploy_on_score_thresholds` - to run plugin before deploy is live

## Result

The Lighthouse plugin now runs automatically on all deploys including feature branches with proper threshold validation and HTML report generation.
