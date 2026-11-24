# Proposal

## Why

Creating or changing a scheduled job today means opening the dashboard and filling in the job editor by hand. The prompt is the hardest field to get right, and an interactive agent session is a better place to write it: the agent can ask questions, look at the target folder and draft a prompt that works headless. The same conversation can also write the auto-mode overrides a headless job often needs.

## What Changes

- The server half registers agent tools to list, create, update, archive and restore jobs. They use the same validation and storage as the dashboard, so jobs made by the agent show up in the Schedule tab at once.
- These tools exist only in interactive sessions; they are removed from sessions of an active job run (the mirror of how `job-result` is kept out of normal sessions).
- The tools are off by default so they do not take context in every session. A toggle in the Schedule tab's footer (wrench icon, `t`) turns them on for all sessions when needed.
- The tools are also unavailable (hidden and refused) when sandbox mode is enabled for the session's directory, so a sandboxed agent cannot schedule a job that runs outside its sandbox.
- A new skill `schedule-job` ships in this repo under `skills/schedule-job/`. It walks the agent through a question round with the `question` tool: name, folder, agent, model, schedule (cron, with plain-language help), maximum run time, enabled, and the job prompt (the job's instructions). It then asks for confirmation and calls the tools.
- The skill optionally drafts an `AUTO_MODE_INSTRUCTIONS.md` in `<job folder>/.opencode/` (the place auto-mode reads per project) so the headless run is not blocked by ask/deny decisions. It never overwrites an existing file without asking (append, replace or skip).
- The skill also covers editing an existing job (pick it, change chosen fields) and archiving/restoring.
- The skill is linked into `~/.config/opencode/skill/schedule-job` on install: from this repo, and by `build.sh` in the OpenCode config folder.

## Capabilities

### New Capabilities

- `job-agent-tools`: tools that let an interactive agent list, create, update, archive and restore scheduled jobs, with the same validation as the editor, and their visibility rules.
- `job-scheduling-skill`: the skill that guides the agent through the question round, the optional auto-mode instructions file, and confirming before changing anything; plus how it is installed.

### Modified Capabilities

- `schedule-tab`: a footer toggle (wrench icon, `t`) turns the agent job tools on or off.
- `job-store`: a `settings` table holds that toggle.

## Impact

- `src/schedule/server/setup.ts`: register the new tools and extend the context hook to hide them in run sessions.
- New server module for the tool definitions; `validate.ts` and `store.ts` reused as is.
- New `skills/schedule-job/SKILL.md` in this repo, an install step that symlinks it, and a change to `~/.config/opencode/build.sh` (separate repo, user commits).
- `OUTLINE.md` and `README.md`: document the tools and the skill.
- No schema change, no new dependencies.
