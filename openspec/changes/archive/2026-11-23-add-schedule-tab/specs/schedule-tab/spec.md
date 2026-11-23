# schedule-tab Specification

## Purpose
Defines the Schedule tab of the agent dashboard: a list of scheduled jobs next to a calendar of the selected job's runs, with navigation, run previews, and job deletion.

## ADDED Requirements

### Requirement: Job list
The left pane of the Schedule tab SHALL list all jobs by title with, per job, the time and date of its last run, the outcome of that run, and the time and date of its next scheduled run. The outcome SHALL be shown as a check mark for success, a cross for failure, an animation while the run is in progress, and a question mark when the job has no run yet.

#### Scenario: Job columns
- **WHEN** jobs exist
- **THEN** each row shows title, last run date and time, an outcome symbol, and next run date and time

#### Scenario: Running job
- **WHEN** a job has a run in progress
- **THEN** its outcome symbol is an animation

#### Scenario: Never run
- **WHEN** a job has no runs
- **THEN** its row shows a question mark as the outcome symbol and no last run time

#### Scenario: Disabled job
- **WHEN** a job is disabled
- **THEN** its row is dimmed and its next run column reads "disabled"

#### Scenario: Empty list
- **WHEN** no jobs exist
- **THEN** the pane says so and mentions the key to add one

### Requirement: Pane focus
The Schedule tab SHALL have two panes, the job list on the left and the calendar on the right, and exactly one of them SHALL have focus at a time, shown visibly. Left/Right or `h`/`l` SHALL move focus between them. The list pane has focus when the tab opens. On small terminals the calendar pane SHALL be shown only when focused.

#### Scenario: Switch to calendar
- **WHEN** the list pane has focus and the user presses Right or `l`
- **THEN** the calendar pane has focus

#### Scenario: Switch back
- **WHEN** the calendar pane has focus and the user presses Left or `h`
- **THEN** the list pane has focus

### Requirement: Job list navigation
With the list pane focused, Up/Down and `k`/`j` SHALL move the selection, and PageUp/PageDown, `ctrl+u`/`ctrl+d`, Home/End, `gg` and `G` SHALL behave as on the Sessions tab. The calendar SHALL always show the selected job.

#### Scenario: Selection drives calendar
- **WHEN** the selection moves to another job
- **THEN** the calendar shows that job's runs and schedule

### Requirement: Month calendar
For a job that runs at most twice on every day shown, the calendar SHALL show weeks as rows of days. It SHALL start at the first week of the current month and continue through the week containing the month's last day; when today is in the month's first week it SHALL also show the last week of the previous month. Weeks SHALL start on Monday.

#### Scenario: Mid month
- **WHEN** today is in the third week of the month
- **THEN** the calendar shows weeks from the month's first week to the month's last week

#### Scenario: First week
- **WHEN** today is in the first week of the month
- **THEN** the last week of the previous month is shown above the month's weeks

#### Scenario: Today marked
- **WHEN** the calendar is shown
- **THEN** today's date is visibly marked

### Requirement: Run markers
Every execution of the selected job within the shown period SHALL be marked in its day with its time and status: a check mark for success, a cross for failure, an animation for in progress, and a star for a future scheduled execution. A past scheduled slot with no recorded run SHALL be shown with a question mark.

#### Scenario: Past and future
- **WHEN** the calendar shows days before and after now
- **THEN** past runs show their outcome symbol and future scheduled times show a star

#### Scenario: Missing run
- **WHEN** a past scheduled time has no recorded run
- **THEN** it is shown with a question mark

#### Scenario: Disabled job
- **WHEN** the selected job is disabled
- **THEN** past runs are shown but no future stars are shown

### Requirement: Frequency-based views
When the selected job runs more than twice on any shown day the calendar SHALL be replaced by a week view of the current week. When it runs more than four times per day, only a schedule of today SHALL be shown. The same markers apply in every view.

#### Scenario: Three runs a day
- **WHEN** the selected job runs three times per day
- **THEN** the current week is shown instead of the month

#### Scenario: Five runs a day
- **WHEN** the selected job runs five times per day
- **THEN** only today's schedule is shown

#### Scenario: Twice a day
- **WHEN** the selected job runs twice per day
- **THEN** the month calendar is shown

### Requirement: Stepping through runs
With the calendar pane focused, Up/Down and `k`/`j` SHALL move a run cursor through the job's past runs, starting at the most recent one. The cursor's run SHALL be highlighted. Up SHALL move to an older run and Down to a newer one, stopping at the ends.

