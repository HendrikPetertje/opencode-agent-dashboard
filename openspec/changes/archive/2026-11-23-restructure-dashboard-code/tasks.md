## 1. Baseline and safety nets

- [x] 1.1 Record the baseline: `bun test ./src`, `./test-ui/run.sh`, and a `bun build --no-bundle` parse of `index.ts`, `tui.tsx` and `src/server.ts`, all green
- [x] 1.2 Write `src/architecture.test.ts` with the import rules from design.md (reads every source file, checks relative imports and forbidden packages, prints the offending file and import); it will fail until the moves are done, so (it passes once the moves are done, and it was checked against deliberate violations)
- [x] 1.3 Remove the stray `hello.txt` left by a test job; keep `bun.lock` and add `test-ui/node_modules` and `test-ui/bun.lock` to the ignore rules if missing

## 2. Shared helpers (`src/shared/`)

- [x] 2.1 `git mv` `options.ts`, `fuzzy.ts` and `message-preview.tsx` into `src/shared/`; `folder.ts` becomes `shared/text.ts`; fix imports
- [x] 2.2 Move `moveIndex` and `neighbourAfterRemoval` out of `sessions.ts` into `shared/list.ts`, and the pure `previewMessages` into `shared/messages.ts` (used by the preview component), so Schedule no longer imports from the Sessions module
- [x] 2.3 Extract `ansi()` and the theme token readers (info, success, error, warning, base/raised backgrounds) from `tui.tsx` into `shared/theme.ts`; both tabs use it
- [x] 2.4 Split the related tests into `text.test.ts`, `list.test.ts`, `fuzzy.test.ts`, `options.test.ts`; unit tests and `test-ui` green

## 3. Schedule shared code (`src/schedule/shared/`)

- [x] 3.1 Create `types.ts` with `Job`, `JobInput`, `Run`, `RunStatus` (type-only) and make `store.ts` and the UI import them from there
- [x] 3.2 `git mv` `cron.ts`, `calendar.ts` and `schedule/format.ts` into `schedule/shared/`; fix imports; split `cron.test.ts` and `calendar.test.ts` out of `schedule.test.ts`

## 4. Schedule server (`src/schedule/server/`)

- [x] 4.1 `git mv` `db.ts`, `store.ts`, `id.ts`, `validate.ts`, `runner.ts`, `prompts.ts`, `notify.ts`, `log.ts` into `schedule/server/`, and `server.ts` to `schedule/server/setup.ts`; fix imports in `index.ts`
- [x] 4.2 Make the code-version function in `setup.ts` scan `src/` recursively and find the plugin root by walking up to `package.json`; unit test it with a temporary tree (touching a file in a subfolder changes the version)
- [x] 4.3 Split `store.test.ts`, `notify.test.ts` out of `schedule.test.ts`; `runner.test.ts` moves next to `runner.ts`
- [x] 4.4 `git mv rpc.ts src/rpc.ts`; update `index.ts`, `tui.tsx`, the server setup and the schedule UI; ids and method names unchanged

## 5. Schedule UI (`src/schedule/ui/`)

- [x] 5.1 `git mv` `schedule.tsx` to `schedule/ui/schedule-tab.tsx`, `job-editor.tsx`, `run-preview.tsx` and `types.ts` (colours) into `schedule/ui/`; fix imports
- [x] 5.2 Split the agent/model picker overlay out of `job-editor.tsx` into `schedule/ui/picker.tsx` with the same props and behaviour; `test-ui` editor tests still pass unchanged

## 6. Sessions tab (`src/sessions/`)

- [x] 6.1 Move `sessions.ts` to `src/sessions/sessions.ts` (now only `rootSessions` and `applyLocalChanges`); split `sessions.test.ts`
- [x] 6.2 Extract the Sessions tab from the `Dashboard` component into `sessions/sessions-tab.tsx` as `createSessionsTab(args)` returning `{ Tab, commands, legend }`, moving its signals (selection, history, local deletions and renames, list width), delete and rename flows and the row components with it, without changing their content
- [x] 6.3 `test-ui/dashboard.test.tsx` still passes (Sessions tab renders, delete and rename keys unchanged)

## 7. Dashboard shell (`src/dashboard/`)

- [x] 7.1 Move `layout.ts` to `dashboard/layout.ts` with its test
- [x] 7.2 Extract the presence heartbeat and finished-run toast handler into `dashboard/notifications.ts` (`startNotifications(context)` returning a stop function)
- [x] 7.3 Extract the prompt anchor and its measuring into `dashboard/prompt-anchor.tsx`
- [x] 7.4 Move the overlay, scrim, tab bar, legend, input-mode handling and key layer into `dashboard/dashboard.tsx`, driven by an array of tabs (`createSessionsTab`, `createSchedule`); `tui.tsx` keeps only setup, the slots and the open command (under 120 lines)

## 8. Cleanup

- [x] 8.1 Enable `architecture.test.ts` and fix any violations
- [x] 8.2 Remove unused exports, imports and variables (search every export; use `ast-grep`/`rg`), duplicated helpers and stale comments (for example "Schedule placeholder" mentions); keep comment density as it is
- [x] 8.3 Check names (kebab-case files, one component or factory per file where practical) and that no file imports through a path that skips a folder's own boundary
- [x] 8.4 Update `test-ui` imports and `run.sh` paths; update the README's file references and development section

## 9. OUTLINE.md

- [x] 9.1 Write `OUTLINE.md` in the style of `auto-mode/OUTLINE.md` with the sections listed in design.md (what it is and registration, the two halves and RPC, file map by folder, flows, RPC table, UI entry points and keys, storage, how to add a tab / RPC method / migration / option, traps, testing), about 150 lines
- [x] 9.2 Add a pointer from `README.md` to `OUTLINE.md`

## 10. Verify

- [x] 10.1 `bun test ./src`, `./test-ui/run.sh` and parse builds of all entry files pass, with no change to the test expectations (only paths)
- [x] 10.2 Load the restructured plugin in the running service: `dashboard.log` shows the database opening, no "schedule could not start", and editing a file in a subfolder triggers "runtime replaced after a reload"
- [x] 10.3 In the TUI: open the dashboard, switch tabs, open the editor and the picker, run a job to its toast
- [x] 10.4 Validate the change with `openspec validate restructure-dashboard-code`
