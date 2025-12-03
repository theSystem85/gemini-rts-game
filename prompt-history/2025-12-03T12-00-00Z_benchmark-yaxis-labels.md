# Prompt History Entry

**UTC Timestamp:** 2025-12-03T12:00:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Prompt

look at the labeling of the y axsis. It looks like the labels are cropped

## Context

User provided a screenshot of the Performance Benchmark dialog showing FPS chart with y-axis labels being cropped (only partial numbers visible like "0 FPS", "4 FPS", "8 FPS" instead of "120 FPS", "80 FPS", etc.)

## Analysis

The issue is in `src/ui/benchmarkModal.js` in the `drawBenchmarkChart` function. The left margin is set to 40 pixels, but the y-axis labels include "FPS" suffix making them too wide. Labels are drawn at `margin.left - 6` which doesn't provide enough space for the full label text.

## Solution

Increase the left margin from 40 to 55 pixels to accommodate longer labels like "120 FPS".