#### Scenario: Start at last run
- **WHEN** the calendar pane gains focus and the job has past runs
- **THEN** the most recent past run is highlighted

#### Scenario: Older runs
- **WHEN** the user presses Up
- **THEN** the next older run is highlighted

### Requirement: Run preview and opening
With a run highlighted, Enter SHALL open a modal above the dashboard showing the linked session's recent messages in the same style as the Sessions tab preview. Pressing Enter again in that modal SHALL open the session in a new tab (or focus it if already open) and close the modal and the dashboard. Esc SHALL close only the modal. A run without a session SHALL show a message saying no session is available, and a second Enter SHALL do nothing.

#### Scenario: Preview
- **WHEN** a run with a session is highlighted and the user presses Enter
- **THEN** a modal shows that session's last messages

#### Scenario: Open session
- **WHEN** the preview modal is open and the user presses Enter
- **THEN** the session opens in a tab and both the modal and the dashboard close

#### Scenario: No session
- **WHEN** the highlighted run has no linked session
- **THEN** the modal says no session is available

### Requirement: Create, edit and archive jobs
With the list pane focused, `a` SHALL open the job editor for a new job, Enter SHALL open it for the selected job, and `dd` (two `d` presses within 600 ms) SHALL ask for confirmation and then archive the selected job. Enabling or disabling a job is done only in the editor. Archiving SHALL disable the job, stop all future runs of it and keep its recorded runs. Cancelling the confirmation SHALL leave the job unchanged.

#### Scenario: New job
- **WHEN** the user presses `a` on the list pane
- **THEN** the editor opens with default values

#### Scenario: Edit
- **WHEN** a job is selected and the user presses Enter
- **THEN** the editor opens with the job's values

#### Scenario: Disable in the editor
- **WHEN** the user turns the enabled setting off in the editor and saves
- **THEN** no further runs are started for the job

#### Scenario: No quick toggle
- **WHEN** the user presses `space` on the list pane
- **THEN** nothing changes

#### Scenario: Archive confirmed
- **WHEN** the user presses `dd` and confirms
- **THEN** the job leaves the list, moves to the archive, is disabled, and no more runs are started for it

#### Scenario: Archive cancelled
- **WHEN** the user presses `dd` and cancels
- **THEN** the job stays

### Requirement: Archive view
Pressing `A` (shift+a) on the Schedule tab SHALL toggle between the active jobs and the archive of archived jobs; pressing it again SHALL return. The archive view SHALL use the same two panes, list columns and calendar as the active view, read-only, and SHALL show that it is the archive. In the archive, Enter on the calendar previews runs as usual, `u` SHALL restore the selected job to the active list as disabled, and the keys `a` and Enter-to-edit SHALL do nothing.

#### Scenario: Open archive
- **WHEN** the user presses `A`
- **THEN** the archived jobs are listed with their calendar, marked as the archive

#### Scenario: Back to active
- **WHEN** the archive is shown and the user presses `A`
- **THEN** the active jobs are shown again

#### Scenario: Restore
- **WHEN** an archived job is selected and the user presses `u`
- **THEN** it returns to the active list, disabled, with its runs intact

#### Scenario: Empty archive
- **WHEN** there are no archived jobs
- **THEN** the archive says so

### Requirement: Permanent deletion from the archive
In the archive, `dd` SHALL ask for confirmation and then ask "Remove associated OpenCode sessions for this job?". Answering yes SHALL remove the sessions linked to the job's runs; answering no SHALL leave them as ordinary sessions. In both cases the job and its run records SHALL then be deleted permanently. Cancelling either question that precedes deletion SHALL change nothing.

#### Scenario: Delete and remove sessions
- **WHEN** the user presses `dd`, confirms, and answers yes to the sessions question
- **THEN** the job, its runs and their sessions are removed

#### Scenario: Delete and keep sessions
- **WHEN** the user confirms and answers no to the sessions question
- **THEN** the job and runs are removed and the sessions remain in the Sessions list

#### Scenario: Cancel
- **WHEN** the user cancels the confirmation
- **THEN** nothing is deleted

#### Scenario: Session removal fails
- **WHEN** removing a session fails
- **THEN** an error notification names the failure and the remaining deletion continues

### Requirement: Live updates
The Schedule tab SHALL update when runs start, finish, or jobs change, without the user reopening the dashboard.

#### Scenario: Run finishes
- **WHEN** a run finishes while the tab is open
- **THEN** its symbol in the list and the calendar changes to its outcome
