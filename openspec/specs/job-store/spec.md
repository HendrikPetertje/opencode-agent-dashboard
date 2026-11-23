# job-store Specification

## Purpose
Defines how scheduled jobs and their runs are persisted: the database location, tables, identifiers and what is stored per run.

## Requirements

### Requirement: Database location
Jobs and runs SHALL be stored in a SQLite database file named `dashboard.db` in a folder `opencode-dashboard` under the user's state directory (`$XDG_STATE_HOME`, or `~/.local/state` when unset). The folder and database SHALL be created on first use, and several OpenCode processes SHALL be able to use the same database at once.

#### Scenario: First use
- **WHEN** the plugin starts and the database does not exist
- **THEN** the folder and database are created with both tables

#### Scenario: Concurrent processes
- **WHEN** two OpenCode processes write to the database at the same time
- **THEN** neither fails with a locking error

### Requirement: Jobs table
The database SHALL have a `jobs` table holding, per job: an ID, name, folder, agent, model (or none for the agent default), maximum run time in minutes, enabled flag, prompt, cron expression, an archived-at time (empty for active jobs), and created and updated times.

#### Scenario: Persisted job
- **WHEN** a job is saved and OpenCode restarts
- **THEN** the job is still listed with the same values

### Requirement: Archiving keeps data
Archiving a job SHALL set its archived-at time, disable it, and keep the job and all its runs. Restoring SHALL clear it and set the job disabled. Permanent deletion SHALL remove the job and, with it, its runs.

#### Scenario: Archive
- **WHEN** a job is archived
- **THEN** the job and its runs are still stored and the job is marked archived and disabled

#### Scenario: Restore
- **WHEN** an archived job is restored
- **THEN** it is active again and disabled

### Requirement: Job runs table
The database SHALL have a `job_runs` table holding, per run: a KSUID ID, the job ID, the scheduled time slot, a created-at time, started and finished times, a status (`claiming`, `running`, `succeeded`, `failed`), an optional reason, and an optional linked session ID. Runs of a permanently deleted job SHALL be removed with it.

#### Scenario: Run record
- **WHEN** a run finishes
- **THEN** its status, finish time, reason and session ID are stored

#### Scenario: Job deleted
- **WHEN** a job is permanently deleted
- **THEN** its runs are deleted too

### Requirement: Run identifiers
Run IDs SHALL be KSUIDs: 27 character strings that sort alphabetically in creation order and are unique across processes. Comparing two KSUIDs alphabetically SHALL give a deterministic order even when their timestamps are equal.

#### Scenario: Ordering
- **WHEN** two runs are created a second apart
- **THEN** the earlier run's ID sorts first alphabetically

#### Scenario: Uniqueness
- **WHEN** many IDs are generated in the same millisecond
- **THEN** they are all different

### Requirement: Single access path
The TUI SHALL NOT open the database itself; it SHALL read and change jobs and runs through the plugin's server part.

#### Scenario: UI edit
- **WHEN** the user saves a job in the TUI
- **THEN** the change is written by the server part and the TUI is notified
