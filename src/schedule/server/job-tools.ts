/** Agent tools to list, create, update, archive and restore jobs from an interactive session. */
import type { Db } from "./db.ts";
import * as api from "./jobs-api.ts";
import { nextRuns } from "../shared/cron.ts";
import type { Job, Run } from "../shared/types.ts";

export const JOB_TOOLS = ["schedule-job-list", "schedule-job-save", "schedule-job-archive", "schedule-job-restore"] as const;

export const SANDBOX_REFUSAL = "Jobs cannot be scheduled or changed from a session where sandbox mode is on: a job runs outside this sandbox.";

export const TOOLS_OFF = "The job tools are turned off. The user can turn them on in the dashboard's Schedule tab (t).";

/** Whether a tool name (possibly namespaced as `<ns>_<name>`) is one of the given tools. */
export const isTool = (name: string, tools: readonly string[]) => tools.some((tool) => name === tool || name.endsWith(`_${tool}`));

/**
 * Whether sandbox mode is on for a directory. No sandbox-mode plugin: false. Plugin loaded but no clear answer: true
 * (fail closed), because scheduling a job from a sandbox would let the agent run code outside it.
 */
export function sandboxed(directory: string | undefined, global: any = globalThis): boolean {
  const plugin = global.__opencodeSandboxMode;
  if (!plugin) return false;
  if (typeof plugin.isSandboxed !== "function") return true;
  try {
    const result = plugin.isSandboxed(directory);
    return typeof result === "boolean" ? result : true;
  } catch {
    return true;
  }
}

const time = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : "-");

export function describeJob(job: Job, last?: Run, now = new Date()): string {
  let upcoming: string[] = [];
  try {
    upcoming = job.enabled && !job.archivedAt ? nextRuns(job.cron, 3, now).map((date) => date.toLocaleString()) : [];
  } catch {}
  return [
    `id: ${job.id}`,
    `name: ${job.name}`,
    `folder: ${job.folder}`,
    `agent: ${job.agent}`,
    `model: ${job.model ?? "(agent default)"}`,
    `cron: ${job.cron}`,
    `timeoutMinutes: ${job.timeoutMinutes}`,
    `enabled: ${job.enabled}`,
    `archived: ${job.archivedAt ? time(job.archivedAt) : "no"}`,
    `next runs: ${upcoming.length ? upcoming.join(", ") : "none"}`,
    `last run: ${last ? `${last.status} ${time(last.finishedAt ?? last.startedAt ?? last.createdAt)}${last.reason ? ` (${last.reason})` : ""}` : "never"}`,
    `prompt:\n${job.prompt}`,
  ].join("\n");
}

const DESCRIPTIONS: Record<(typeof JOB_TOOLS)[number], string> = {
  "schedule-job-list": "Lists the scheduled jobs of the agent dashboard with all fields and their last run. Load the schedule-job skill before creating or changing jobs.",
  "schedule-job-save":
    "Creates a scheduled job (no id) or updates one (id; omitted fields keep their value). Only call after the user confirmed the summary. Returns the job or the validation error.",
  "schedule-job-archive": "Archives (and disables) a scheduled job by id. Its runs are kept. Only call after the user confirmed.",
  "schedule-job-restore": "Restores an archived scheduled job by id. It comes back disabled. Only call after the user confirmed.",
};

const ID_INPUT = {
  type: "object",
  properties: { id: { type: "string", description: "Job ID" } },
  required: ["id"],
  additionalProperties: false,
};

const INPUTS: Record<(typeof JOB_TOOLS)[number], object> = {
  "schedule-job-list": {
    type: "object",
    properties: { archived: { type: "boolean", description: "List archived jobs instead of active ones" } },
    additionalProperties: false,
  },
  "schedule-job-save": {
    type: "object",
    properties: {
      id: { type: "string", description: "ID of the job to update; omit to create" },
      name: { type: "string" },
      folder: { type: "string", description: "Absolute path of the folder the job runs in" },
      agent: { type: "string" },
      model: { type: ["string", "null"], description: "providerID/modelID, or null for the agent's default" },
      cron: { type: "string", description: "Five-field cron expression, local time" },
      timeoutMinutes: { type: "integer", minimum: 1, maximum: 1440 },
      enabled: { type: "boolean" },
      prompt: { type: "string", description: "The job's instructions, written to run headless" },
    },
    additionalProperties: false,
  },
  "schedule-job-archive": ID_INPUT,
  "schedule-job-restore": ID_INPUT,
};

export interface JobToolDeps {
  db: () => Db;
  /** Tells open dashboards that jobs changed. */
  changed: () => void;
  /** The directory of a session, to check sandbox mode. */
  directoryOf: (sessionID: string) => Promise<string | undefined>;
  sandboxed?: (directory: string | undefined) => boolean;
  /** The Schedule tab's tools toggle. */
  enabled: () => boolean;
}

/** Tool definitions in a fixed order with fixed descriptions, so the tool list (and the prompt cache) stays stable. */
export function jobTools(deps: JobToolDeps) {
  const isSandboxed = deps.sandboxed ?? ((directory) => sandboxed(directory));
  const run = async (name: (typeof JOB_TOOLS)[number], input: any): Promise<string> => {
    switch (name) {
      case "schedule-job-list": {
        const { jobs, lastRuns } = api.listJobs(deps.db(), input?.archived === true);
        if (!jobs.length) return input?.archived ? "No archived jobs." : "No scheduled jobs.";
        return jobs.map((job) => describeJob(job, lastRuns[job.id])).join("\n\n---\n\n");
      }
      case "schedule-job-save": {
        const job = api.mergeJob(deps.db(), input ?? {});
        deps.changed();
        return `Saved.\n${describeJob(job)}`;
      }
      case "schedule-job-archive": {
        const job = api.archiveJob(deps.db(), String(input?.id ?? ""));
        deps.changed();
        return `Archived "${job.name}".`;
      }
      case "schedule-job-restore": {
        const job = api.restoreJob(deps.db(), String(input?.id ?? ""));
        deps.changed();
        return `Restored "${job.name}" (disabled; enable it with schedule-job-save).`;
      }
    }
  };
  return JOB_TOOLS.map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    input: INPUTS[name],
    execute: async (input: any, context: any) => {
      if (!deps.enabled()) return { content: TOOLS_OFF };
      if (isSandboxed(await deps.directoryOf(String(context?.sessionID)))) return { content: SANDBOX_REFUSAL };
      try {
        return { content: await run(name, input) };
      } catch (error) {
        return { content: `Error: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  }));
}
