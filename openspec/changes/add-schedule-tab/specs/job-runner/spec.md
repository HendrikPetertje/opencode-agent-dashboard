# job-runner Specification

## Purpose
Defines how scheduled jobs are started and supervised: cron timing, claiming a time slot when several OpenCode instances run, the background session that executes the job, the headless instructions, the `job-result` tool, failure rules and manual takeover.

## ADDED Requirements

### Requirement: Single scheduler per process
Exactly one scheduler SHALL run per OpenCode process, however many project locations load the plugin. It SHALL evaluate all enabled, non-archived jobs against the local time at least once per minute and start a run for each job whose cron expression matches the current minute.

#### Scenario: Due job
- **WHEN** a job's cron expression matches the current minute
- **THEN** a run for that time slot is started

#### Scenario: Disabled or archived
- **WHEN** a job is disabled or archived at its time slot
- **THEN** no run is started

#### Scenario: Several locations
- **WHEN** the plugin is loaded for three project locations in one process
- **THEN** a due job is still started only once by that process

### Requirement: Slot claim across instances
Before starting, a run SHALL record a claim for its job and time slot, wait 3 seconds, and then check all claims for that slot. Only the claim created first SHALL proceed. If claims were created at the same timestamp, the one whose ID sorts first alphabetically SHALL proceed. Every other claim SHALL be discarded without starting a session.

#### Scenario: Two instances
- **WHEN** two OpenCode instances claim the same job and slot
- **THEN** only the oldest claim starts a session and the other claim is removed

#### Scenario: Tied timestamps
- **WHEN** two claims have identical creation times
- **THEN** the claim with the alphabetically smaller ID proceeds

#### Scenario: Single instance
- **WHEN** only one claim exists after 3 seconds
- **THEN** the run starts

### Requirement: Overlapping runs
A job SHALL NOT start a new run while a previous run of the same job is still running; that time slot SHALL be skipped.

#### Scenario: Slow job
- **WHEN** a job's previous run is still running at its next time slot
- **THEN** no new run is started for that slot

### Requirement: Background session
A started run SHALL create a new OpenCode session in the job's folder, with the job's agent and model (the agent's own model when none is set), titled after the job, and link its ID to the run. The prompt SHALL be sent in the background without a client attached. The run SHALL have status `running` from the start of the session.

#### Scenario: Session linked
- **WHEN** a run starts
- **THEN** a session exists in the job's folder with the job's agent and its ID is stored on the run

#### Scenario: Chosen model
- **WHEN** the job has a model set
- **THEN** the session uses that model

#### Scenario: Missing folder or agent
- **WHEN** the folder or agent no longer exists
- **THEN** the run fails with a reason and no session is left running

### Requirement: Per-run auto-mode and sandbox
The job session SHALL carry the job's auto-mode and sandbox settings in its metadata, and the auto-mode and sandbox-mode plugins SHALL apply them to that session only.

#### Scenario: Auto-mode on
- **WHEN** the job has auto-mode enabled and auto-mode is installed
- **THEN** auto-mode reviews permission requests of the job session

#### Scenario: Sandbox off
- **WHEN** the job has the sandbox off
- **THEN** the job session's shell commands are not sandboxed

### Requirement: Headless instructions
While a run is active, the agent SHALL be told that it runs headless, cannot ask questions, and must work fully autonomously. It SHALL also be told to report the outcome with the `job-result` tool, that reporting stops the agent immediately, and that the report must therefore be the last thing it does.

#### Scenario: Instruction present
- **WHEN** an active job session makes a model request
- **THEN** the request includes the headless instructions, including that `job-result` stops the agent

### Requirement: job-result tool
A `job-result` tool SHALL exist only in sessions of a run with status `running`. It SHALL accept a result of `succeeded` or `failed` and a short message, record them on the run, set the run's finish time, end the run, and then stop the session at once, including its subagents and running shell commands. In every other session the tool SHALL NOT be offered.

#### Scenario: Success reported
- **WHEN** the agent calls `job-result` with `succeeded`
- **THEN** the run is marked succeeded with the message and a finish time, and the session is stopped

#### Scenario: Failure reported
- **WHEN** the agent calls `job-result` with `failed`
- **THEN** the run is marked failed with the message, and the session is stopped

#### Scenario: Other sessions
- **WHEN** a normal session lists its tools
- **THEN** `job-result` is not among them

### Requirement: Failing on permission trouble
In a running job session, a permission that ends as "ask" or "deny" after auto-mode and the rules have decided SHALL fail the run with the reason, interrupt the session and deny the request.

#### Scenario: Auto-mode unsure
- **WHEN** auto-mode escalates a request in a job session
- **THEN** the run is marked failed with a reason and the session is stopped

#### Scenario: Auto-mode denies
- **WHEN** auto-mode denies a request in a job session
- **THEN** the run is marked failed and the session is stopped

### Requirement: Finishing without a result
When a running job session becomes idle without the agent having called `job-result`, the runner SHALL send one message asking the agent to report with `job-result` as its last action. If the session becomes idle again without a result, the run SHALL be marked failed with a reason saying no result was reported.

#### Scenario: Reminder works
- **WHEN** the agent stops, receives the message and then calls `job-result`
- **THEN** the run ends with the reported result

#### Scenario: Still no result
- **WHEN** the agent stops again after the message without calling `job-result`
- **THEN** the run is failed with a "no result reported" reason

### Requirement: Time limit
A run SHALL be limited to the job's maximum run time, counted from the start of the session. When the limit passes while the run is still running, the runner SHALL interrupt the session so that the agent, its subagents and all running tool calls and shell commands are stopped. It SHALL then tell the agent that its time is up, that it has 5 minutes to clean up or stash its work, and that it must then call `job-result` with success or failure as its very last action, because that call stops it.

#### Scenario: Interrupt at the limit
- **WHEN** a run is still busy at its time limit
- **THEN** the agent, its subagents and running tool calls and shell commands are interrupted and the agent is told it has 5 minutes to clean up and report

#### Scenario: Agent cleans up and reports
- **WHEN** the agent cleans up and calls `job-result` within the 5 minutes
- **THEN** the run ends with the reported result and the session stops at once

#### Scenario: Finished in time
- **WHEN** the agent reported a result before the limit
- **THEN** no interruption or message happens

### Requirement: Time limit without a report
If the agent has not called `job-result` 5 minutes after the time-limit message, the run SHALL be marked failed with a reason saying it timed out and no result was reported, and the session SHALL be stopped.

#### Scenario: No report
- **WHEN** 5 minutes pass after the time-limit message without a result
- **THEN** the run is failed as timed out and the session is stopped

### Requirement: Manual takeover
After a run has ended, its session SHALL behave as an ordinary session: no headless instructions, no `job-result` tool, and permission requests prompt the user as usual. The user MAY continue the session to finish the job by hand, and this SHALL NOT change the run's recorded status.

#### Scenario: Continue a failed run
- **WHEN** the user opens a failed run's session and sends a message
- **THEN** the agent answers as in a normal session without the `job-result` tool

### Requirement: No catch-up
Time slots that passed while OpenCode was not running SHALL NOT be run afterwards.

#### Scenario: Restart
- **WHEN** OpenCode starts after being off during a job's time slot
- **THEN** the missed slot is not run
