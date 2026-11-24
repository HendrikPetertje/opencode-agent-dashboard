# agent-dashboard

An OpenCode plugin: a near-full-window modal with a **Sessions** tab (all root sessions across folders, preview of the last messages on wide terminals) and a **Schedule** tab (scheduled agent jobs).

## Use

- Open with `/dashboard` or the command palette ("Show dashboard").
- `tab` / `shift+tab` / `1` / `2` switch tabs, `j`/`k` or arrows move, `enter` opens (or focuses) the session in a tab, `dd` deletes the selected session (permanent, after a confirmation), `r` renames it, `esc` closes.
- Sessions from the current folder are highlighted with the theme's info colour (foam in Rosé Pine).

## Schedule

The Schedule tab lists scheduled jobs on the left and a calendar of the selected job's runs on the right. `←`/`→` (or `h`/`l`) switch panes, `tab`/`shift+tab` switch tabs.

- **Jobs (left):** `a` new, `enter` edit, `dd` archive (disables the job), `A` shows the archive (`u` restore, `dd` delete permanently, with the choice to remove the job's sessions). `t` turns the agent job tools on or off (see "From a session").
- **Calendar (right):** `↑`/`↓` step through past runs (starting at the latest), `enter` previews the run's session, `enter` again opens it in a tab. Jobs that run more than twice a day show the week, more than four times a day only today.
- **Editor:** name, folder, agent, model, maximum minutes (default 30), enabled, prompt (the `input.newline` key adds a line) and a cron expression (five fields, local time) with the next three runs. `tab` moves between fields, `ctrl+s` saves.

Runs are started by the OpenCode process that is running (nothing runs when OpenCode is off). Each run is a new background session in the job's folder, told it is headless, with one extra tool, `job-result`, that the agent calls to report success or failure. Calling it stops the agent. Jobs have no auto-mode or sandbox settings: they run with whatever those are for the job's folder, so nothing in the schedule can switch a safeguard off. For different safeguards, point a job at a separate worktree or clone. A permission that would need an answer (auto-mode, when on, being unsure or denying, or a rule that asks) fails the run. After the maximum time the agent is interrupted and has 5 minutes to clean up and report. Open a failed run's session from the calendar to continue by hand.

When a run ends (succeeded, failed or timed out) an open TUI shows a toast that offers to open the run's session. With no TUI open an operating system notification is shown instead (macOS `osascript`, Linux `notify-send`). Turn that off with the plugin option `"osNotifications": false`, for example when another plugin already forwards notifications.

Jobs and runs are stored in `~/.local/state/opencode-dashboard/dashboard.db` (SQLite). Problems are logged in `dashboard.log` next to it.

### From a session

Ask the agent to "schedule a job" (or edit, archive, restore one). The `schedule-job` skill asks for every field with the question tool, drafts the job prompt so it runs headless, shows a summary to confirm, and can write `<job folder>/.opencode/AUTO_MODE_INSTRUCTIONS.md` for auto-mode. It uses the tools `schedule-job-list`, `schedule-job-save` (partial updates by `id`), `schedule-job-archive` and `schedule-job-restore`. They are **off by default** so they don't take context in every session: turn them on with the wrench toggle in the Schedule tab's footer (`t`), and off again when done. The setting is global (all sessions, all OpenCode processes). They are never available in job runs, nor when sandbox mode is on for the session's folder (a job runs outside the sandbox). Switching the toggle or sandbox mode changes the tool list, so the next request of a session misses the prompt cache once. The toggle adds or removes the tools themselves, so sessions get OpenCode's "catalog changed" notice.

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
    "sessionLimit": 200,
    // Operating system notification for finished jobs when no TUI is open. Default true.
    "osNotifications": true
  }
}
```

## Install

The schedule uses `croner` and `ksuid`. Install them in the plugin folder without the peer dependencies (OpenCode already provides those, and a second copy of solid-js would break the UI):

```sh
bun install --omit=peer
./scripts/install-skills.sh   # links skills/* into ~/.config/opencode/skill/ (build.sh in the config repo runs it too)
```

If the schedule does not start right after installing, reload the plugin or restart OpenCode and check `~/.local/state/opencode-dashboard/dashboard.log`.

## Development

See `OUTLINE.md` for how the code is organised (folders, flows, RPC, traps) before changing it.


`bun test` runs the unit tests for the pure logic in `src/`. `./test-ui/run.sh` renders the dashboard, the Schedule tab, the job editor and the run preview headlessly with OpenTUI's test renderer in a throwaway podman container and checks what they draw.
