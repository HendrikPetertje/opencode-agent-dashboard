## MODIFIED Requirements

### Requirement: Dashboard tabs
The dashboard SHALL show two tabs, "Sessions" and "Schedule", with Sessions active when the modal opens. The user SHALL be able to switch tabs by click and by keyboard: `tab`/`shift+tab` and `1`/`2` on every tab, and additionally Left/Right (or `h`/`l`) on the Sessions tab. The `h`/`l` aliases SHALL NOT be listed in the legend. On the Schedule tab Left/Right and `h`/`l` switch between its two panes instead.

#### Scenario: Arrow keys
- **WHEN** the Sessions tab is active and the user presses Right or Left
- **THEN** the next or previous tab becomes active, wrapping around

#### Scenario: Vim motions
- **WHEN** the Sessions tab is active and the user presses `l` or `h`
- **THEN** the next or previous tab becomes active, like Right and Left

#### Scenario: Tab key on Schedule
- **WHEN** the Schedule tab is active and the user presses `tab`
- **THEN** the next tab becomes active

#### Scenario: Arrow keys on Schedule
- **WHEN** the Schedule tab is active and the user presses Left, Right, `h` or `l`
- **THEN** the pane focus changes and the tab stays the same

#### Scenario: Default tab
- **WHEN** the dashboard opens
- **THEN** the Sessions tab is active

#### Scenario: Schedule placeholder
- **WHEN** the user switches to the Schedule tab
- **THEN** the schedule view (job list and calendar) is shown; no placeholder remains
