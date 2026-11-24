/** Job operations shared by the RPC handlers (dashboard) and the agent tools, so both follow the same rules. */
import type { Db } from "./db.ts";
import * as store from "./store.ts";
import { parseJobInput } from "./validate.ts";
import type { Job, Run } from "../shared/types.ts";

export function listJobs(db: Db, archived: boolean): { jobs: Job[]; lastRuns: Record<string, Run> } {
  const jobs = store.listJobs(db, { archived });
  const last = store.lastRuns(db);
  return { jobs, lastRuns: Object.fromEntries(jobs.flatMap((job) => (last.has(job.id) ? [[job.id, last.get(job.id)!]] : []))) };
}

/** Creates a job, or replaces every field of an existing one (the editor sends the whole job). */
export function saveJob(db: Db, raw: any): Job {
  return store.saveJob(db, parseJobInput(raw));
}

const FIELDS = ["name", "folder", "agent", "model", "timeoutMinutes", "enabled", "prompt", "cron"] as const;

/** Creates a job, or updates the given fields of an existing one and keeps the rest. Unknown IDs are an error. */
export function mergeJob(db: Db, raw: any): Job {
  const id = typeof raw?.id === "string" && raw.id ? raw.id : undefined;
  if (!id) return saveJob(db, raw);
  const existing = store.getJob(db, id);
  if (!existing) throw new Error(`No job with ID ${id}`);
  const merged: Record<string, unknown> = { id };
  for (const field of FIELDS) merged[field] = raw[field] !== undefined ? raw[field] : existing[field];
  return saveJob(db, merged);
}

export function archiveJob(db: Db, id: string): Job {
  requireJob(db, id);
  store.archiveJob(db, id);
  return store.getJob(db, id)!;
}

export function restoreJob(db: Db, id: string): Job {
  requireJob(db, id);
  store.restoreJob(db, id);
  return store.getJob(db, id)!;
}

function requireJob(db: Db, id: string): Job {
  const job = store.getJob(db, id);
  if (!job) throw new Error(`No job with ID ${id}`);
  return job;
}
