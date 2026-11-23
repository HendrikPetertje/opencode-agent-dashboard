## 1. Foundations

- [ ] 1.1 Verify which SQLite driver (`bun:sqlite` or `node:sqlite`) loads inside the OpenCode service plugin runtime; write `openDatabase` adapter (WAL, busy timeout, foreign keys, `user_version` migrations) with tests under Bun
- [ ] 1.2 Add a KSUID library (`ksuid`) to the plugin dependencies, wrap it in `src/id.ts`, and test it (27 chars, ordering, same-millisecond uniqueness, tie order)
- [ ] 1.3 Add `croner` to the plugin's dependencies and install it; verify it resolves from both the server and TUI parts at runtime; wrap it in `src/cron.ts` (`validate`, `nextRuns`, `runsBetween`, `matches`) with unit tests (validation messages, 5-field patterns, weekday ranges, runs per day)
- [ ] 1.4 Calendar logic in `src/calendar.ts` (frequency view choice, Monday-start month weeks with previous-week rule, markers incl. `?` and future stars, run cursor helpers); unit tests

## 2. Store

- [ ] 2.1 Schema and migrations for `jobs` (incl. model, timeout_minutes, enabled, archived_at) and `job_runs` in `$XDG_STATE_HOME/opencode-dashboard/dashboard.db` (default `~/.local/state`), cascade delete, index
- [ ] 2.2 Store functions: list/save/delete jobs, create/update/list runs, claim query; tests with a temp database, including two connections writing concurrently

## 3. RPC

- [ ] 3.1 `DashboardSchedule` RPC definition (`jobs.list({ archived })`, `job.save`, `job.archive`, `job.restore`, `job.sessions`, `job.purge`, `runs.list`, `agents.list`, `availability`, `changed` event) and server handlers
- [ ] 3.2 Process-wide singleton guard for database and scheduler shared by all plugin instances

## 4. Runner

- [ ] 4.1 Scheduler tick (15 s, minute slots, no catch-up, skip when a run of the job is running)
- [ ] 4.2 Claim procedure with 3 second wait, oldest-wins and KSUID tie-break; tests with injected clock and two simulated instances
- [ ] 4.3 Start a run: create the background session with agent, model and metadata, store the session ID, send the prompt; fail with a reason when folder or agent is missing
- [ ] 4.4 `permission.hook.evaluate` handler that fails and stops the run on ask/deny; verify hook order versus auto-mode, fall back to `permission.asked` handling if needed
- [ ] 4.5 `session.hook.context` handler: headless instructions for active runs, remove `job-result` for other sessions
- [ ] 4.6 `job-result` tool (succeeded/failed + message) registered via `tool.transform`; after returning its result it stops the session (interrupt incl. subagents and shells); headless text says reporting stops the agent and must be last
- [ ] 4.7 Event handling: idle without a result sends one reminder, a second idle fails the run; failed execution fails the run; restore the session map and timers from `running` rows at startup; emit `changed`
- [ ] 4.8 Time limit: per-run timer; at expiry interrupt the session (agent, subagents, tool calls, shells), tell the agent it has 5 minutes to clean up or stash work and must then call `job-result` as its last action, and fail the run with "timed out, no result reported" (stopping the session) if nothing is reported within 5 minutes

## 5. Schedule tab UI

- [ ] 5.1 Extract the Sessions tab message preview into a shared `MessagePreview`
- [ ] 5.2 Schedule tab shell: two panes, pane focus with left/right and `h`/`l`, small-terminal behaviour, key handling changes on the Schedule tab (tab switching stays on `tab`/`shift+tab`/`1`/`2`)
- [ ] 5.3 Job list: columns, outcome symbols with the running animation, selection and navigation keys
- [ ] 5.4 Calendar: month, week and today views, markers, today highlight, run cursor with up/down starting at the latest run
- [ ] 5.5 Run preview modal (Enter) with shared preview; second Enter opens the session in a tab and closes modal and dashboard; no-session message
- [ ] 5.6 `dd` archive (which also disables) with confirmation, live updates from the RPC event; disabled rows dimmed with "disabled" next run, no future stars
- [ ] 5.8 Archive view on `A`: same panes read-only, `u` restore, `dd` permanent delete with confirmation, the "Remove associated OpenCode sessions for this job?" question, session removal via the client with collected errors, then `job.purge`
- [ ] 5.7 Legend for the Schedule tab and README updates

## 6. Job editor

- [ ] 6.1 Editor modal with name, folder (default cwd), agent list for the folder, model list (default agent default), maximum run time (default 30, 1 to 1440), enabled, auto-mode and sandbox rows when available, multi-line prompt with `input.newline` handling, cron field
- [ ] 6.2 Cron preview of the next three runs and validation messages; save validation and `ctrl+s`/Esc behaviour
- [ ] 6.3 Open from `a` (new) and Enter (edit); keys suspended while open

## 7. Other plugins

- [ ] 7.1 auto-mode: honour `metadata.dashboardJob.autoMode` for the session
- [ ] 7.2 sandbox-mode: per-session override from `metadata.dashboardJob.sandbox`, consulted before the project setting

## 8. Wrap-up

- [ ] 8.1 Add the plugin after auto-mode in `opencode.jsonc` (already the case) and document requirements in the README
- [ ] 8.2 Manual check: create a job running every minute, watch claim and run, use `job-result`, force a permission ask to see the failure, set a 1 minute limit to see the interrupt and question, open the failed session, edit, disable, archive, restore and permanently delete a job (both session answers), check the week and today views with 3 and 5 runs per day
- [ ] 8.3 Validate the change with `openspec validate add-schedule-tab`
