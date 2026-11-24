## Purpose

A skill that guides an interactive agent through creating, editing, archiving or restoring a scheduled job by asking the user questions, and optionally writing auto-mode instructions for the job's folder.

## ADDED Requirements

### Requirement: Skill shipped and installed
The repository SHALL contain the skill `schedule-job`. Installing the plugin SHALL make it available as `~/.config/opencode/skill/schedule-job` through a symbolic link to the repository copy, both from this repository and from the OpenCode config's `build.sh`. Installing twice SHALL leave one correct link.

#### Scenario: Fresh install
- **WHEN** the install step runs and no link exists
- **THEN** `~/.config/opencode/skill/schedule-job` links to the skill folder in this repository

#### Scenario: Something else in the way
- **WHEN** the target exists and is not a link to this repository's skill
- **THEN** the install step leaves it untouched and reports it

### Requirement: Question round for a new job
For a new job the skill SHALL make the agent collect, with the question tool, the name, folder (default: the current directory), agent, model (or the agent's default), schedule, maximum run time (default 30 minutes), whether the job starts enabled, and the job prompt. Choices SHALL be offered as options where a known set exists (agents, models, common schedules).

#### Scenario: Schedule in plain words
- **WHEN** the user picks or describes a schedule such as "every weekday at 9"
- **THEN** the agent turns it into a cron expression and shows both before saving

### Requirement: Job prompt drafted for headless runs
The skill SHALL make the agent draft the job prompt from the user's goal, written so it can run without asking questions, and show the draft for approval or changes before saving.

#### Scenario: User edits the draft
- **WHEN** the user asks for a change to the drafted prompt
- **THEN** the agent revises it and asks again before saving

### Requirement: Confirm before changing
The skill SHALL make the agent show a summary of all fields and get explicit confirmation before it creates, updates, archives or restores a job.

#### Scenario: User declines
- **WHEN** the user does not confirm the summary
- **THEN** no job is created or changed

### Requirement: Editing an existing job
The skill SHALL let the user pick an existing job, choose which fields to change, and save only those, and SHALL offer archiving and restoring.

#### Scenario: Change the model only
- **WHEN** the user picks a job and changes only its model
- **THEN** only the model is updated

### Requirement: Optional auto-mode instructions
The skill SHALL offer to write `AUTO_MODE_INSTRUCTIONS.md` in the job folder's `.opencode/` directory with rules that let auto-mode allow what the job needs headless. It SHALL show the content for approval. If the file exists, the agent SHALL ask whether to append, replace or skip, and SHALL NOT overwrite it without that answer.

#### Scenario: User skips
- **WHEN** the user declines auto-mode instructions
- **THEN** no file is written

#### Scenario: File already present
- **WHEN** `<folder>/.opencode/AUTO_MODE_INSTRUCTIONS.md` already exists
- **THEN** the agent shows it and asks append, replace or skip before writing
