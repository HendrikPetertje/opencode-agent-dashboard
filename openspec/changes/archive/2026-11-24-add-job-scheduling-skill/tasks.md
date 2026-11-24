# Tasks

## 1. Shared job operations

- [x] 1.1 Extract list/save/archive/restore logic from the RPC handlers in `setup.ts` into a server module used by both RPC and tools
- [x] 1.2 Add partial update: merge given fields over the stored job, error on unknown ID
- [x] 1.3 Unit tests (temp database) for create, partial update, unknown ID, validation errors, archive, restore

## 2. Agent tools

- [x] 2.1 Register `schedule-job-list`, `-save`, `-archive`, `-restore` via `ctx.tool.transform`; return text results (job, next run times, or the error)
- [x] 2.2 Emit `changed` after every write so open dashboards refetch
- [x] 2.3 Extend the context hook: hide job tools in active run sessions, keep hiding `job-result` elsewhere; tests for both
- [x] 2.4 Add the sandbox guard (`globalThis.__opencodeSandboxMode.isSandboxed`, fail closed when present but unreadable): hide tools in the context hook and refuse in every `execute`; tests for absent / off / on / throwing
- [x] 2.5 Dispose the new registrations on reload
- [x] 2.6 Agent tools toggle: `settings` table migration, `agentTools` RPC, hide tools while off and refuse in `execute`; wrench toggle (`t`) in the Schedule tab footer; tests (server + test-ui)

## 3. Skill

- [x] 3.1 Write `skills/schedule-job/SKILL.md`: create/edit/archive/restore flows with the question tool, defaults, cron help, headless prompt rules, confirmation summary
- [x] 3.2 Add the optional `AUTO_MODE_INSTRUCTIONS.md` step (`<folder>/.opencode/`, show content, append/replace/skip if present)
- [x] 3.3 Tell the agent to stop and explain when the tools are missing or refuse because the session is sandboxed

## 4. Install

- [x] 4.1 Add `scripts/install-skill.sh` (idempotent symlink into `~/.config/opencode/skill/`, refuses foreign targets)
- [x] 4.2 Draft the `~/.config/opencode/build.sh` change that links `skills/*` of each submodule (user commits that repo)

## 5. Docs and checks

- [x] 5.1 Update `OUTLINE.md` (tools, hook rule, skill, install) and `README.md`
- [x] 5.2 `bun test ./src`, then a live check: create, edit and archive a job from a session and see it in the Schedule tab
