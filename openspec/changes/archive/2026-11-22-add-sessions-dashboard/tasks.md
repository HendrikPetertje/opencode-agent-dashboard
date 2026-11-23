## 1. Scaffold and prototype

- [x] 1.1 Create `package.json` (name, `./tui` export, peer deps as in auto-mode), `tui.tsx` with `Plugin.define`, and `.gitignore`
- [x] 1.2 Dialog presets are fixed (60/88/116 columns) and cannot meet the margin rules, so the `app`-slot overlay fallback is used; decision recorded in design.md. (Behavior in the live TUI still to be verified by hand)
- [x] 1.3 Add the plugin to `plugins` in `opencode.jsonc` (no options)

## 2. Modal shell

- [x] 2.1 Margin/size helper driven by `useTerminalDimensions` (4/4 regular, 2/2 small) with unit tests
- [x] 2.2 Modal component: absolutely positioned overlay with computed size, tab bar, `esc` close button top right
- [x] 2.3 Esc handling and a keymap layer plus pushed input mode owned by the overlay (released on close)
- [x] 2.4 Tab switching by click and keyboard; Schedule placeholder body
- [x] 2.5 Entry points: `/dashboard`, palette entry, and the `agent-dashboard.open` keybind (default `<leader>h`, overridable in `cli.json`); no button or icon

## 3. Sessions tab

- [x] 3.1 `folderLabel` and date formatting with unit tests
- [x] 3.2 Session selection: root sessions only, newest first, with tests
- [x] 3.3 List component with title/date/folder, selection marker, scrollbox auto-scroll
- [x] 3.4 Highlight current-folder sessions with the foam-equivalent theme token; others `text.base`
- [x] 3.5 Navigation: Up/Down and `j`/`k`
- [x] 3.6 Preview pane (wide only): debounced message sync, last ~10 text messages, truncation, loading state
- [x] 3.7 Enter: `tabs.focus` (fallback router navigate) then close modal

## 4. Wrap-up

- [x] 4.1 Verify behavior at large and small widths and on resize while open
- [x] 4.2 README: install, options, keybind conflict with auto-mode
- [x] 4.3 Validate the change with `openspec validate add-sessions-dashboard`
