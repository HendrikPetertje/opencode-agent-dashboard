# Design

## Context

The plugin is a TUI-only plugin (`./tui` export, `Plugin.define` from `@opencode/plugin/tui`), modelled on `configured-plugins/auto-mode`, which already ships a modal and a keymap layer. Relevant documented APIs: `ui.slot` (including the `app` slot), `keymap.layer`, `data.session.*`, `ui.tabs.open/focus/list`, `ui.router.current`, theme tokens via `context.theme`, and `useTerminalDimensions` from `@opentui/solid`.

The docs describe no full-window modal API. `ui.dialog.show` has fixed size presets (the sibling plugins use `xlarge`/`large` and shrink the height by hand), which may not give exactly "window minus 4 columns".

## Goals / Non-Goals

**Goals:**
- A modal whose size is derived from terminal dimensions and the margin rules in the `dashboard-modal` spec.
- Reusable shell (tab bar, close button, key handling) so the Schedule change only adds a tab body.

**Non-Goals:**
- Any Schedule functionality.
- Adding a real tab to OpenCode's tab strip (no documented API).
- Session management actions (delete, rename, archive) from the dashboard.

## Decisions

**Modal drawn from the `app` slot (task 1.2 outcome).** The sibling plugins use `ui.dialog.show` + `dialog.set({ size })`, but the host's dialog widths are fixed presets: `medium` 60, `large` 88, `xlarge` 116 columns (capped to terminal width minus 2). That cannot give "terminal width minus 4 columns", so the dashboard uses the planned fallback: an `app`-slot component rendering an absolutely positioned `<box>` at `left/top = margin`, sized from `useTerminalDimensions()` through `modalLayout`, with `zIndex`, a rounded border and `theme.background.raised.high`. Alternative: a plugin route (replaces the whole screen, loses the "modal over the UI" look).

**Anchoring above the prompt.** The modal is always drawn from the `app` slot: a modal rendered inside the session pane (for example from `session.composer.top`) was painted under the sidebar. In a session route an invisible zero-height anchor in the `session.composer.top` slot reports its screen row (`y`, measured after mount and on resize) through a plugin-level signal, and the modal's height becomes `y - 1 - margin`, so it keeps its top margin and ends one empty cell above the prompt. Outside a session, or before the first measurement, it uses the plain margins. The measurement is taken once on open, so a prompt that grows while the modal is open is not followed.

**Input.** While open, the overlay pushes its own input mode (`keymap.mode.push("agent-dashboard")`) so base-mode layers (prompt shortcuts) are inactive, and registers a layer in that mode (`escape`, `tab`/`shift+tab`, `1`/`2`, `j`/`k`/arrows, `return`). Both are released when the overlay unmounts (`onCleanup`). Esc is bound by the plugin itself, since there is no dialog to do it. The `[esc]` button calls the same `hide`. Unverified without running the TUI: that the prompt textarea stops receiving typed characters while the mode is pushed.

**Entry points.** One global keymap layer registers the command `agent-dashboard.open` with `slash: { name: "dashboard" }` and `palette: true`. Its `bind` is `<leader>h`, following memory-ticker: configured keybinds in `cli.json` only override a command that declares a default `bind` (a command with no `bind` or `bind: false` did not pick up a `cli.json` binding in manual testing). The layer lists the id in `bindings` so the override applies. `<leader>h` avoids auto-mode's `<leader>d`. No footer button or icon is added.

**Responsive thresholds.** A single constant (`SMALL_WIDTH`, initially 100 columns) decides margin (4 vs 2) and the preview pane (hidden when small). Margins apply to both axes: 4 rows / 4 columns, or 2 / 2. The same derived `isSmall` accessor drives both so they cannot disagree.

**Session list as a table.** One row per session with fixed-width Date and Folder columns (Folder capped at 28 columns, sized to the longest label) and a flexible, clipped Title column, plus a muted header row; no separators. Selection is a `▌` marker and bold text.

**Session data.** Read `context.data.session.list()`, filter to sessions without a parent, sort by last-updated descending. Selection is tracked by session ID, not index, so live updates do not move the cursor. The list is virtualized with a `<scrollbox>`, and the selected row is scrolled into view on change.

**Folder label.** Pure function `folderLabel(directory)`: split on `/`, drop empty segments, join the last two. It needs no worktree detection since both cases yield "last two segments".

**Highlighting.** Entries whose directory equals `context.location?.directory ?? context.data.location.default()` use a theme accent token; the rest use `theme.text.base`. The exact token that maps to Rosé Pine foam (likely an accent/success-like semantic token) is determined by inspecting `context.theme` at implementation time, and the choice is recorded in the code.

**Preview.** `data.session.message.sync(id)` on selection change (debounced ~100 ms so scrolling does not fetch for every row), then `message.list(id)`. Take the last ~10 messages, extract text parts only for user and assistant, truncate to pane size. Tool parts are skipped.

**Open session.** `ui.tabs.enabled()` → `tabs.focus(id)` (opens the tab if needed, focuses if open), then close the modal. If tabs are disabled, fall back to `ui.router.navigate({ type: "session", sessionID })`.

**Module layout.** `tui.tsx` (setup, overlay, keymap, tabs, list, preview), `src/layout.ts`, `src/folder.ts`, `src/sessions.ts` (pure logic, unit-tested with `bun test`).

## Risks / Trade-offs

- [`app`-slot overlay may not draw above everything or may leak keys to the prompt] → verify manually in the TUI; fall back to a route if needed.
- [Tab strip is not extensible, so no pinned tab] → slash command, palette entry and keybind instead.
- [Theme token for "foam" is unknown] → inspect `context.theme` and pick the semantic token whose Rosé Pine value is foam; if none matches, document the nearest.
- [Large session lists] → scrollbox and per-selection message fetching only.
- [OpenTUI/plugin API drift] → pin peer dependency ranges like auto-mode.

## Open Questions

- Exact `SMALL_WIDTH` value; tune visually after the first prototype.
