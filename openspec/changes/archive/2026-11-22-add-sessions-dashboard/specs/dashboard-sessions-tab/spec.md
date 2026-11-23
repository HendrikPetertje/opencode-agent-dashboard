## ADDED Requirements

### Requirement: Session list contents
The Sessions tab SHALL list all root sessions (sessions without a parent) across all folders, ordered by most recently updated first. Each entry SHALL show the session title, its date, and its shortened folder.

#### Scenario: Cross-folder listing
- **WHEN** sessions exist in several folders
- **THEN** all root sessions are listed, newest first

#### Scenario: Child sessions hidden
- **WHEN** a session has a parent session
- **THEN** it is not listed

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
The list SHALL be navigable with Up/Down arrows and with `k`/`j`. The selected entry SHALL be visibly marked and kept in view while scrolling.

#### Scenario: Vim motions
- **WHEN** the user presses `j`
- **THEN** the selection moves down one entry

#### Scenario: Scrolling
- **WHEN** the selection moves beyond the visible rows
- **THEN** the list scrolls to keep it visible

### Requirement: Preview pane
On wide terminals the tab SHALL use two columns, with the session list on the left and a preview of the selected session's most recent messages on the right. The preview SHALL show user and assistant text only, truncated to fit. On small terminals the preview pane SHALL NOT be shown and the list SHALL use the full width.

#### Scenario: Wide terminal
- **WHEN** the terminal is wider than the small-width threshold
- **THEN** the preview pane shows the last messages of the selected session and follows the selection

#### Scenario: Small terminal
- **WHEN** the terminal is at or below the small-width threshold
- **THEN** only the list is shown

#### Scenario: Preview loading
- **WHEN** messages for the selected session are not loaded yet
- **THEN** a loading state is shown and messages are fetched

### Requirement: Opening a session
Pressing Enter on a selected session SHALL open it in a new tab, or focus its tab if it is already open, and then close the dashboard.

#### Scenario: Not yet open
- **WHEN** Enter is pressed on a session without an open tab
- **THEN** a tab for it is opened and focused and the dashboard closes

#### Scenario: Already open
- **WHEN** Enter is pressed on a session that already has a tab
- **THEN** that tab is focused and the dashboard closes
