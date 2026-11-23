# Design

## Context

The plugin has a TUI part (`tui.tsx`, the dashboard overlay, Sessions tab) and a trivial server part (`index.ts`) that already serves options over RPC (`rpc.ts`). Facts relevant here, read from the installed plugin API and the sibling plugins:

- The server part's context offers `session.create/prompt/interrupt/wait/get/update`, `session.hook` (including `context`, which can edit the system parts and the tool list of a model request), `permission.hook.evaluate`, `tool.transform`, `event.subscribe`, `rpc.register`, `plugin.list`, `storage`. `session.create` accepts `agent`, `location.directory`, `title`, `metadata`, `permissions`.
- The server part is instantiated once per project location, so several instances can exist in one process; OpenCode may also run as several processes.
- `auto-mode` keeps its on/off state per root session and reviews permissions in a `permission.hook.evaluate`. `sandbox-mode` keeps its setting per project folder, not per session.
- The TUI reaches server state only through RPC (`context.client.rpc(Definition)`), and receives live updates through RPC events.
- The TUI already has native dialog helpers (`dialog.prompt/confirm/select/show`) that draw above the dashboard overlay, and a message preview renderer for the Sessions tab.

See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Reliable recurring execution of jobs in background sessions, safe against several OpenCode instances.
- A Schedule tab that mirrors the Sessions tab's look and keys.
- Everything the user needs to take over a failed or stuck run.

**Non-Goals:**
- Running slots missed while OpenCode was off, retries, notifications, editing or deleting individual runs.
- Time zones other than the process's local one.
- Running jobs when no OpenCode process is running.
- Restoring individual runs; run retries.

## Decisions

**Server part owns everything stateful; one process-wide singleton.** Database access, the cron scheduler, and the run supervisor live in the server part. Each plugin instance registers the RPC handlers, but a guard on `globalThis` (a symbol key) makes the first instance create the database connection and scheduler; later instances reuse them, and the scheduler is stopped by the last cleanup. Alternative: a scheduler per instance relying only on the claim check (works, but multiplies work and DB writes by the number of locations).

**RPC contract.** A new `DashboardSchedule` definition: `jobs.list`, `job.save`, `job.delete`, `runs.list({ jobID, from, to })`, `agents.list({ directory })`, `availability` (auto-mode / sandbox-mode installed, via `plugin.list`), plus a `changed` event emitted after every mutation and run state change. The TUI never opens SQLite (job-store spec, "Single access path").

**SQLite driver behind a tiny adapter.** The service is a Bun-compiled binary, so `bun:sqlite` is expected to work; `node:sqlite` is the fallback. An `openDatabase(path)` adapter exposes `run/all/get/transaction`, sets `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`, and migrates with `PRAGMA user_version`. Verifying which driver loads inside OpenCode is the first task; unit tests run under Bun in a container. Alternatives: a dependency such as better-sqlite3 (native build, install problems).

**Schema.** `jobs(id TEXT PK, name, folder, agent, model TEXT NULL /* providerID/modelID, null = agent default */, timeout_minutes INTEGER DEFAULT 30, enabled INTEGER DEFAULT 1, archived_at INTEGER NULL, auto_mode INTEGER, sandbox INTEGER, prompt, cron, created_at, updated_at)`; `job_runs(id TEXT PK /* ksuid */, job_id REFERENCES jobs ON DELETE CASCADE, scheduled_for INTEGER, created_at INTEGER, started_at, finished_at, status, reason, session_id)` with an index on `(job_id, scheduled_for)`. Times are epoch milliseconds. Job IDs are KSUIDs too.

**KSUID via a library.** Run IDs (and job IDs) use an existing KSUID package (the `ksuid` npm package: `KSUID.randomSync().string`, 27 base62 characters, timestamp-prefixed so string order equals creation order). A thin `src/id.ts` wraps it so the import is in one place; unit tests check length, ordering and same-millisecond uniqueness. The package is installed next to `croner`; if it does not resolve in the runtime, the fallback is a short own implementation (4-byte timestamp + 16 random bytes, base62).

