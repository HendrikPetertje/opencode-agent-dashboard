# schedule-job-editor Specification

## Purpose
Defines the modal used to create and edit scheduled jobs: its fields, defaults, validation and the preview of upcoming executions.

## ADDED Requirements

### Requirement: Editor fields
The job editor SHALL open as a modal above the dashboard and SHALL contain: a single-line name; a folder, defaulting to the current working directory; an agent chosen from a list; a multi-line prompt; and a cron expression.

#### Scenario: New job defaults
- **WHEN** the editor opens for a new job
- **THEN** the folder is the current working directory

### Requirement: Run settings
The editor SHALL also contain: a model chosen from a list, defaulting to "agent default"; a maximum run time in minutes, defaulting to 30; an enabled setting, a toggle on by default and the only place a job is enabled or disabled; an auto-mode setting, shown only when auto-mode is available and enabled by default; and a sandbox setting (on or off), shown only when sandbox-mode is available.

#### Scenario: Defaults
- **WHEN** the editor opens for a new job
- **THEN** the model is "agent default", the maximum run time is 30 minutes, the job is enabled, and auto-mode (if available) is enabled

#### Scenario: Auto-mode unavailable
- **WHEN** auto-mode is not installed
- **THEN** the auto-mode field is not shown

#### Scenario: Sandbox unavailable
- **WHEN** sandbox-mode is not installed
- **THEN** the sandbox field is not shown

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

### Requirement: Keys belong to the editor
While the editor is open, key presses SHALL NOT trigger dashboard actions.

#### Scenario: Typing
- **WHEN** the user types `d`, `j` or `h` in a field
- **THEN** the character is entered and no dashboard action runs
