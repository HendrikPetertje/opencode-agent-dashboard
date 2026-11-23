/** Job and run shapes shared by the server (database) and the TUI (type-only imports), plus the run time limits. */

export type RunStatus = "claiming" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  name: string;
  folder: string;
  agent: string;
  /** `providerID/modelID`, or null for the agent's own model. */
  model: string | null;
  timeoutMinutes: number;
  enabled: boolean;
  archivedAt: number | null;
  prompt: string;
  cron: string;
  createdAt: number;
  updatedAt: number;
}

export type JobInput = Omit<Job, "id" | "archivedAt" | "createdAt" | "updatedAt"> & { id?: string };

export interface Run {
  id: string;
  jobId: string;
  scheduledFor: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  status: RunStatus;
  reason: string | null;
  sessionId: string | null;
}

export const DEFAULT_TIMEOUT_MINUTES = 30;
export const MAX_TIMEOUT_MINUTES = 1440;
