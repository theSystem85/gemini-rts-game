2026-02-01T16-19-43Z
LLM: copilot

User request: Fix failing Playwright basicGameFlow test; explain why money locator fails and implement test adjustments to dismiss tutorial/benchmark overlays and target the correct money display.

Notes:
- Money displayed in `#moneyText`/`#mobileMoneyValue`, not `#money`.
- Tutorial and benchmark modals can block UI; need to skip/close before interacting.
- Update TODO and spec accordingly.
