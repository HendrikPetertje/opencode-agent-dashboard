# schedule-job-editor Specification

## Purpose
Defines the modal used to create and edit scheduled jobs: its fields, defaults, validation and the preview of upcoming executions.

## Requirements

### Requirement: Editor fields
The job editor SHALL open as a modal above the dashboard and SHALL contain: a single-line name; a folder, defaulting to the current working directory; an agent chosen from a list; a multi-line prompt; and a cron expression.

#### Scenario: New job defaults
- **WHEN** the editor opens for a new job
- **THEN** the folder is the current working directory

### Requirement: Run settings
The editor SHALL also contain: a model chosen from a list, defaulting to "agent default"; a maximum run time in minutes, defaulting to 30; and an enabled setting, on by default. It SHALL NOT offer auto-mode or sandbox settings: a job runs with the auto-mode and sandbox state its folder already has.

#### Scenario: Defaults
- **WHEN** the editor opens for a new job
- **THEN** the model is "agent default", the maximum run time is 30 minutes, and the job is enabled

#### Scenario: No safeguard settings
- **WHEN** the editor is open
- **THEN** it has no auto-mode or sandbox field

### Requirement: Pickers for agent and model
The agent and model fields SHALL each show the current choice followed by a gray reminder to press ENTER. ENTER on the field SHALL open a modal over the editor with a text filter and a list of the available choices, showing how many match. Up/Down move the highlight, ENTER picks, and Esc closes only the picker, leaving the field unchanged and the editor open. The picker SHALL stay usable with about 50 models.

#### Scenario: Hint
- **WHEN** the editor is shown
- **THEN** the agent and model rows each end with a gray "press ENTER"

#### Scenario: Filtering
- **WHEN** the model picker is open and the user types "claude haiku"
- **THEN** only models whose name matches both terms are listed

#### Scenario: Picking
- **WHEN** the user highlights a model and presses ENTER
- **THEN** the picker closes and the model field shows that model

#### Scenario: Escape
- **WHEN** the picker is open and the user presses Esc
- **THEN** only the picker closes and the field keeps its value

#### Scenario: No match
- **WHEN** nothing matches the filter
- **THEN** the list says there is no match

### Requirement: Fuzzy filter
The picker's filter SHALL be case-insensitive and fuzzy: every space-separated term must match, a term may match as a substring or as characters in order that lie reasonably close together, and better matches (earlier, at word starts) SHALL be listed first.

#### Scenario: Scattered letters
- **WHEN** the user types "opus"
- **THEN** a model named "claude-opus-5" matches, and a name that merely contains those letters spread far apart does not

#### Scenario: Ranking
- **WHEN** several models match
- **THEN** the closest matches are listed first

### Requirement: Agent list
The agent field SHALL offer the agents available for the chosen folder, including agents defined in that folder's project, and SHALL refresh when the folder changes.

#### Scenario: Project agent
- **WHEN** the chosen folder's project defines an agent
- **THEN** that agent is selectable

#### Scenario: Folder change
- **WHEN** the user changes the folder
- **THEN** the agent list reflects the new folder, and a selected agent that no longer exists is cleared

### Requirement: Model and run time
The model field SHALL offer the models available for the chosen folder plus an "agent default" choice. The maximum run time SHALL be a whole number of minutes from 1 to 1440; other input SHALL be rejected when saving.

#### Scenario: Pick a model
- **WHEN** the user picks a model
- **THEN** runs of the job use that model

#### Scenario: Invalid minutes
- **WHEN** the user enters 0 or text as the maximum run time
- **THEN** saving is not allowed and the field is marked

### Requirement: Prompt input
The prompt field SHALL be a multi-line input. A new line SHALL be inserted with the key bound to `input.newline`, including any override in the user's `cli.json`.

#### Scenario: Default newline
- **WHEN** the user presses the configured newline key in the prompt
- **THEN** a new line is inserted and the form is not submitted

#### Scenario: Overridden newline
- **WHEN** the user has overridden `input.newline`
- **THEN** the overridden key inserts the newline

### Requirement: Cron input and preview
The cron field SHALL accept a standard five-field cron expression, interpreted in the local time zone. Below it the editor SHALL list the next three execution dates and times of the expression, updating as the user types, and SHALL show a message instead when the expression is invalid.

#### Scenario: Valid expression
- **WHEN** the user enters `0 9 * * 1-5`
- **THEN** the next three weekday 09:00 times are listed

#### Scenario: Invalid expression
- **WHEN** the expression cannot be parsed
- **THEN** an error message replaces the list and saving is not allowed

### Requirement: Saving and cancelling
The editor SHALL require a non-empty name, an existing folder, an agent, a non-empty prompt, a valid cron expression and a valid maximum run time before saving. Saving SHALL create or update the job and return to the dashboard with the job selected. Esc SHALL cancel without changes and return to the dashboard, which stays open.

#### Scenario: Missing field
- **WHEN** the user tries to save with an empty prompt
- **THEN** the editor stays open and points at the field

#### Scenario: Cancel
- **WHEN** the user presses Esc in the editor
- **THEN** the editor closes and the dashboard stays open unchanged

### Requirement: Moving between fields
`tab` and `shift+tab` SHALL move to the next and previous field, and Up and Down SHALL do the same on every field, including text fields and the choice rows. In the prompt, Up and Down SHALL first move the cursor between its lines and only leave the field when the cursor is already on the first or last line.

#### Scenario: Up and down on a text field
- **WHEN** the name field is focused and the user presses Down
- **THEN** the folder field is focused

#### Scenario: Prompt lines
- **WHEN** the prompt has three lines and the cursor is on the first one
- **THEN** Down moves the cursor to the second line, and the focus leaves the prompt only after the last line

### Requirement: Keys belong to the editor
While the editor is open, key presses SHALL NOT trigger dashboard actions.

#### Scenario: Typing
- **WHEN** the user types `d`, `j` or `h` in a field
- **THEN** the character is entered and no dashboard action runs
