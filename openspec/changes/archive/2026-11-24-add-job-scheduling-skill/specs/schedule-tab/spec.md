## ADDED Requirements

### Requirement: Agent tools toggle
The Schedule tab SHALL show, right-aligned below the lists, a toggle with a wrench icon reading `agent tools ON (t)` or `agent tools OFF (t)`, in the accent colour when on and muted when off. Pressing `t` or clicking it SHALL switch the agent tools setting and show the new value. The toggle SHALL reflect changes made by other TUIs.

#### Scenario: Off by default
- **WHEN** the user opens the Schedule tab for the first time
- **THEN** the footer shows `agent tools OFF (t)`

#### Scenario: Turning on
- **WHEN** the user presses `t` in the Schedule tab
- **THEN** the setting is switched on and the footer shows `agent tools ON (t)`
