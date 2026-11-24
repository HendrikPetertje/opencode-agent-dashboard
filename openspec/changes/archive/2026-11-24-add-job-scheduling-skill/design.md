# Design

## Context

Jobs live in SQLite and only the server half touches them (`setup.ts`, `store.ts`, `validate.ts`). The server half already registers one tool, `job-result`, with `ctx.tool.transform` and uses `session.hook("context")` to remove it from sessions that are not active runs. auto-mode reads `AUTO_MODE_INSTRUCTIONS.md` from the global config dir and the nearest `.opencode/` (auto-mode `OUTLINE.md`, `src/documents.ts`). Skills are loaded from `~/.config/opencode/skill/`.

## Goals / Non-Goals

**Goals:** agent-driven job CRUD with the same rules as the editor; a skill that runs the conversation; optional per-folder auto-mode instructions.

**Non-Goals:** permanent deletion via tools; running a job now; editing global auto-mode instructions; changes to the runner, storage schema or TUI.

## Decisions

- **Plugin tools, not a CLI or direct SQLite.** Tools run in the server process, so they reuse `parseJobInput`, the store and the `changed` emitter, and the runner sees changes immediately. A CLI would have to open the DB itself and could not notify open dashboards. Tools: `schedule-job-list`, `schedule-job-save`, `schedule-job-archive`, `schedule-job-restore` (names final at implementation; prefix avoids clashes).
- **Shared code with the RPC handlers.** Move the bodies of the `jobs`/`save`/`archive`/`restore` RPC handlers into a small server module (e.g. `schedule/server/jobs-api.ts`) used by both the RPC and the tools, so behavior cannot drift.
- **Partial update by merge.** `save` with an ID loads the stored job, overlays the given fields, then runs `parseJobInput` on the result. Unknown ID is an error instead of creating a new job.
- **Visibility in the existing context hook.** Extend the hook: active run sessions lose the job tools (they keep `job-result`); other sessions lose `job-result`. Name matching uses the same `name === X || name.endsWith("_" + X)` rule. Permission: tools go through OpenCode's normal permission flow, so auto-mode/user still approve writes.
- **Off by default, global toggle.** Alternatives: a real MCP server registered with `disabled: true` (rejected: separate process, so the sandbox check can't call sandbox-mode in-process and dashboard updates need polling) and a per-session toggle (rejected: the dashboard can be opened without a session). A `settings` row in the shared database is the source of truth. The tools are only registered (`ctx.tool.transform`) while it is on and the registration is disposed when it goes off: context-hook removals do not reach Code Mode catalogs, and only registry changes make OpenCode announce the change in sessions. Each instance re-reads the row every 5 s so other processes follow; every `execute` checks it again. Turning it on or off changes the tool list once for every session (one prompt-cache miss each), which is the price of not carrying the tools permanently.
- **Sandbox guard.** sandbox-mode publishes `globalThis.__opencodeSandboxMode.isSandboxed(directory)` (auto-mode already relies on it). A helper `sandboxed(directory)` returns false when that global is absent, the result when it is a boolean, and true when the call throws or returns anything else (fail closed). The context hook removes the job tools for sandboxed sessions, and every tool's `execute` checks again (the user can toggle the sandbox mid-session; Code Mode catalogs may still list tools). Rationale: a job runs in its own folder with that folder's sandbox/auto-mode, so creating one is a sandbox escape. The skill's `AUTO_MODE_INSTRUCTIONS.md` write is already blocked by sandbox-mode's config lock on `.opencode`; the skill should say so and stop instead of retrying.
- **Agent and model lists.** The skill asks the agent to use what it can already see (configured agents, `opencode models` or the Code Mode model search) to build options; the tools do not need a separate listing endpoint. Validation of the agent name stays at run time as today.
- **Skill content is instructions only.** `skills/schedule-job/SKILL.md` describes the question flow, the cron help, prompt-writing rules for headless runs (no questions, finish with `job-result`), and the auto-mode file rules. File writes for `AUTO_MODE_INSTRUCTIONS.md` use the normal edit/write tools, so the user sees the diff and permissions apply.
- **Install by symlink.** A `scripts/install-skill.sh` in this repo links `skills/schedule-job` to `${XDG_CONFIG_HOME:-~/.config}/opencode/skill/schedule-job`, idempotent, refusing to replace anything that is not already our link. The config repo's `build.sh` calls it per submodule if present (generic: any submodule with `skills/*` gets linked), so other plugins can ship skills too.

## Risks / Trade-offs

- [Tools show in every session and Code Mode catalogs, adding prompt tokens] → short descriptions; detail lives in the skill.
- [Toggling sandbox mode mid-session changes the tool list, so the next request misses the prompt cache once] → accepted; toggles are rare. Keep tool registration order and descriptions fixed so the list is otherwise stable.
- [Agent creates a job without the user meaning to] → skill requires confirmation; tools are normal permission-checked writes.
- [Generated cron misread] → show cron with the next few run times (from `schedule/shared/cron.ts`) in the save result.
- [Auto-mode instructions too permissive] → skill tells the agent to keep rules scoped to the job's commands and folder, and to show the text first.

## Migration Plan

Additive. Rollback = remove the tools and the link; no data change.
