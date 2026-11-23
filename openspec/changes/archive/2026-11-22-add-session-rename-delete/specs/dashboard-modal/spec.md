## ADDED Requirements

### Requirement: Backdrop scrim
While the dashboard is open it SHALL dim the whole UI behind it, including the sidebar and the area outside the modal's margins, with a translucent dark scrim, in the same way OpenCode's own dialogs dim the UI. The scrim SHALL be drawn below the modal and SHALL NOT dim the modal itself. The scrim SHALL disappear when the dashboard closes.

#### Scenario: Dimmed background
- **WHEN** the dashboard is open
- **THEN** everything outside the modal appears darker, including the margins and the sidebar

#### Scenario: Modal not dimmed
- **WHEN** the dashboard is open
- **THEN** the modal's own content is drawn at normal brightness

#### Scenario: Scrim removed
- **WHEN** the dashboard closes
- **THEN** the UI returns to normal brightness

### Requirement: Legend lists tab actions
The legend line SHALL list the keys that work on the active tab, including the session actions on the Sessions tab.

#### Scenario: Sessions legend
- **WHEN** the Sessions tab is active
- **THEN** the legend lists close, tab switching, move, open, delete and rename keys

## MODIFIED Requirements

### Requirement: Theme usage
All dashboard colors SHALL come from the active OpenCode theme tokens, never from hard-coded values, with one exception: the translucent black backdrop scrim, which is not themed (as with OpenCode's own dialogs).

#### Scenario: Theme change
- **WHEN** the user switches OpenCode theme
- **THEN** the dashboard uses the new theme's colors

### Requirement: Dashboard tabs
The dashboard SHALL show two tabs, "Sessions" and "Schedule", with Sessions active when the modal opens. The user SHALL be able to switch tabs by click and by keyboard: Left/Right arrows, `tab`/`shift+tab`, and `1`/`2`. The vim motions `h` and `l` SHALL work as aliases of Left and Right; they SHALL NOT be listed in the legend.

#### Scenario: Arrow keys
- **WHEN** the user presses Right or Left
- **THEN** the next or previous tab becomes active, wrapping around

#### Scenario: Vim motions
- **WHEN** the user presses `l` or `h`
- **THEN** the next or previous tab becomes active, like Right and Left

#### Scenario: Default tab
- **WHEN** the dashboard opens
- **THEN** the Sessions tab is active

#### Scenario: Schedule placeholder
- **WHEN** the user switches to the Schedule tab
- **THEN** a placeholder stating the schedule is not yet available is shown
