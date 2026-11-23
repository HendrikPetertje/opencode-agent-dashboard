## 1. Scrim

- [x] 1.1 Make the overlay root a full-window absolute box with a translucent black scrim (`RGBA.fromInts(0, 0, 0, 150)`) below the modal; keep the modal sizing and anchoring unchanged
- [x] 1.2 Check the scrim also covers the sidebar and margins, and that the modal itself is not dimmed

## 2. Delete

- [x] 2.1 Local `removed` ids applied in the merged session memo, with a unit-tested helper for applying removals and renames
- [x] 2.2 `d` layer command (Sessions tab only): second press within 600 ms opens a confirm dialog and only on confirm calls `client.session.remove`; reset the pending press on tab change and selection move
- [x] 2.3 Move the selection to the next row (previous at the end) after a successful delete; error toast on failure

## 3. Rename

- [x] 3.1 `r` layer command (Sessions tab only): `ctx.ui.dialog.prompt` pre-filled with the title; trim, ignore empty or unchanged
- [x] 3.2 Call `client.session.update({ sessionID, title })`, record the new title in a local `renamed` map; error toast on failure
- [x] 3.3 `prompting` signal that disables the dashboard layer while the prompt is open, so keys go to the prompt and Esc closes only the prompt
- [x] 3.4 Verify the rename prompt and the delete confirmation draw above the overlay; if not, implement the inline prompt fallback and record it in design.md

## 4. List navigation

- [x] 4.0 PageUp/PageDown, `ctrl+u`/`ctrl+d`, Home/End, `gg` and `G` in the list (not in the legend)

## 5. Wrap-up

- [x] 5.1 Update the legend text and README (the `h`/`l` tab aliases stay out of the legend)
- [x] 5.2 Manual check: delete the last row, delete the only session, rename then Enter, delete a session that is open in a tab
- [x] 5.3 Validate the change with `openspec validate add-session-rename-delete`
