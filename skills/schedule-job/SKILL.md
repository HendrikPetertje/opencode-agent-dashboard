---
name: schedule-job
description: Create, edit, archive or restore a scheduled job of the agent-dashboard plugin from this session, by asking the user questions. Use when the user wants to schedule a recurring agent task, change a scheduled job, or says "schedule a job", "new job", "edit job". Optionally writes AUTO_MODE_INSTRUCTIONS.md for the job's folder.
---

# Schedule a job

Scheduled jobs run an agent headless in a folder on a cron schedule (agent-dashboard plugin). You manage them with
these tools: `schedule-job-list`, `schedule-job-save`, `schedule-job-archive`, `schedule-job-restore`.

## Before anything

- If the tools are not available, or a tool says they are turned off: tell the user to open the dashboard
  (`<leader>h`), go to the Schedule tab and press `t` (agent tools ON), then ask again. They are off by default.
- If a tool answers that sandbox mode is on: stop. Tell the user jobs cannot be
  scheduled from a sandboxed session (a job runs outside the sandbox) and that they can use the dashboard
  (`<leader>h`, Schedule tab) or a session without sandbox mode. Do not look for another way to create the job.
- Ask every question with the `question` tool. Offer options where there is a known set; the user can always type
  their own answer. Group related questions in one call when they do not depend on each other.
- Never call `schedule-job-save`, `-archive` or `-restore` before the user confirmed the summary (step 4).

## 1. What to do

Call `schedule-job-list` first, then ask: create a new job, edit a job, archive a job, or restore an archived job
(use `archived: true` to list those). For edit/archive/restore, offer the jobs by name as options.

- **Archive / restore**: show the job, confirm, call the tool. Restored jobs come back disabled; offer to enable it.
- **Edit**: ask which fields to change (multiple choice), ask only those, then go to step 4. Send only the
  changed fields with the job's `id`; omitted fields keep their value.

## 2. Fields for a new job

| Field | Ask | Default |
|---|---|---|
| `name` | short, recognisable in a list and a toast | suggest one from the goal |
| `folder` | absolute path the job runs in | the current directory |
| `agent` | offer the agents you know are configured (`build`, `plan`, custom ones) | `build` |
| `model` | `providerID/modelID`, or the agent's default | agent default (`null`) |
| `cron` | see "Schedule" | - |
| `timeoutMinutes` | maximum run time, 1 to 1440 | 30 |
| `enabled` | start right away, or save disabled | enabled |
| `prompt` | see step 3 | - |

**Schedule**: offer common choices (every hour, every day at 09:00, weekdays at 09:00, every Monday at 08:00) and
accept plain words. Turn the answer into a five-field cron expression in local time and show both, e.g.
"weekdays at 9 → `0 9 * * 1-5`". The save result lists the next runs; check they match what the user meant.

## 3. The job prompt

Ask what the job should achieve, then draft the prompt yourself. Look at the folder if that helps. The job runs
**headless**: no one answers questions and every permission prompt fails the run. Write the prompt so that it:

- states the goal, the steps and what "done" looks like;
- names the files, commands and sources to use; no ambiguity that would need a question;
- says what to do when something is missing or fails (report failure, do not improvise risky fixes);
- ends with reporting the outcome (the run gets a `job-result` tool and its own headless instructions; you do not
  need to explain those).

Show the draft and ask: use it, change it (then revise and ask again), or write it themselves.

## 4. Confirm and save

Show a summary of every field (cron with its plain-words meaning, full prompt) and ask to confirm. On yes, call
`schedule-job-save`. On a validation error, tell the user, ask for the fixed value and confirm again. Afterwards,
mention the job is visible in the dashboard's Schedule tab.

## 5. Auto-mode instructions (optional)

After saving a new job (or when the user asks), offer to write auto-mode instructions so auto-mode allows what the
job needs without prompting (a prompt fails a headless run). auto-mode reads `AUTO_MODE_INSTRUCTIONS.md` from the
nearest `.opencode/` folder, so the file is `<job folder>/.opencode/AUTO_MODE_INSTRUCTIONS.md`. Note it then applies
to every session in that folder, not only the job.

- If the user declines, write nothing.
- Read the existing file first. If it exists, show it and ask: append, replace or skip. Never overwrite without that
  answer.
- Draft short, scoped rules: the exact commands, folders and hosts the job needs, and that nothing beyond them is
  allowed. Do not grant broad rights ("allow all shell commands"). Show the text and get approval before writing.
- Write it with your normal file tools. If the write is denied (for example by sandbox mode's config lock), tell
  the user and stop; do not retry another way.
