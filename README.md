# agent-dashboard

An OpenCode TUI plugin: a near-full-window modal with a **Sessions** tab (all root sessions across folders, preview of the last messages on wide terminals) and a **Schedule** tab (placeholder).

## Use

- Open with `/dashboard` or the command palette ("Show dashboard").
- `tab` / `shift+tab` / `1` / `2` switch tabs, `j`/`k` or arrows move, `enter` opens (or focuses) the session in a tab, `dd` deletes the selected session (permanent, after a confirmation), `r` renames it, `esc` closes.
- Sessions from the current folder are highlighted with the theme's info colour (foam in Rosé Pine).

## Keybind

`<leader>h` opens the dashboard. Override it in `cli.json` by command id:

```json
{
  "keybinds": {
    "agent-dashboard.open": "<leader>h"
  }
}
```

`auto-mode` binds `<leader>d` by default, so avoid that key.

## Options

```jsonc
{
  "package": "./configured-plugins/agent-dashboard",
  "options": {
    // Most recent sessions to list. Default 200.
    "sessionLimit": 200
  }
}
```

## Development

`bun test` runs the unit tests for the pure logic in `src/`.
