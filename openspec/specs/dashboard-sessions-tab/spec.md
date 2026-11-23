# dashboard-sessions-tab Specification

## Purpose
Defines the Sessions tab of the agent dashboard: a table of all root sessions with a message preview, folder-aware highlighting, keyboard navigation and jump-to-session.

## Requirements

### Requirement: Session list contents
The Sessions tab SHALL list all root sessions (sessions without a parent) across all folders, ordered by most recently updated first. Each entry SHALL show the session title, its date, and its shortened folder.

#### Scenario: Cross-folder listing
- **WHEN** sessions exist in several folders
- **THEN** all root sessions are listed, newest first

#### Scenario: Child sessions hidden
- **WHEN** a session has a parent session
- **THEN** it is not listed

#### Scenario: History included
- **WHEN** sessions exist that this TUI has not loaded yet
- **THEN** they are fetched from the server and listed too

### Requirement: Session limit
The list SHALL show at most the most recently updated N root sessions, where N is the `sessionLimit` plugin option. N SHALL default to 200, and an invalid value (not a positive number) SHALL fall back to the default. A fractional value SHALL be rounded down and N SHALL NOT exceed 5000.

#### Scenario: Default limit
- **WHEN** `sessionLimit` is not set and more than 200 root sessions exist
- **THEN** only the 200 most recently updated are listed

#### Scenario: Custom limit
- **WHEN** `sessionLimit` is set to 50
- **THEN** at most 50 sessions are listed

#### Scenario: Invalid limit
- **WHEN** `sessionLimit` is `0`, negative, or not a number
- **THEN** the default of 200 applies

### Requirement: Table layout
The session list SHALL be laid out as a table without separator lines, with a muted header row and the columns Title, Date and Folder. The selected row SHALL be marked and bold.

#### Scenario: Columns
- **WHEN** the Sessions tab is shown
- **THEN** a header row names the three columns and rows are aligned in them without separator lines

### Requirement: Column sizing and truncation
The Title column SHALL be as wide as the longest title but at most half the width of the list, and a title that does not fit SHALL be cut at the end with an ellipsis. The Date column SHALL have a fixed width. The Folder column SHALL be as wide as the longest folder label up to a maximum, and a label that does not fit SHALL be cut at the start with an ellipsis so the end of the path stays visible.

#### Scenario: Long title
- **WHEN** a title is wider than half the list
- **THEN** it is cut at the end and ends in an ellipsis

#### Scenario: Long folder
- **WHEN** a folder label is wider than the Folder column
- **THEN** it is cut at the start and begins with an ellipsis

#### Scenario: Short titles
- **WHEN** every title is shorter than half the list
- **THEN** the Title column is only as wide as the longest title

### Requirement: Folder label
The folder shown for a session SHALL be the last two path segments of its directory. For a worktree this reads `REPO/worktree-dir`; for a plain checkout it reads `parent-folder/REPO`.

#### Scenario: Worktree folder
- **WHEN** a session's directory is `/home/me/code/myrepo/ABC-12-fix`
- **THEN** the label is `myrepo/ABC-12-fix`

#### Scenario: Shallow path
- **WHEN** a session's directory has fewer than two segments
- **THEN** the label shows the available segments

### Requirement: Current-folder highlighting
Sessions whose directory matches the current OpenCode location SHALL be rendered in the active theme's accent color that is "foam" in the Rosé Pine theme. All other sessions SHALL use the theme's default text color.

#### Scenario: Matching folder
- **WHEN** a session's directory equals the current location directory
- **THEN** its entry uses the accent color

#### Scenario: Other folder
- **WHEN** a session's directory differs from the current location
- **THEN** its entry uses the default text color

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

### Requirement: Preview pane
On wide terminals the tab SHALL use two columns, with the session list on the left and a preview of the selected session's most recent messages on the right. The preview SHALL show user and assistant text only, truncated to fit, without role labels. On small terminals the preview pane SHALL NOT be shown and the list SHALL use the full width.

#### Scenario: Wide terminal
- **WHEN** the terminal is wider than the small-width threshold
- **THEN** the preview pane shows the last messages of the selected session and follows the selection

#### Scenario: Small terminal
- **WHEN** the terminal is at or below the small-width threshold
- **THEN** only the list is shown

#### Scenario: Preview loading
- **WHEN** messages for the selected session are not loaded yet
- **THEN** a loading state is shown and messages are fetched

### Requirement: Preview message styles
The preview pane SHALL use the darker theme background. Assistant messages SHALL be plain text on it, and user messages SHALL be in a lighter box with a vertical line on its left.

#### Scenario: Styles
- **WHEN** the preview shows a user message and an assistant message
- **THEN** the user message is in a lighter box with a left vertical line and the assistant message is plain text on the darker background

### Requirement: Opening a session
Pressing Enter on a selected session SHALL open it in a new tab, or focus its tab if it is already open, and then close the dashboard.

#### Scenario: Not yet open
- **WHEN** Enter is pressed on a session without an open tab
- **THEN** a tab for it is opened and focused and the dashboard closes

#### Scenario: Already open
- **WHEN** Enter is pressed on a session that already has a tab
- **THEN** that tab is focused and the dashboard closes

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
