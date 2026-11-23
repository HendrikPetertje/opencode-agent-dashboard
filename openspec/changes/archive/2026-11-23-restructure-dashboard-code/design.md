# Design

## Context

Current layout (see proposal.md for why it needs to change):

```
index.ts  tui.tsx  rpc.ts
src/  calendar cron db folder fuzzy id layout log notify options prompts runner server sessions store validate  (.ts)
      message-preview.tsx
      schedule/ format.ts types.ts schedule.tsx job-editor.tsx run-preview.tsx
      dashboard.test.ts schedule.test.ts runner.test.ts
test-ui/  (headless UI tests, run.sh)
```

The two halves of the plugin load separately: the server half (`index.ts`, runs inside the OpenCode service on Bun, owns SQLite and the scheduler) and the TUI half (`tui.tsx`, runs in each terminal UI, uses Solid and OpenTUI). They talk only through RPC (`rpc.ts`). Several files are pure and used by both halves (cron, calendar maths, text helpers). The Schedule tab already follows a good pattern: `createSchedule(args)` returns `{ Tab, commands, legend }`, and the dashboard shell only composes it. The Sessions tab does not: its logic lives inside the `Dashboard` component in `tui.tsx`.

## Goals / Non-Goals

**Goals:**
- Folders that follow features, with one obvious home for new code.
- A rule for what may import what, checked by a test.
- Both tabs built the same way, so adding a third tab is mechanical.
- An `OUTLINE.md` that gets an agent productive in a few minutes.

**Non-Goals:**
- Any change in behaviour, UI, RPC contract, database schema, options, keybinds or dependencies.
- Rewriting logic while moving it; moved code keeps its content except for imports and the extraction described below.
- Touching the other plugin repositories.

## Decisions

**Target layout.**

```
index.ts                 server entry: registers config RPC, starts the schedule server
tui.tsx                  TUI entry: setup, slots, the open command; composes src/dashboard
src/
  rpc.ts                 DashboardConfig and DashboardSchedule (moved from the root)
  shared/                used by more than one feature, no feature knowledge
    options.ts           plugin options parsing (sessionLimit, osNotifications)
    text.ts              folderLabel, formatDate, ellipsize, ellipsizeStart       (was folder.ts)
    list.ts              moveIndex, neighbourAfterRemoval                          (from sessions.ts)
    fuzzy.ts
    theme.ts             ansi() fallback and theme token readers                   (from tui.tsx)
    messages.ts          previewMessages (pure)
    message-preview.tsx  the preview component (uses messages.ts)
  dashboard/             the modal shell
    dashboard.tsx        overlay, scrim, tab bar, legend, key layer, tab switching
    layout.ts            modalLayout, SMALL_WIDTH
    prompt-anchor.tsx    measures the prompt row so the modal ends above it
    notifications.ts     presence heartbeat and finished-run toasts
  sessions/              Sessions tab
    sessions-tab.tsx     createSessionsTab(args) -> { Tab, commands, legend }
    sessions.ts          rootSessions, applyLocalChanges (pure)
  schedule/
    shared/              pure code and types used by both halves
      types.ts           Job, JobInput, Run, RunStatus (type-only)
      cron.ts            croner wrapper
      calendar.ts        views, markers, run cursor
      format.ts          symbols, time, weekday names, newline bindings
    ui/                  TUI only
      schedule-tab.tsx   createSchedule(args) -> { Tab, commands, legend }
      job-editor.tsx     the editor dialog
      picker.tsx         the agent/model picker overlay (split out of job-editor)
      run-preview.tsx
      types.ts           ScheduleColors
    server/              server only
      setup.ts           runtime singleton, RPC handlers, tool, hooks (was src/server.ts)
      runner.ts  store.ts  db.ts  id.ts  validate.ts  notify.ts  prompts.ts  log.ts
```

Tests sit next to the code (`runner.test.ts`, `store.test.ts`, `cron.test.ts`, `calendar.test.ts`, `fuzzy.test.ts`, `notify.test.ts`, `text.test.ts`, `sessions.test.ts`, `layout.test.ts`, `options.test.ts`); the current catch-all files are split by module. `test-ui/` stays where it is with updated paths.

