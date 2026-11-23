import { homedir } from "node:os";
import { join } from "node:path";
import type { Db } from "./db.ts";
import type { Job, JobInput, Run } from "../shared/types.ts";
import { newId } from "./id.ts";

/** `$XDG_STATE_HOME/opencode-dashboard`, or `~/.local/state/opencode-dashboard`. */
export function stateDir(env: Record<string, string | undefined> = process.env): string {
  return join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "opencode-dashboard");
}
export const databasePath = (env?: Record<string, string | undefined>) => join(stateDir(env), "dashboard.db");

const toJob = (row: any): Job => ({
  id: row.id,
  name: row.name,
  folder: row.folder,
  agent: row.agent,
  model: row.model ?? null,
  timeoutMinutes: Number(row.timeout_minutes),
  enabled: !!row.enabled,
  archivedAt: row.archived_at ?? null,
  prompt: row.prompt,
  cron: row.cron,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

const toRun = (row: any): Run => ({
  id: row.id,
  jobId: row.job_id,
  scheduledFor: Number(row.scheduled_for),
  createdAt: Number(row.created_at),
  startedAt: row.started_at ?? null,
  finishedAt: row.finished_at ?? null,
  status: row.status,
  reason: row.reason ?? null,
  sessionId: row.session_id ?? null,
});

/** Active jobs, or archived ones, by name. */
export function listJobs(db: Db, options: { archived?: boolean } = {}): Job[] {
  const clause = options.archived ? "archived_at IS NOT NULL" : "archived_at IS NULL";
  return db.all(`SELECT * FROM jobs WHERE ${clause} ORDER BY lower(name), id`).map(toJob);
}

export function getJob(db: Db, id: string): Job | undefined {
  const row = db.get("SELECT * FROM jobs WHERE id = ?", id);
  return row ? toJob(row) : undefined;
}

/** Creates a job, or updates the one with `input.id`. */
export function saveJob(db: Db, input: JobInput, now = Date.now()): Job {
  const existing = input.id ? getJob(db, input.id) : undefined;
  const values = [
    input.name,
    input.folder,
    input.agent,
    input.model,
    input.timeoutMinutes,
    input.enabled ? 1 : 0,
    input.prompt,
    input.cron,
  ];
  if (existing) {
    db.run(
      `UPDATE jobs SET name = ?, folder = ?, agent = ?, model = ?, timeout_minutes = ?, enabled = ?, prompt = ?, cron = ?, updated_at = ? WHERE id = ?`,
      ...values,
      now,
      existing.id,
    );
    return getJob(db, existing.id)!;
  }
  const id = newId();
  db.run(
    `INSERT INTO jobs (name, folder, agent, model, timeout_minutes, enabled, prompt, cron, id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...values,
    id,
    now,
    now,
  );
  return getJob(db, id)!;
}

/** Archiving also disables the job; its runs stay. */
export function archiveJob(db: Db, id: string, now = Date.now()): void {
  db.run("UPDATE jobs SET archived_at = ?, enabled = 0, updated_at = ? WHERE id = ?", now, now, id);
}

/** Restoring brings the job back disabled. */
export function restoreJob(db: Db, id: string, now = Date.now()): void {
  db.run("UPDATE jobs SET archived_at = NULL, enabled = 0, updated_at = ? WHERE id = ?", now, id);
}

/** Deletes the job and, through the foreign key, its runs. */
export function purgeJob(db: Db, id: string): void {
  db.run("DELETE FROM jobs WHERE id = ?", id);
}

/** Session IDs linked to the runs of a job. */
export function sessionsOfJob(db: Db, jobId: string): string[] {
  return db.all<{ session_id: string }>("SELECT DISTINCT session_id FROM job_runs WHERE job_id = ? AND session_id IS NOT NULL", jobId).map((r) => r.session_id);
}

export function listRuns(db: Db, options: { jobId?: string; from?: number; to?: number } = {}): Run[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (options.jobId) (where.push("job_id = ?"), params.push(options.jobId));
  if (options.from !== undefined) (where.push("scheduled_for >= ?"), params.push(options.from));
  if (options.to !== undefined) (where.push("scheduled_for < ?"), params.push(options.to));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db.all(`SELECT * FROM job_runs ${clause} ORDER BY scheduled_for, created_at, id`, ...params).map(toRun);
}

export function getRun(db: Db, id: string): Run | undefined {
  const row = db.get("SELECT * FROM job_runs WHERE id = ?", id);
  return row ? toRun(row) : undefined;
}

/** The most recent run per job, for the list. */
export function lastRuns(db: Db): Map<string, Run> {
  const rows = db.all(
    `SELECT r.* FROM job_runs r WHERE r.status != 'claiming' AND r.id = (
       SELECT id FROM job_runs WHERE job_id = r.job_id AND status != 'claiming' ORDER BY scheduled_for DESC, created_at DESC, id DESC LIMIT 1)`,
  );
  return new Map(rows.map((row) => [(row as any).job_id as string, toRun(row)]));
}

export const runningRuns = (db: Db): Run[] => db.all("SELECT * FROM job_runs WHERE status = 'running' ORDER BY created_at").map(toRun);

export function hasRunningRun(db: Db, jobId: string): boolean {
  return !!db.get("SELECT 1 AS x FROM job_runs WHERE job_id = ? AND status = 'running' LIMIT 1", jobId);
}

/** Records a claim for a job's time slot. */
export function createClaim(db: Db, jobId: string, slot: number, now = Date.now()): Run {
  const id = newId();
  db.run("INSERT INTO job_runs (id, job_id, scheduled_for, created_at, status) VALUES (?, ?, ?, ?, 'claiming')", id, jobId, slot, now);
  return getRun(db, id)!;
}

/** The claim that wins a slot: the oldest, ties broken by ID order. */
export function winningClaim(db: Db, jobId: string, slot: number): Run | undefined {
  const row = db.get("SELECT * FROM job_runs WHERE job_id = ? AND scheduled_for = ? ORDER BY created_at ASC, id ASC LIMIT 1", jobId, slot);
  return row ? toRun(row) : undefined;
}

export function deleteRun(db: Db, id: string): void {
  db.run("DELETE FROM job_runs WHERE id = ?", id);
}

export function markRunning(db: Db, id: string, sessionId: string | null, now = Date.now()): void {
  db.run("UPDATE job_runs SET status = 'running', started_at = ?, session_id = ? WHERE id = ?", now, sessionId, id);
}

/** Ends a run that is still running; returns false when it already ended. */
export function finishRun(db: Db, id: string, status: "succeeded" | "failed", reason: string | null, now = Date.now()): boolean {
  return db.run("UPDATE job_runs SET status = ?, reason = ?, finished_at = ? WHERE id = ? AND status IN ('running', 'claiming')", status, reason, now, id).changes > 0;
}
