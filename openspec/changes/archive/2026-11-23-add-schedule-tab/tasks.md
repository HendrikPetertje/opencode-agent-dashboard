## 1. Foundations

- [x] 1.1 Verify which SQLite driver (`bun:sqlite` or `node:sqlite`) loads inside the OpenCode service plugin runtime; write `openDatabase` adapter (WAL, busy timeout, foreign keys, `user_version` migrations) with tests under Bun
- [x] 1.2 Add a KSUID library (`ksuid`) to the plugin dependencies, wrap it in `src/id.ts`, and test it (27 chars, ordering, same-millisecond uniqueness, tie order)
- [x] 1.3 Add `croner` to the plugin's dependencies and install it; verify it resolves from both the server and TUI parts at runtime; wrap it in `src/cron.ts` (`validate`, `nextRuns`, `runsBetween`, `matches`) with unit tests (validation messages, 5-field patterns, weekday ranges, runs per day)
- [x] 1.4 Calendar logic in `src/calendar.ts` (frequency view choice, Monday-start month weeks with previous-week rule, markers incl. `?` and future stars, run cursor helpers); unit tests

## 2. Store

- [x] 2.1 Schema and migrations for `jobs` (incl. model, timeout_minutes, enabled, archived_at) and `job_runs` in `$XDG_STATE_HOME/opencode-dashboard/dashboard.db` (default `~/.local/state`), cascade delete, index
- [x] 2.2 Store functions: list/save/delete jobs, create/update/list runs, claim query; tests with a temp database, including two connections writing concurrently

## 3. RPC

- [x] 3.1 `DashboardSchedule` RPC definition (`jobs.list({ archived })`, `job.save`, `job.archive`, `job.restore`, `job.sessions`, `job.purge`, `runs.list`, `changed` event) and server handlers; agents, models and plugin availability come from the TUI's own client, so no RPC for them
- [x] 3.2 Process-wide singleton guard for database and scheduler shared by all plugin instances

## 4. Runner

- [x] 4.1 Scheduler tick (15 s, minute slots, no catch-up, skip when a run of the job is running)
- [x] 4.2 Claim procedure with 3 second wait, oldest-wins and KSUID tie-break; tests with injected clock and two simulated instances
- [x] 4.3 Start a run: create the background session with agent, model and run/job metadata, store the session ID, send the prompt; fail with a reason when folder or agent is missing
- [x] 4.4 `permission.hook.evaluate` handler that fails and stops the run on ask/deny; verify hook order versus auto-mode (when auto-mode is on for the folder), fall back to `permission.asked` handling if needed
- [x] 4.5 `session.hook.context` handler: headless instructions for active runs, remove `job-result` for other sessions
- [x] 4.6 `job-result` tool (succeeded/failed + message) registered via `tool.transform`; after returning its result it stops the session (interrupt incl. subagents and shells); headless text says reporting stops the agent and must be last
- [x] 4.7 Event handling: idle without a result sends one reminder, a second idle fails the run; failed execution fails the run; restore the session map and timers from `running` rows at startup; emit `changed`
- [x] 4.8 Time limit: per-run timer; at expiry interrupt the session (agent, subagents, tool calls, shells), tell the agent it has 5 minutes to clean up or stash work and must then call `job-result` as its last action, and fail the run with "timed out, no result reported" (stopping the session) if nothing is reported within 5 minutes

- [x] 4.9 Continue runs after a restart: scan running runs at start, fail old or missing ones, re-track the rest with the remaining time, and tell idle sessions to continue; verify `session.wait` semantics with a real service restart

- [x] 4.10 Finish notifications: `finished` callback on every ended run, TUI presence and `finished` event with toast, OS notification (`osascript`/`notify-send`, arguments only) when no TUI is open, `osNotifications` option

## 5. Schedule tab UI

- [x] 5.1 Extract the Sessions tab message preview into a shared `MessagePreview`
- [x] 5.2 Schedule tab shell: two panes, pane focus with left/right and `h`/`l`, small-terminal behaviour, key handling changes on the Schedule tab (tab switching stays on `tab`/`shift+tab`/`1`/`2`)
- [x] 5.3 Job list: columns, outcome symbols with the running animation, selection and navigation keys
- [x] 5.4 Calendar: month, week and today views, markers, today highlight, run cursor with up/down starting at the latest run
- [x] 5.5 Run preview modal (Enter) with shared preview; second Enter opens the session in a tab and closes modal and dashboard; no-session message
- [x] 5.6 `dd` archive (which also disables) with confirmation, live updates from the RPC event; disabled rows dimmed with "disabled" next run, no future stars
- [x] 5.8 Archive view on `A`: same panes read-only, `u` restore, `dd` permanent delete with confirmation, the "Remove associated OpenCode sessions for this job?" question, session removal via the client with collected errors, then `job.purge`
- [x] 5.7 Legend for the Schedule tab and README updates

## 6. Job editor

- [x] 6.1 Editor modal with name, folder (default cwd), agent list for the folder, model list (default agent default), maximum run time (default 30, 1 to 1440), enabled, multi-line prompt with `input.newline` handling, cron field
- [x] 6.2 Cron preview of the next three runs and validation messages; save validation and `ctrl+s`/Esc behaviour
- [x] 6.3 Open from `a` (new) and Enter (edit); keys suspended while open

- [x] 6.4 Agent and model pickers: a modal on ENTER with a fuzzy filter (`src/fuzzy.ts`), gray "press ENTER" hints, Esc closes only the picker

- [x] 6.5 Up/down move between fields on every field (prompt: through its lines first)

## 7. Wrap-up

- [x] 7.1 Keep the plugin after auto-mode in `opencode.jsonc` and document requirements in the README (jobs inherit the folder's auto-mode and sandbox state)
- [x] 7.2 Manual check: create a job running every minute, watch claim and run, use `job-result`, force a permission ask to see the failure, set a 1 minute limit to see the interrupt and question, see the toast with a TUI open and the system notification with all TUIs closed, open the failed session, edit, disable, archive, restore and permanently delete a job (both session answers), check the week and today views with 3 and 5 runs per day
- [x] 7.3 Validate the change with `openspec validate add-schedule-tab`

<!-- 4.4, 4.9 and 7.2 were closed by the user's decision. Checked live: a job runs and succeeds, the editor and calendar work, an agent that declines a task reports it. Not checked live: permission hook order versus auto-mode, a real service restart, the failure and time-limit paths, system notification with no TUI open (a notification was seen with a TUI open; logging was added to find out why). -->
