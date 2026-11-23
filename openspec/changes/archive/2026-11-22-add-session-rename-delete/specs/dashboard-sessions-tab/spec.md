## ADDED Requirements

### Requirement: Delete selected session
On the Sessions tab, pressing `d` twice in quick succession (within 600 ms) SHALL open a confirmation dialog above the dashboard that names the selected session and says the deletion is permanent. Only confirming SHALL delete the session; cancelling or pressing Esc SHALL leave it unchanged and return to the dashboard, which stays open. A single `d` press SHALL do nothing.

#### Scenario: Confirm deletes
- **WHEN** a session is selected, the user presses `d` twice within 600 ms and confirms the dialog
- **THEN** the session is deleted and disappears from the list

#### Scenario: Cancel keeps the session
- **WHEN** the user presses `dd` and then cancels the dialog or presses Esc
- **THEN** the session stays in the list and the dashboard stays open

#### Scenario: Single press does nothing
- **WHEN** the user presses `d` once and waits longer than 600 ms
- **THEN** no dialog opens and nothing is deleted

#### Scenario: Keys go to the dialog
- **WHEN** the confirmation dialog is open
- **THEN** key presses do not trigger dashboard actions

#### Scenario: Empty list
- **WHEN** the list is empty and the user presses `dd`
- **THEN** nothing happens

### Requirement: Result of a deletion
After a confirmed deletion the selection SHALL move to the neighbouring session. If the deletion fails, an error notification SHALL be shown and the list SHALL stay unchanged.

#### Scenario: Selection moves
- **WHEN** a session is deleted
- **THEN** the next session (or the previous one, for the last row) is selected

#### Scenario: Delete fails
- **WHEN** the user confirms and the server rejects the deletion
- **THEN** an error notification is shown and the session stays in the list

### Requirement: Rename selected session
On the Sessions tab, pressing `r` SHALL open a minimal text prompt above the dashboard, pre-filled with the selected session's title. Confirming a non-empty, changed title SHALL rename the session and update the list. Cancelling the prompt, or confirming an empty or unchanged title, SHALL leave the session unchanged. Closing the prompt SHALL return to the dashboard with the same selection and SHALL NOT close the dashboard.

#### Scenario: Rename
- **WHEN** the user presses `r`, edits the title and confirms
- **THEN** the session shows the new title in the list and the dashboard stays open with the session still selected

#### Scenario: Cancel
- **WHEN** the user presses Esc in the rename prompt
- **THEN** only the prompt closes; the title is unchanged and the dashboard stays open

#### Scenario: Empty title
- **WHEN** the user confirms an empty title
- **THEN** the session keeps its old title

#### Scenario: Keys go to the prompt
- **WHEN** the rename prompt is open
- **THEN** typed characters (including `j`, `k`, `d` and `r`) edit the title and do not trigger dashboard actions

#### Scenario: Rename fails
- **WHEN** the server rejects the rename
- **THEN** an error notification is shown and the old title stays

### Requirement: Session action keys in the legend
The Sessions tab legend SHALL list the delete and rename keys next to the existing ones.

#### Scenario: Legend
- **WHEN** the Sessions tab is active
- **THEN** the legend also lists `dd` for delete and `r` for rename

## MODIFIED Requirements

### Requirement: List navigation
The list SHALL be navigable with Up/Down arrows and with `k`/`j`. It SHALL also support paging with PageDown/PageUp and `ctrl+d`/`ctrl+u` (one visible page, less one row), and jumping to the first or last entry with Home/End, `gg` (two `g` presses within 600 ms) and `G` (`shift+g`). The paging and jump keys SHALL NOT be listed in the legend. The selected entry SHALL be visibly marked and kept in view while scrolling.

#### Scenario: Vim motions
- **WHEN** the user presses `j`
- **THEN** the selection moves down one entry

#### Scenario: Paging
- **WHEN** the user presses PageDown or `ctrl+d`
- **THEN** the selection moves down one page, stopping at the last entry

#### Scenario: Jump to the ends
- **WHEN** the user presses `G` or End
- **THEN** the last entry is selected

#### Scenario: Jump to the top
- **WHEN** the user presses `g` twice within 600 ms, or Home
- **THEN** the first entry is selected

#### Scenario: Single g
- **WHEN** the user presses `g` once
- **THEN** the selection does not change

#### Scenario: Scrolling
- **WHEN** the selection moves beyond the visible rows
- **THEN** the list scrolls to keep it visible
