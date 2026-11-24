## Purpose

Lets an agent in an interactive session read and change scheduled jobs through plugin tools, with the same rules and storage as the dashboard's job editor.

## ADDED Requirements

### Requirement: Tools off by default
The job tools SHALL only exist while the agent tools setting is on: with it off they SHALL be in no session's tool list or tool catalog, and turning it on or off SHALL be announced to sessions the same way as other tool changes. The setting SHALL be off until the user turns it on, SHALL be stored with the jobs so every OpenCode process follows it within seconds. A call while it is off SHALL change nothing and return a message saying where to turn it on.

#### Scenario: Default
- **WHEN** the user never turned the agent tools on
- **THEN** no session is offered the job tools

#### Scenario: Turned on
- **WHEN** the user turns the agent tools on
- **THEN** interactive sessions that are not sandboxed and not job runs are offered the job tools on their next request

#### Scenario: Turned off
- **WHEN** the user turns the agent tools off
- **THEN** the job tools disappear from every session's tool list and tool catalog, and sessions are told the tools are no longer available

#### Scenario: Called while off
- **WHEN** a job tool is called while the setting is off
- **THEN** no job is changed and the tool says the tools are off and can be turned on in the Schedule tab

### Requirement: List jobs tool
A tool SHALL return the scheduled jobs with every stored field and the status and time of each job's last run. By default it SHALL return only non-archived jobs; an option SHALL include archived jobs.

#### Scenario: Listing active jobs
- **WHEN** the agent calls the list tool without options
- **THEN** it gets every non-archived job with its fields and last run, and no archived job

#### Scenario: Including archived jobs
- **WHEN** the agent calls the list tool asking for archived jobs
- **THEN** archived jobs are included and marked as archived

### Requirement: Save job tool
A tool SHALL create a job when no ID is given and update the job with the given ID otherwise. It SHALL apply the same validation as the job editor (name, existing folder, agent, prompt, valid cron, maximum run time 1 to 1440 minutes) and SHALL return the saved job or the first validation error as text.

#### Scenario: Creating a job
- **WHEN** the agent calls the save tool with valid fields and no ID
- **THEN** a new job is stored and the tool returns it with its new ID

#### Scenario: Invalid input
- **WHEN** the agent calls the save tool with a folder that does not exist
- **THEN** nothing is stored and the tool returns the error "The folder does not exist"

#### Scenario: Updating an unknown job
- **WHEN** the agent calls the save tool with an ID that matches no job
- **THEN** nothing is stored and the tool returns an error naming the unknown ID

### Requirement: Partial update
When updating, fields the agent leaves out SHALL keep their stored values, so the agent can change one field without resending the rest.

#### Scenario: Changing only the cron
- **WHEN** the agent saves an existing job ID with only a new cron expression
- **THEN** the job gets the new cron and every other field is unchanged

### Requirement: Archive and restore tools
Tools SHALL archive and restore a job by ID with the same effect as in the Schedule tab: archiving disables the job and keeps its runs; restoring leaves it disabled. Permanent deletion SHALL NOT be offered as a tool.

#### Scenario: Archiving
- **WHEN** the agent archives a job
- **THEN** the job is archived, disabled, and no longer scheduled

#### Scenario: Restoring
- **WHEN** the agent restores an archived job
- **THEN** the job is no longer archived and is disabled

### Requirement: Dashboard stays in sync
A change made through the tools SHALL notify open dashboards in the same way as a change from the editor.

#### Scenario: Schedule tab open
- **WHEN** the agent creates a job while a dashboard shows the Schedule tab
- **THEN** the new job appears in the tab without reopening it

### Requirement: Tools hidden in job runs
The job tools SHALL NOT be available in the session of an active job run. After the run has ended the session SHALL get them like any interactive session.

#### Scenario: Headless run
- **WHEN** a scheduled job's session is running
- **THEN** none of the job tools are offered to its agent

#### Scenario: Normal session
- **WHEN** a user works in an ordinary interactive session while the agent tools are on
- **THEN** the job tools are offered

### Requirement: Tools unavailable under sandbox mode
The job tools SHALL NOT be available in a session whose directory has sandbox mode enabled, because a scheduled job runs with its own folder's settings and could escape the sandbox. The check SHALL be repeated when a tool executes, and a call from a sandboxed session SHALL change nothing and return an error. When sandbox mode cannot be determined, the tools SHALL be treated as unavailable only if the sandbox-mode plugin is loaded.

#### Scenario: Sandboxed session
- **WHEN** sandbox mode is enabled for the session's directory
- **THEN** none of the job tools are offered to the agent

#### Scenario: Sandbox turned on mid-session
- **WHEN** a tool is called after sandbox mode was enabled for the session's directory
- **THEN** no job is changed and the tool returns an error saying jobs cannot be scheduled from a sandboxed session

#### Scenario: Sandbox-mode plugin not installed
- **WHEN** the sandbox-mode plugin is not loaded
- **THEN** the tools follow the other visibility rules only

#### Scenario: Sandbox state unknown
- **WHEN** the sandbox-mode plugin is loaded but its state for the directory cannot be read
- **THEN** the tools are unavailable (fail closed)
