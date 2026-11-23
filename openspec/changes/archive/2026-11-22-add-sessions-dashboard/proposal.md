# Proposal

## Why

Working across many repos and worktrees means many OpenCode sessions, and the only way to find one is the tab strip or the session picker. There is no single overview that shows every session, where it lives, and what was last said in it. A dashboard modal gives a one-keystroke overview and jump-to-session, and is the foundation for later views such as scheduling.

## What Changes

- New TUI plugin (`agent-dashboard`) that renders a near-full-window modal overlay above the rest of the UI.
- The modal opens with a `/dashboard` slash command, a command palette entry, or the `agent-dashboard.open` keybind (default `<leader>h`, overridable in `cli.json`; no button or icon), and closes with Esc or a close button (labelled `esc`) in its top right corner.
- The modal has two tabs: **Sessions** and **Schedule**.
- **Sessions** tab: a scrollable list of all root sessions (title, date, shortened folder) with folder-aware highlighting using active theme colors, and, on wide terminals, a right-hand preview of the last messages of the selected session. Enter opens (or focuses) the session in a tab and closes the modal.
- **Schedule** tab: placeholder only; its behavior is specified in a follow-up change.

## Capabilities

### New Capabilities
- `dashboard-modal`: opening/closing, sizing and margins, responsive behavior, tab switching, entry points (slash command, palette, keybind).
- `dashboard-sessions-tab`: session list, formatting, highlighting, navigation, preview pane, and open-session behavior.

### Modified Capabilities
<!-- None: this repository has no existing specs. -->

## Impact

- New package in `configured-plugins/agent-dashboard` (`package.json` with `./tui` export, `tui.tsx`, `src/`), loaded via the `plugins` list in `cli.json`.
- Uses `@opencode/plugin/tui` (`ui.slot`, `keymap.layer`, `data.session`, `ui.tabs`, `ui.router`), `@opentui/core`, `@opentui/solid`, `solid-js`.
- The default keybind `<leader>h` avoids auto-mode's `<leader>d`; it can be overridden in `cli.json`.
- No server-side changes and no changes to OpenCode itself.
