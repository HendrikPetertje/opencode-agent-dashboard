# Proposal

## Why

The plugin grew feature by feature and now has 25 TypeScript files side by side in `src/` (database, cron, calendar maths, fuzzy search, layout, runner, notifications, tests) next to a 490-line `tui.tsx` that holds the dashboard shell, the whole Sessions tab, the presence heartbeat and the toast handler. It is hard to see which file belongs to which feature, which code may run where (server or TUI), and where a new feature should go. The other configured plugins (`auto-mode`, `sandbox-mode`, `memory-ticker`) each have an `OUTLINE.md` that lets an agent understand the repository quickly; this one has none.

## What Changes

- **Structure by feature**: move the code into folders that follow the features: `src/dashboard/` (the modal shell), `src/sessions/` (Sessions tab), `src/schedule/` (Schedule, split into `shared/`, `ui/` and `server/`), and `src/shared/` (helpers used by more than one feature). `index.ts` and `tui.tsx` stay as thin entry points.
- **Split `tui.tsx`**: the Sessions tab becomes its own module with the same shape as the Schedule tab (a `create…Tab` function that returns the tab, its key commands and its legend); the presence heartbeat and finished-run toasts, the prompt anchor, and the colour helpers move out to their own files.
- **One place for each kind of code**: types that both halves need (job and run shapes) move to `schedule/shared/`, so UI code never imports from server code and the server never imports UI code. An architecture test enforces this.
- **Split the big test files** to sit next to the code they test, one file per module.
- **Cleanup**: remove unused exports and imports, the stray `hello.txt` left by a test job, and duplicated helpers; keep naming consistent (kebab-case files); commit `bun.lock`.
- **`OUTLINE.md`** for future agents, in the same style as the sibling plugins: what the plugin is, how the two halves fit together, a file map, the main flows (job run, finish notifications, restart, presence), the RPC contract, UI entry points and keys, and the traps. The README gets a short pointer.
- **No behaviour change.** Nothing a user can see or configure changes.

## Capabilities

### New Capabilities
<!-- None: this change moves and tidies code and adds documentation. -->

### Modified Capabilities
<!-- None: no requirement changes. The change sets skip_specs. -->

## Impact

- Every source file moves or is split; imports change everywhere. Package exports (`.` and `./tui`), RPC ids and methods, the database schema, plugin options and keybind ids stay exactly as they are.
- `src/server.ts` computes a code version from the plugin's source files to detect hot reloads; it must keep working after the move (it currently scans one flat folder).
- `test-ui/` imports and `run.sh` need their paths updated.
- The two other plugin repositories are not touched. Existing archived OpenSpec changes mention old paths; they stay as history.