**Cron with `croner`.** The `croner` library (zero dependencies, TypeScript typings, works in Bun and Node; 5-field patterns by default) parses and evaluates expressions: `new Cron(pattern, { timezone: undefined /* local */ })` for validation (it throws on an invalid pattern), `.nextRuns(n, from)` for the editor preview and the calendar's future stars, `.previousRuns` / `.match(date)` for slot matching, and `.enumerate()` for counting runs per day. A thin `src/cron.ts` wraps it (`validate`, `nextRuns`, `runsBetween`, `matches`) so the rest of the code never touches the library directly, and so the `croner` import is in one place. Both the server and the TUI import it, so `croner` must resolve from the plugin folder (it is added to `dependencies` and installed with `bun install`/`npm install` there; node_modules is git-ignored). Resolution at runtime is verified in task 1.3. Alternatives: a hand-written parser (rejected: reinventing a well-tested wheel), `cron-parser` (also fine, heavier). DST follows croner's documented rules.

**Scheduler tick and claims.** A timer every 15 s computes the minute slots between the last tick and now (so a slow tick does not lose a slot), and for each job whose cron matches a slot, not yet handled in this process and with no running run, starts the claim procedure: insert a `claiming` run with `scheduled_for = slot`; wait 3 s; read all runs for `(job_id, scheduled_for)` ordered by `created_at, id`; if the own run is not first, delete it and stop; otherwise set `running` and start the session. This implements the tie-break on equal timestamps via the KSUID order. Slots older than one minute at startup are dropped (no catch-up).

**Session start.** `session.create({ title: job.name, agent, model (when set), location: { directory: folder }, metadata: { dashboardJob: { runID, jobID, autoMode, sandbox } } })`, store the session ID on the run, then `session.prompt({ sessionID, text: job.prompt })`. If the folder or agent is gone, the run fails with a reason before a session exists.

**Headless text and the `job-result` tool.** The tool is registered once through `tool.transform`. A `session.hook.context` handler, for each model request, checks an in-memory map `sessionID -> runID` (rebuilt from `running` rows at startup): for an active run it appends the headless instructions to `system`; for every other session it deletes `job-result` from `tools`. Because the map entry disappears when a run ends, a taken-over session automatically loses both (manual-takeover requirement). The tool's `execute` validates that its session has an active run, writes the result and finish time, clears the map entry and timers, and then schedules `session.interrupt` for that session right after the tool result has been returned (so the agent, its subagents and running shell commands stop at once). The headless instructions tell the agent that calling `job-result` stops it immediately and must be its last action.

**Failure rules.** (1) A `permission.hook.evaluate` handler, for sessions with an active run, turns any `effect` of `ask` or `deny` into a failed run: set the run `failed` with the reason (action and resources), call `session.interrupt`, and force `effect = "deny"`. It must run after auto-mode's hook; the plugin is listed after auto-mode in `opencode.jsonc`, and whether hook order follows plugin order is verified early (task 4.4). (2) An event subscription watches the job session: when it becomes idle without a reported result the runner sends one reminder prompt ("you stopped without calling job-result; did you finish? report now"); a second idle without a result fails the run with "no result reported". A failed execution fails the run with the error text. (3) A per-run timer set from the job's `timeout_minutes` handles the time limit: on expiry, if the run is still `running`, call `session.interrupt` (stops the agent, its subagents and running tool calls; background shell processes the session left behind are stopped through the shell domain), then send the message "Your time for this job is up. You have 5 minutes to clean up or stash your work. Then call job-result with succeeded or failed as your very last action; that call stops you." and start a 5 minute grace timer. If the agent calls `job-result` the normal report path runs (result stored, session stopped). If the grace timer expires, the run is failed with "timed out, no result reported" and the session is interrupted. The tool and headless instructions stay available during the grace period because the run is still `running`. The idle reminder (2) uses the same wording about reporting last.

