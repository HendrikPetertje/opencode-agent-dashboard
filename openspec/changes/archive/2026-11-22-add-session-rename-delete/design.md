# Design

## Context

`tui.tsx` already owns the dashboard: an `app`-slot overlay with its own keymap layer in a pushed input mode, the session list (live cache merged with fetched history, capped by `sessionLimit`) and the preview. The memory plugin's `dd` delete is the reference for the key feel (`DOUBLE_TAP_MS = 600`, a `pendingD` timestamp in a layer command). OpenCode's own dialogs draw a full-window box with `RGBA.fromInts(0, 0, 0, 150)` behind the dialog; the `ui.dialog.prompt` API gives a minimal text prompt. The client exposes `session.update({ sessionID, title })` and `session.remove({ sessionID })`.

## Goals / Non-Goals

**Goals:**
- Delete and rename from the Sessions tab without leaving the dashboard.
- Dim the UI behind the dashboard like native dialogs.

**Non-Goals:**
- Undo, multi-select, bulk actions.
- Other session actions (archive, fork, move).

## Decisions

**Delete with a double `d`, then a native confirm dialog.** A layer command on `d` records `Date.now()`; a second press within 600 ms opens `ctx.ui.dialog.confirm` (title, a message naming the session and saying it is permanent, "Delete"/"Cancel" labels). Only a `true` answer calls `client.session.remove`. The double press mirrors the memory plugin; the confirmation guards against accidental deletes. Alternative: delete immediately (originally planned, dropped on request).

**Rename with `ctx.ui.dialog.prompt`.** `r` calls `dialog.prompt({ title: "Rename session", value: current title })`, trims the answer and, if non-empty and different, calls `client.session.update({ sessionID, title })`. A native prompt gives the "minimal edit modal over the dashboard" with no custom UI. Alternative: an inline input inside the dashboard (more code, own focus handling). Whether the dialog draws above the `app`-slot overlay is verified manually first; if it does not, the fallback is an inline prompt box rendered inside the overlay.

**Suspend the dashboard layer while the prompt is open.** A `prompting` signal is set before `dialog.prompt` or `dialog.confirm` and cleared when the promise settles; the dashboard layer is `enabled: () => !prompting()` so typed `j`, `k`, `d`, `r` and Esc reach the prompt only. The prompt is awaited, so Esc closes only the dialog and the dashboard stays open. The dashboard's text-cursor handling (blur on open) is unchanged; after the prompt settles the layer resumes.

**Optimistic local state, then server truth.** After a successful `remove` or `update` the list updates immediately by recording the change in two local signals (`removed` ids and `renamed` id-to-title) that the merged session memo applies on top of cache and history, so the row changes even before the TUI cache catches up. Failures show `ui.toast.show({ variant: "error" })` and leave the signals untouched. Selection after deletion moves to the next row, or the previous one at the end, by capturing the index before removal.

**Scrim as a sibling box below the modal.** The overlay root becomes a fixed full-window absolute box (`left 0, top 0, width/height = terminal size`) containing the scrim (`backgroundColor = RGBA.fromInts(0, 0, 0, 150)`) and, above it by `zIndex`, the existing modal box. Because the overlay is drawn from the `app` slot, the scrim also covers the sidebar. The scrim is not themed, like the native one; the spec's theme requirement is amended accordingly.

**Legend.** Sessions legend becomes `esc close · ←/→ tabs · j/k move · enter open · dd delete · r rename`.

## Risks / Trade-offs

- [Native prompt and confirm dialogs may render below the `app`-slot overlay] → verify manually; fall back to an inline prompt inside the overlay.
- [Accidental delete: permanent] → needs a deliberate double press within 600 ms plus a confirmation.
- [Deleting a session that is open in a tab] → the server removes it; the tab shows whatever OpenCode does for a missing session. Not handled here; noted in tasks for manual checking.
- [Semi-transparent colours may render differently per terminal] → same value as the native scrim; acceptable.
- [Pending `d` timestamp survives tab switches] → reset it when the tab changes or the selection moves.
