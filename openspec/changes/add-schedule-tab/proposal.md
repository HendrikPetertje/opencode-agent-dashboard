# Proposal

## Why

The dashboard's Schedule tab is a placeholder. The goal is to let the user hand recurring work to an autonomous agent: define a job (folder, agent, prompt, cron), have OpenCode start it in the background when it is due, see when it ran and whether it worked, and step into any run to steer it by hand. This builds on the dashboard modal and its session preview.

## What Changes

- **Schedule tab UI** (two columns): a list of jobs (title, last run time and status, next run time) and a calendar of the selected job's runs. The calendar switches to a week view above two runs per day and a today-only view above four per day. `left`/`right` or `h`/`l` switch between the panes. In the calendar, `up`/`down` step through past runs, `enter` previews the run's session in a modal and a second `enter` opens that session in a tab.
- **Job management**: `a` creates a job; `enter` on a job edits it; `dd` (with confirmation) archives it, which also disables it. Create/edit use one modal over the dashboard with name, folder, agent, model, maximum run time in minutes (default 30), an enabled toggle (the only place to enable or disable a job), auto-mode, sandbox, a multi-line prompt and a cron field with a preview of the next 3 runs.
- **Archive**: `A` toggles an archive view of deleted jobs with the same list and calendar. There `u` restores a job (disabled) and `dd` removes it permanently, after a confirmation and the question "Remove associated OpenCode sessions for this job?": YES removes the run sessions, NO leaves them orphaned.
- **Job store**: a new SQLite database in `~/.local/state/opencode-dashboard/` with `jobs` and `job_runs` tables; run IDs are KSUIDs.
- **Job runner** in the plugin's server part: a single scheduler per OpenCode process starts due jobs. Before running, a run claims its time slot and waits 3 seconds, so when several OpenCode instances are running only the oldest claim (ties broken by KSUID order) proceeds. A run is a new background session in the job's folder with the chosen agent and model, informed that it is headless and autonomous, and limited to the job's maximum run time.
- **`job-result` tool**: available only inside an active job run; the agent calls it to mark the run succeeded or failed.
- **Failure handling**: a permission that ends as "ask" or "deny" (including auto-mode rejecting or being unsure) fails the run and interrupts the session. A run that goes idle without reporting gets one reminder to call `job-result` and fails if it still reports nothing; a run that exceeds its maximum run time is stopped and failed. The user can open the session from the calendar and continue it manually; the headless instructions and the `job-result` tool are then gone.
- **Cross-plugin**: auto-mode and sandbox-mode read per-session settings from the job session's metadata so a job can enable or disable each for that run only.

## Capabilities

### New Capabilities
- `schedule-tab`: job list, calendar views, pane navigation, run preview and opening a run's session, enabling/disabling and archiving jobs, the archive view with restore and permanent deletion, and the entry points to the editor.
- `schedule-job-editor`: the create/edit modal, its fields (including model and maximum run time), defaults, availability of auto-mode and sandbox options, prompt newline handling and the cron preview.
- `job-store`: the SQLite database, schema, KSUID run IDs and what is persisted.
- `job-runner`: cron scheduling, slot claiming across instances, starting the background session, headless instructions, the `job-result` tool, the time limit, failure rules and manual takeover.

### Modified Capabilities
- `dashboard-modal`: the Schedule tab is no longer a placeholder; on the Schedule tab the left/right keys switch panes instead of tabs.

## Impact

- New in this repo: SQLite storage, cron handling with the `croner` library, run IDs with a KSUID library, runner and RPC in the server part (`index.ts`, `src/`), a Schedule tab and editor in `tui.tsx`/`src/`, new RPC methods and events in `rpc.ts`.
- Plugin API used: server `session.create/prompt/interrupt/wait`, `permission.hook.evaluate`, `session.hook.context` (system text, tool list), `tool.transform`, `event.subscribe`, `rpc.register`; client `location.agent.list`.
- Other plugins (separate repos): `auto-mode` and `sandbox-mode` each need a small change to honour the job session metadata.
- New runtime requirements: a SQLite driver available in the OpenCode service runtime (`bun:sqlite` or `node:sqlite`) and the `croner` and `ksuid` packages, installed in the plugin folder (`bun install` or `npm install`).
- Time zone: cron expressions are evaluated in the local time zone of the OpenCode process.
