# dashboard-modal Specification

## Purpose
Defines how the agent dashboard modal is opened, sized, tabbed and closed, so users get a consistent near-full-window overview above the regular OpenCode UI.

## Requirements

### Requirement: Dashboard entry points
The plugin SHALL open the dashboard modal from a `/dashboard` slash command, from a command palette entry, and from the `agent-dashboard.open` keybind, which defaults to `<leader>h` and can be overridden in `cli.json`. The plugin SHALL NOT add a button or icon to the UI.

#### Scenario: Slash command
- **WHEN** the user runs `/dashboard`
- **THEN** the dashboard modal opens

#### Scenario: Default keybind
- **WHEN** the user presses the leader key followed by `h`
- **THEN** the dashboard modal opens

#### Scenario: Overridden keybind
- **WHEN** `keybinds."agent-dashboard.open"` is set in `cli.json` and the user presses that binding
- **THEN** the dashboard modal opens

### Requirement: Modal overlay sizing
The dashboard SHALL render as an overlay above all other UI, centered, filling the terminal width and height minus a margin. The margin SHALL be 4 rows and 4 columns on each side on regular terminals, and 2 rows and 2 columns on each side on small terminals.

#### Scenario: Regular terminal
- **WHEN** the terminal is wider than the small-width threshold
- **THEN** the modal leaves 4 rows at the top, 4 at the bottom, 4 columns on the left and 4 on the right

#### Scenario: Small terminal
- **WHEN** the terminal width is at or below the small-width threshold
- **THEN** the modal leaves 2 rows and 2 columns on each side

#### Scenario: Inside a session
- **WHEN** the dashboard is opened while a session is shown
- **THEN** the modal's bottom edge sits one cell above the prompt input block, and its top margin is unchanged

#### Scenario: Resize while open
- **WHEN** the terminal is resized while the modal is open
- **THEN** the modal recomputes its size and margins without closing

### Requirement: Closing the dashboard
The dashboard SHALL close on Esc and when the close button in its top right corner is clicked. The close button SHALL be labelled `esc`.

#### Scenario: Close with Esc
- **WHEN** the dashboard is open and the user presses Esc
- **THEN** the modal closes and the previous UI regains input

#### Scenario: Close with button
- **WHEN** the user clicks the `esc` button in the top right of the modal
- **THEN** the modal closes

#### Scenario: Esc is not passed on
- **WHEN** the user closes the dashboard with Esc
- **THEN** the key press is not also handled by the prompt or other UI, so a running session is not interrupted

### Requirement: Input focus
While the dashboard is open, the prompt SHALL NOT show a text cursor or receive typed characters. When the dashboard closes, the prompt SHALL get its focus back.

#### Scenario: Prompt while open
- **WHEN** the dashboard is open
- **THEN** the prompt's blinking cursor is hidden and typed keys go to the dashboard

#### Scenario: Prompt after closing
- **WHEN** the dashboard closes without opening another session
- **THEN** the prompt can be typed in again

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

### Requirement: Modal layout
The modal SHALL have a rounded border around everything it shows, including the tab bar. Inside the border, from top to bottom: the tab bar (tabs on the left, the `esc` button on the right, each padded one column, on a darker strip with the active tab on the content background), one blank row, the active tab's content, and a one-line legend of the available keys. The area outside the border SHALL NOT be filled.

#### Scenario: Tabs inside the border
- **WHEN** the dashboard is open
- **THEN** the tab bar is inside the border and separated from the content by one blank row

#### Scenario: Legend
- **WHEN** the Sessions tab is active
- **THEN** the legend lists the keys for closing, switching tabs, moving, and opening a session

### Requirement: Theme usage
All dashboard colors SHALL come from the active OpenCode theme tokens, never from hard-coded values, with one exception: the translucent black backdrop scrim, which is not themed (as with OpenCode's own dialogs).

#### Scenario: Theme change
- **WHEN** the user switches OpenCode theme
- **THEN** the dashboard uses the new theme's colors

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