**Import rules** (enforced by `src/architecture.test.ts`, which reads every source file and checks its relative imports):
1. `shared/` imports nothing from the feature folders.
2. `schedule/shared/` imports only `shared/` and itself, and no Solid, OpenTUI, SQLite or Node-only modules (it runs in both halves).
3. `schedule/ui/`, `sessions/` and `dashboard/` (TUI code) never import `schedule/server/`, `db`, `store`, `ksuid`, `croner` directly (cron goes through `schedule/shared/cron.ts`) or `node:sqlite`/`bun:sqlite`.
4. `schedule/server/` never imports a `.tsx` file, Solid or OpenTUI.
5. `dashboard/` may import `sessions/` and `schedule/ui/`; they never import `dashboard/` (the shell passes what they need through their `args`).
Type-only imports of `schedule/shared/types.ts` are allowed everywhere; this is why the job and run types move there instead of staying in `store.ts`.

**One contract for tabs.** `createSessionsTab(args)` is extracted from the `Dashboard` component with the same shape as `createSchedule`: `args` carries `ctx`, `active()`, `small()`, `colors()`, `suspend()` and whatever the tab needs from the shell (for example `openSession`); it returns `{ Tab, commands, legend }`. The shell lists tabs in one array, builds the key layer from every tab's `commands` (each already gated by `active()`) and shows the active tab's legend. Adding a tab then means writing one `create…Tab` and adding it to that array. The extraction moves the current code without changing it; the signals the Sessions tab owns (selection, history, local deletions and renames, list width) move with it.

**Moves, not rewrites.** Each file moves with `git mv` so history follows; edits are limited to import paths, the extractions above (`theme.ts`, `list.ts`, `picker.tsx`, `notifications.ts`, `prompt-anchor.tsx`, `sessions-tab.tsx`) and removing code that is provably unused (checked with a search for each export). Names in kebab-case, except nothing is renamed gratuitously.

**RPC stays one contract file.** `rpc.ts` moves to `src/rpc.ts` like in the sibling plugins; ids and method names do not change, so a TUI and a server of different versions during a reload keep talking.

**The hot-reload version.** `schedule/server/setup.ts` builds a "code version" from the newest modification time of the plugin's source files, to tell a reload from another project location loading the same code. It currently lists `index.ts`, `rpc.ts` and the files of one flat `src/` folder. After the move it must scan `src/` recursively and find the plugin root by walking up to `package.json`, not by `dirname(dirname(file))`. Without this, edits to files in subfolders would not replace the runtime. A unit test creates a temporary tree and checks that touching a file in a subfolder changes the version.

**OUTLINE.md.** Same style and tone as `auto-mode/OUTLINE.md`: "Read this before changing the plugin". Sections: what it is and how it is registered; the two halves and the RPC between them; file map by folder (role + what it imports); flows (a job run from tick to notification, claims across instances, restart adoption, presence and toasts, hot reload); the RPC table (method, purpose, caller); UI entry points (`/dashboard`, palette, `agent-dashboard.open` keybind) and the keys per tab; storage (database path, tables); how to add a tab / an RPC method / a database migration / a plugin option; the traps (no options in the TUI half, `bun install --omit=peer`, two copies of Solid, `Show` without fallback inside a box is fine on the host but not in server-built Solid, the keymap `bind` default requirement, plugin order after auto-mode, `job-result` and Code Mode, local time zone, never run the scheduler in the TUI); testing (`bun test`, `./test-ui/run.sh`, what each covers). It stays short enough to read in one sitting (about 150 lines) and links to `README.md` for user docs and to `openspec/specs/` for requirements.

## Risks / Trade-offs

- [A broken import after a move only shows at runtime in the live service] → move in small steps with unit tests and `test-ui` after each; build every entry file with `bun build --no-bundle` as a parse check; finally load the plugin in the real service and check `dashboard.log` and the TUI.
- [The runtime replacement logic breaks silently] → the version test above, plus a manual reload check (edit a file in a subfolder, expect "runtime replaced after a reload" in `dashboard.log`).
- [Churn makes review hard] → one commit-sized step per task group, `git mv` for history, no logic changes mixed with moves.
- [Architecture test too strict or brittle] → it checks only relative imports and a small list of forbidden package names; failures print the offending file and import.
- [Archived OpenSpec changes and the README mention old paths] → archives are history and stay; the README and OUTLINE.md use the new paths.

## Migration Plan

Pure refactor: no data migration. Roll back by reverting the commits (the plugin has no persisted state that depends on file layout). The database, state folder and `cli.json`/`opencode.jsonc` entries are untouched.
