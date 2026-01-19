2026-01-19T13-00-00Z
copilot

Fix tutorial step 12 completion when using remote control. The step should unlock after the user uses remote control on a tank, but currently it only checks remoteControlActive which resets when keys are released. Need to add a persistent flag hasUsedRemoteControl to units and update the completion logic.