# Proposal

## Why

The dashboard lists every session but cannot manage them: renaming or deleting one means leaving the dashboard for the session list (`<leader>l`) and back. The dashboard should offer the same rename and delete actions, and should dim the UI behind it the way OpenCode's own dialogs do, so it reads as a modal.

## What Changes

- On the Sessions tab, `dd` (two quick presses of `d`, as in the memory plugin) asks for confirmation and then deletes the selected session.
- On the Sessions tab, `r` opens a minimal text prompt, over the dashboard, to rename the selected session.
- The dashboard dims the rest of the UI behind it with a translucent dark scrim, like OpenCode's dialogs do.
- The legend shows the new keys.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `dashboard-sessions-tab`: adds requirements for deleting and renaming the selected session.
- `dashboard-modal`: adds a requirement for the backdrop scrim, and extends the legend requirement and the theme-colour requirement (scrim is the one non-theme colour).

## Impact

- `tui.tsx`: new key commands, the scrim element, the rename prompt, calls to `client.session.update` and `client.session.remove`, list refresh after each.
- The dashboard's input layer must be suspended while the rename prompt is open.
- No server-side or OpenCode changes. Deleting is permanent after confirmation: the session and its messages are removed on the server.
