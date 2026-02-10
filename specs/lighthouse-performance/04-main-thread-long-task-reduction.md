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
