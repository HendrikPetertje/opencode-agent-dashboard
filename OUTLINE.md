# OUTLINE (for AI agents)

Read this before changing the plugin. It explains how the files fit together, the
flows, and the traps. User docs are in `README.md`, requirements in `openspec/specs/`
(one folder per capability; finished changes are in `openspec/changes/archive/`).

## What it is

An OpenCode **V2** plugin with two halves in one package (`package.json` `exports`:
`.` -> `index.ts`, `./tui` -> `tui.tsx`):

- **TUI half** (`tui.tsx`): a near-full-window modal with a **Sessions** tab and a
  **Schedule** tab, plus toasts for finished jobs. Runs in every terminal UI (Solid +
  OpenTUI). It gets **no plugin options and no server state**; it only talks to the
  server half through the RPC in `src/rpc.ts`.
- **Server half** (`index.ts`): runs inside the OpenCode service (Bun). Serves options
  over RPC and starts the **job scheduler** (`src/schedule/server/`): SQLite store,
  cron ticks, background sessions, the `job-result` tool, notifications.

Registered in `~/.config/opencode/opencode.jsonc` as
`{ "package": "./configured-plugins/agent-dashboard", "options": { "sessionLimit": 200, "osNotifications": true } }`,
**after** `auto-mode` (the permission hook must run after auto-mode's). The open keybind
is the command `agent-dashboard.open` (default `<leader>h`), overridable in `cli.json`.
It is a git submodule; the user commits, agents never commit.

## Layout

```
index.ts        server entry: config RPC, then loads src/schedule/server/setup.ts dynamically
tui.tsx         TUI entry: setup, slots, the open command (composes src/dashboard)
src/rpc.ts      the RPC contracts (DashboardConfig, DashboardSchedule)
src/shared/     helpers used by several features: options, text, list, fuzzy, theme, messages (+ preview component)
src/dashboard/  the modal shell: dashboard.tsx, layout.ts, prompt-anchor.tsx, notifications.ts
src/sessions/   Sessions tab: sessions-tab.tsx (createSessionsTab), sessions.ts (pure)
src/schedule/
  shared/       pure code + types used by both halves: types.ts, cron.ts, calendar.ts, format.ts
  ui/           TUI only: schedule-tab.tsx, job-editor.tsx, picker.tsx, run-preview.tsx
  server/       server only: setup.ts, runner.ts, store.ts, db.ts, id.ts, validate.ts, notify.ts,
                prompts.ts, log.ts, code-version.ts, jobs-api.ts (job operations shared by RPC and tools),
                job-tools.ts (agent tools + sandbox guard)
skills/         skills shipped with the plugin (schedule-job); scripts/install-skills.sh links them
test-ui/        headless UI tests (podman), see Testing
```

Import rules (enforced by `src/architecture.test.ts`): `shared` knows no feature; `schedule/shared`
is pure (no Solid, OpenTUI, node, SQLite); TUI code never imports `schedule/server` or a DB/cron
package directly (cron goes through `schedule/shared/cron.ts`); server code has no `.tsx`;
`sessions` and `schedule/ui` never import `dashboard`. Job/run types live in
`schedule/shared/types.ts` so the TUI can import them type-only.

## Tabs

A tab is a factory `create…Tab(args)` returning `{ Tab, commands, legend }`:
`createSessionsTab` and `createSchedule`. `args.active()` says the tab is shown and no dialog is
open; every command is gated by it. `dashboard.tsx` lists the tabs in one array, builds one key
layer (mode `agent-dashboard`, priority 100) from `escape`, `tab`/`shift+tab`, `1`..`n` and all
tabs' commands, and shows the active tab's `legend()`. Dialogs (`ctx.ui.dialog.*`) set
`args.suspend(true)` while open so the layer's keys go to the dialog.

The modal is drawn from the `app` slot (dialog sizes are fixed presets). In a session an invisible
anchor in `session.composer.top` reports the prompt's row so the modal ends one cell above it.

## RPC (`src/rpc.ts`)

| Method | Does | Called by |
|---|---|---|
| `agent-dashboard` `config` | `{ sessionLimit }` from the plugin options | `tui.tsx` at setup |
| `…schedule` `jobs {archived}` | jobs + last run per job | schedule tab |
| `save {job}` / `archive` / `restore {jobID}` | create or update, archive (disables), restore (disabled) | editor, schedule tab |
| `sessions {jobID}` / `purge {jobID}` | session ids of a job's runs / delete job and runs | permanent delete flow |
| `runs {jobID}` | all runs of a job | schedule tab, calendar |
| `presence {id, gone}` | a TUI is open (every 20 s) | `dashboard/notifications.ts` |
| `agentTools {enabled?}` | read / set the agent job tools toggle | schedule tab footer |
| event `changed` | jobs or runs changed: refetch | schedule tab |
| event `finished` | a run ended: show a toast (title, message, variant, sessionId) | `dashboard/notifications.ts` |

The server part is loaded once per project location; every instance registers the handlers.
TUI calls pass `{ location }`. Handlers must read the **current** runtime (`cur()` in `setup.ts`).

## Job run flow (`schedule/server/runner.ts`, one `Runner` per process)

1. Every 15 s `tick()` takes the minute slots since the last tick for every enabled, non-archived
   job (cron from `croner`, local time); only the latest slot per job; no catch-up after downtime.
2. `claim()`: insert a `claiming` run, wait 3 s, the oldest claim wins (ties: smaller ksuid); losers
   delete their row. Several OpenCode processes share one database, so this prevents double runs.
   A job with a running run skips the slot.
3. `begin()`: `session.create` in the job folder with the agent/model and metadata
   `dashboardJob: { runID, jobID }`, then `session.prompt`. Missing folder/agent fails the run.
4. Supervision (all in `Runner`, wired in `setup.ts`): `session.hook("context")` adds the headless
   instructions to active run sessions and removes the `job-result` tool from every other session;
   `permission.hook("evaluate")` fails the run on any `ask`/`deny` (after auto-mode); execution events:
   idle without a result -> one reminder, second idle -> fail; limit timer -> interrupt, "time is up"
   message, 5 min grace, then fail. `job-result` ends the run and interrupts the session.
5. `conclude()` is the only place a run is finished; it calls `finished` once, and `announce()` shows
   a toast in every open TUI (presence) or, if none and `osNotifications` is not false, an OS notification
   (`osascript` / `notify-send`, arguments only, never a shell string).
6. Restart/reload: `adopt()` at start fails old or missing runs, re-tracks the rest with the remaining time
   and tells idle sessions to continue (`RESUME_MESSAGE`).

The job runs with whatever auto-mode/sandbox its folder already has; the plugin never changes them.

## Agent job tools (`schedule/server/job-tools.ts`)

`schedule-job-list` / `-save` / `-archive` / `-restore` let an interactive agent manage jobs (driven by the
`schedule-job` skill). They call `jobs-api.ts` like the RPC handlers and emit `changed`. `save` with an `id` merges
the given fields over the stored job. They are off by default: the `settings` row `agentTools` (toggled by `t` / the
wrench in the Schedule tab footer, RPC `agentTools`) must be `on`. They are only **registered** (`ctx.tool.transform`)
while it is on and the registration is disposed when it goes off, because hook removals do not reach Code Mode
catalogs; registry changes also make OpenCode post its "catalog changed" notice in sessions. Every instance re-checks
the setting every 5 s so other OpenCode processes follow. The context hook still removes them from
active run sessions and from sessions whose
directory is sandboxed (`globalThis.__opencodeSandboxMode.isSandboxed`; plugin present but no clear answer = sandboxed);
every `execute` checks the toggle and the sandbox again. Keep names, order and descriptions fixed: the tool list is part of the
cached prompt prefix.

## Storage

`$XDG_STATE_HOME/opencode-dashboard/` (default `~/.local/state/…`): `dashboard.db` (SQLite, WAL) with
tables `jobs`, `job_runs` and `settings` (key/value, e.g. `agentTools`), and `dashboard.log`. Schema = `MIGRATIONS` in `db.ts` (`PRAGMA user_version`).
Driver: `bun:sqlite`, fallback `node:sqlite`. Only the server half opens it.

## How to…

- **Add a tab**: write `create…Tab(args)` with the shape above, add it to the `tabs` array in `dashboard.tsx`.
- **Add an RPC method**: add it to `DashboardSchedule` (`src/rpc.ts`), implement it in `setup.ts`, call it
  through `ctx.client.rpc(DashboardSchedule).method(input, { location })`. Loose `{type:"object"}` schemas.
- **Change the schema**: append a migration string to `MIGRATIONS` in `db.ts`; never edit an applied one.
- **Add a plugin option**: parse it in `shared/options.ts`; the server reads `ctx.options`; the TUI gets it only
  through an RPC (see `config`).

## Hot reload (`setup.ts`, `code-version.ts`)

The runtime (db, runner, presence, emitters) is one object on `globalThis[Symbol.for("agent-dashboard.runtime")]`.
Each project location loads its own copy of the modules, so a reload is detected by a **code version** (newest
mtime of `index.ts` and `src/**`, tests excluded), not by class identity. A new version replaces the runtime and
carries users/emitters over; `adopt()` then recovers running runs.

## Traps

- No default `bind` means the command ignores `cli.json`: keep `bind: "<leader>h"` on `agent-dashboard.open`.
- Install deps with `bun install --omit=peer`; a second copy of `solid-js`/`@opentui` breaks reactivity.
- In Solid, components are closures: create signals inside the factory/component, not at module level
  (except `createPromptAnchor`, which is a factory). A literal `""` as a child of `<box>` throws; use `<Show>`/`<text>`.
- `Show` without `fallback` is fine on the host; test-ui resolves Solid the same way (bunfig `[test] preload`).
- Cron is evaluated in the process's local time zone. Keep `croner` imports in `schedule/shared/cron.ts`.
- The TUI half has no options: do not read `context.options` for anything the server owns.
- The `job-result` tool must stay out of normal sessions (context hook); it still shows in Code Mode catalogs.
- The job tools must stay out of run sessions and sandboxed sessions; a sandboxed agent scheduling a job is a sandbox escape.
- The scheduler lives only in the server half; never start timers that run jobs from the TUI.
- Never use shell strings for OS notifications; job names and agent messages are untrusted text.

## Testing

- `bun test ./src`: pure logic, runner and store with fake timers/sessions and a temp database, and the
  architecture rules. No OpenCode imports.
- `./test-ui/run.sh`: renders the dashboard, tabs, editor, picker and run preview headlessly with OpenTUI's
  test renderer in a throwaway podman container against a fake plugin context. It checks what is drawn,
  not real keyboard, mouse or theme colours.
- Live check after changing the server half: `~/.local/state/opencode-dashboard/dashboard.log` should show
  "database opened" and no "schedule could not start".
