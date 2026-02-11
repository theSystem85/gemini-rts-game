# Spec 04 — Main-Thread and Long-Task Reduction

## Goal
Lower TBT and interactivity delay by reducing startup main-thread work.

## Why (from lighthouse report)
- `mainthread-work-breakdown`: **4.8s**.
- `bootup-time`: **1.9s** JS execution.
- `total-blocking-time`: **720ms**.

## Scope
- Move non-critical startup work out of the initial frame.
- Split heavy synchronous initialization into idle/deferred tasks.
- Evaluate worker offloading candidates for CPU-heavy non-UI logic.

## Implementation hints
- Use performance markers around initialization phases.
- Prioritize eliminating tasks >50ms.
- Keep gameplay determinism intact while deferring optional subsystems.

## Deliverables
- Refactored startup scheduler/init sequence.
- Notes describing deferred tasks and rationale.

## Acceptance criteria
- TBT reduced from baseline.
- Fewer long tasks in trace.
- No user-visible startup regressions.

## Validation
- `npm run build`
- `npm run lint:fix`
- Lighthouse/trace comparison for TBT + long-task counts.

## Implementation notes (2026-02)
- Added a startup scheduler utility that supports:
  - phase-level performance markers (`performance.mark/measure`)
  - post-paint deferrals (`requestAnimationFrame` + macrotask)
  - idle deferrals (`requestIdleCallback` with timeout fallback)
- Refactored startup sequencing to keep critical work synchronous (asset load, world setup, first loop start) while deferring non-critical initialization:
  - Deferred to next paint: map editor controls, tutorial setup, multiplayer sidebar wiring, AI party sync, auto-resume check
  - Deferred to idle: settings modal boot, benchmark button wiring, save-system registration, notification history panel prep
  - Deferred from entrypoint: remote invite landing and notification history to reduce DOMContentLoaded long-task pressure
- Added phase labels to support trace/Lighthouse comparisons for long-task attribution.

### Deferred tasks rationale
- **Tutorial + map editor controls**: not required for first interactive frame; safe after initial loop starts.
- **Multiplayer sidebar + AI sync**: optional during first paint and can initialize immediately after render without affecting determinism.
- **Save recovery + settings modal + benchmark wiring**: non-blocking enhancements with no impact on first-frame gameplay.
- **Notification history / remote invite landing**: secondary UI systems that can load asynchronously after interaction readiness.