**Cross-plugin settings via session metadata.** The job session carries `metadata.dashboardJob`. `auto-mode`, when it first sees a root session with that metadata, sets that session's state to the job's `autoMode`. `sandbox-mode` keeps a per-session override consulted before the project setting (true forces the sandbox on with the project's settings, false forces it off). This avoids RPC coupling between plugins; each plugin reads `session.get(sessionID).metadata`. These changes live in the two other repositories (tasks 7.x) and are optional at runtime: if a plugin lacks the change, the job simply runs with that plugin's normal behaviour.

**Calendar logic is pure.** `src/calendar.ts` has `frequencyView(runsPerDay)` (month / week / today), `monthWeeks(today)` (Monday-start rows, previous week prepended when today is in the first week), `markersFor(day, runs, cronSlots, now)` (past slots without run records become `?`, only after the job's `created_at`), and navigation helpers for the run cursor. All unit-tested. Per-day run counts come from `runsBetween` over the period shown.

**TUI structure.** `tui.tsx` is split: the Sessions tab stays; the Schedule tab goes in `src/schedule/` (`ScheduleTab`, `JobList`, `Calendar`, `RunPreview`). The message preview from the Sessions tab becomes a shared `MessagePreview` component used by both the pane and the run-preview modal. Pane focus and the `a`/`dd`/`enter` keys follow the Sessions tab pattern (layer in the dashboard's input mode; `prompting` signal suspends it while a dialog is open).

**Archive and permanent deletion.** `dd` in the active view calls `job.archive` (sets `archived_at` and `enabled = 0`); `jobs.list({ archived })` returns one set or the other; `job.restore` clears `archived_at` and sets `enabled = 0`; Enabling and disabling go through `job.save` from the editor only (no quick-toggle key, to avoid accidental presses). Permanent deletion is a TUI flow: confirm, then ask "Remove associated OpenCode sessions for this job?"; if yes, the TUI asks the server for the job's run session IDs (`job.sessions`), removes each with `client.session.remove` (errors are collected and shown as one toast), and then calls `job.purge`, which deletes the job and, through the foreign key, its runs. The server part cannot remove sessions itself (its session API has no `remove`), hence the split. Orphaned sessions keep their metadata but no active run, so they behave like ordinary sessions.

**Editor modal.** `ctx.ui.dialog.show` with custom JSX (`size: "xlarge"`): fields in a column, `tab`/`shift+tab` between them, `ctrl+s` to save, Esc to cancel (dialog default). Name and cron use `<input>`; prompt uses `<textarea>` whose newline key is read from `ctx.keymap.shortcuts("input.newline")` so `cli.json` overrides apply; agent and auto-mode/sandbox use select/toggle rows (agent via `dialog.select`). Agents come from `agents.list({ directory })` which calls the server's agent listing for that location; models come from the TUI's location model data (`context.data.location.model.list`) plus an "agent default" entry; the maximum run time is a numeric field (1 to 1440) and enabled is a toggle row. The cron preview is computed in the TUI with the shared cron module. Exact OpenTUI `<textarea>` props are confirmed while building (task 6.1).

## Risks / Trade-offs

- [SQLite driver not available in the service runtime] → adapter with two drivers; verified in task 1.1 before anything else is built.
- [Hook order: dashboard's permission hook may run before auto-mode's] → verify; if order does not follow plugin order, fall back to subscribing to `permission.asked` and replying `deny` for job sessions.
- [Several processes write the same DB] → WAL, busy timeout, short transactions, claims are plain inserts.
- [Clock changes / sleep] → slots derived from elapsed minutes; no catch-up, so a laptop that slept simply skips.
- [A runaway session] → per-job time limit (default 30 minutes) with interrupt, question and grace period.
- [Autonomous agents change files] → each job's auto-mode and sandbox are explicit, auto-mode defaults to on, and any non-allowed permission stops the run.
- [Other plugins' changes ship separately] → metadata contract is additive and ignored by older versions.
- [Large calendars in small terminals] → calendar hidden on small widths unless focused (spec); cells truncate.

## Migration Plan

New plugin state only: the database is created on first start; no existing data is touched. Rollback: remove the plugin entry or ignore the folder; deleting `~/.local/state/opencode-dashboard/` removes all jobs and runs.

## Open Questions

- Notifications on failure are deferred to a follow-up change.
