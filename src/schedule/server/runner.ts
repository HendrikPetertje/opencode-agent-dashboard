import { existsSync } from "node:fs";
import type { Db } from "./db.ts";
import { runsBetween } from "../shared/cron.ts";
import { limitMessage, REMINDER_MESSAGE, RESUME_MESSAGE } from "./prompts.ts";
import { DEFAULT_TIMEOUT_MINUTES, type Job } from "../shared/types.ts";
import * as store from "./store.ts";

export const TICK_MS = 15_000;
const CLAIM_WAIT_MS = 3000;
const GRACE_MS = 5 * 60_000;
const MINUTE = 60_000;

export interface SessionApi {
  create(input: { title: string; agent: string; model?: { providerID: string; id: string }; directory: string; metadata: Record<string, unknown> }): Promise<{ id: string }>;
  prompt(sessionID: string, text: string): Promise<void>;
  interrupt(sessionID: string): Promise<void>;
  /** The parent session, when the session is a subagent's. */
  parent(sessionID: string): Promise<string | undefined>;
  /** Whether the session is executing, idle (nothing running), or gone. */
  status(sessionID: string): Promise<"running" | "idle" | "missing">;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface RunnerDeps {
  db: Db;
  sessions: () => SessionApi | undefined;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timers?: Timers;
  emit?: () => void;
  log?: (message: string, data?: unknown) => void;
  folderExists?: (folder: string) => boolean;
  /** Called once for every run that ends (succeeded, failed or timed out). */
  finished?: (event: { runId: string; jobId: string; status: "succeeded" | "failed"; reason: string | null }) => void;
  claimWaitMs?: number;
  graceMs?: number;
}

interface Active {
  runId: string;
  jobId: string;
  timeoutMinutes: number;
  idles: number;
  limit?: unknown;
  grace?: unknown;
}

export interface PermissionEvent {
  sessionID: string;
  action: string;
  resources: readonly string[];
  effect: string;
  message?: string;
}

const floorMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

function parseModel(model: string | null): { providerID: string; id: string } | undefined {
  if (!model) return undefined;
  const at = model.indexOf("/");
  return at < 1 ? undefined : { providerID: model.slice(0, at), id: model.slice(at + 1) };
}

/** Starts due jobs, supervises their sessions and ends their runs. One per process. */
export class Runner {
  private readonly db: Db;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timers: Timers;
  private readonly emit: () => void;
  private readonly log: (message: string, data?: unknown) => void;
  private readonly folderExists: (folder: string) => boolean;
  private readonly onFinished: NonNullable<RunnerDeps["finished"]>;
  private readonly claimWaitMs: number;
  private readonly graceMs: number;
  private readonly sessions: () => SessionApi | undefined;
  private readonly active = new Map<string, Active>();
  private readonly roots = new Map<string, string | null>();
  private readonly handled = new Set<string>();
  private checkedUntil: number;
  private ticker: unknown;
  private started = false;

  constructor(deps: RunnerDeps) {
    this.db = deps.db;
    this.sessions = deps.sessions;
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timers = deps.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as any) };
    this.emit = deps.emit ?? (() => {});
    this.log = deps.log ?? (() => {});
    this.folderExists = deps.folderExists ?? existsSync;
    this.onFinished = deps.finished ?? (() => {});
    this.claimWaitMs = deps.claimWaitMs ?? CLAIM_WAIT_MS;
    this.graceMs = deps.graceMs ?? GRACE_MS;
    // Only slots after the start: slots that passed while OpenCode was not running are not caught up.
    this.checkedUntil = floorMinute(this.now()) + MINUTE;
  }

  /** Starts ticking and takes over runs that were still running when this process started. Safe to call twice. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.adopt().catch((error) => this.log("adopt failed", String(error)));
    this.ticker = this.timers.set(() => this.loop(), TICK_MS);
  }

  stop(): void {
    this.timers.clear(this.ticker);
    for (const run of this.active.values()) {
      this.timers.clear(run.limit);
      this.timers.clear(run.grace);
    }
    this.active.clear();
  }

  private loop(): void {
    void this.tick().catch((error) => this.log("tick failed", String(error)));
    this.ticker = this.timers.set(() => this.loop(), TICK_MS);
  }

  /**
   * Runs that were running when this process started (a restart, or a reload of the plugin): runs past their time
   * limit plus grace fail; the others get their timers back. A session that is idle was stopped by the restart, so
   * it is told to continue; one that is still executing is left alone.
   */
  async adopt(): Promise<void> {
    const now = this.now();
    for (const run of store.runningRuns(this.db)) {
      if (run.sessionId && this.active.has(run.sessionId)) continue;
      const job = store.getJob(this.db, run.jobId);
      const started = run.startedAt ?? run.createdAt;
      const budget = (job?.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES) * MINUTE + this.graceMs;
      if (!run.sessionId || !job || now - started > budget) {
        this.conclude(run.id, run.jobId, "failed", "timed out (OpenCode was not running)");
        continue;
      }
      const state = await this.sessions()?.status(run.sessionId).catch(() => "running" as const);
      if (state === "missing") {
        this.conclude(run.id, run.jobId, "failed", "the session no longer exists");
        continue;
      }
      this.track(run.sessionId, run.id, job.id, job.timeoutMinutes, Math.max(0, started + job.timeoutMinutes * MINUTE - now));
      if (state === "idle") {
        this.log("resuming run", { runId: run.id, sessionId: run.sessionId });
        try {
          await this.sessions()?.prompt(run.sessionId, RESUME_MESSAGE);
        } catch (error) {
          this.end(run.sessionId, "failed", `could not resume after a restart: ${(error as Error).message ?? error}`, false);
        }
      }
    }
  }

  /** Starts a claim for every enabled job with a time slot since the last tick. */
  async tick(): Promise<void> {
    const upTo = floorMinute(this.now()) + MINUTE;
    const from = this.checkedUntil;
    if (upTo <= from) return;
    this.checkedUntil = upTo;
    for (const job of store.listJobs(this.db)) {
      if (!job.enabled) continue;
      let slots: Date[];
      try {
        slots = runsBetween(job.cron, new Date(from), new Date(upTo));
      } catch {
        continue;
      }
      // After a long pause several slots can be due; only the most recent one runs.
      const slot = slots.at(-1);
      if (!slot) continue;
      const key = `${job.id}:${slot.getTime()}`;
      if (this.handled.has(key)) continue;
      this.handled.add(key);
      if (this.handled.size > 5000) this.handled.clear();
      void this.claim(job.id, slot.getTime()).catch((error) => this.log("claim failed", String(error)));
    }
  }

  /** Records a claim, waits, and starts the run only when this claim is the oldest for the slot. */
  async claim(jobId: string, slot: number): Promise<void> {
    if (store.hasRunningRun(this.db, jobId)) return;
    const claim = store.createClaim(this.db, jobId, slot, this.now());
    await this.sleep(this.claimWaitMs);
    const winner = store.winningClaim(this.db, jobId, slot);
    const job = store.getJob(this.db, jobId);
    if (winner?.id !== claim.id || !job || !job.enabled || job.archivedAt !== null || store.hasRunningRun(this.db, jobId)) {
      store.deleteRun(this.db, claim.id);
      this.emit();
      return;
    }
    await this.begin(claim.id, job);
  }

  private async begin(runId: string, job: Job): Promise<void> {
    const fail = (reason: string) => this.conclude(runId, job.id, "failed", reason);
    const api = this.sessions();
    if (!api) return fail("no OpenCode session API available");
    if (!this.folderExists(job.folder)) return fail(`folder does not exist: ${job.folder}`);
    let sessionID: string;
    try {
      const created = await api.create({
        title: job.name,
        agent: job.agent,
        model: parseModel(job.model),
        directory: job.folder,
        metadata: { dashboardJob: { runID: runId, jobID: job.id } },
      });
      sessionID = created.id;
    } catch (error) {
      return fail(`could not start the session: ${(error as Error).message ?? error}`);
    }
    store.markRunning(this.db, runId, sessionID, this.now());
    this.track(sessionID, runId, job.id, job.timeoutMinutes, job.timeoutMinutes * MINUTE);
    this.emit();
    try {
      await api.prompt(sessionID, job.prompt);
    } catch (error) {
      this.end(sessionID, "failed", `could not send the prompt: ${(error as Error).message ?? error}`, true);
    }
  }

  /** Records the end of a run and tells the listener, once. */
  private conclude(runId: string, jobId: string, status: "succeeded" | "failed", reason: string | null): void {
    if (!store.finishRun(this.db, runId, status, reason, this.now())) return;
    this.emit();
    try {
      this.onFinished({ runId, jobId, status, reason });
    } catch (error) {
      this.log("finished listener failed", String(error));
    }
  }

  private track(sessionID: string, runId: string, jobId: string, timeoutMinutes: number, limitInMs: number): void {
    const run: Active = { runId, jobId, timeoutMinutes, idles: 0 };
    run.limit = this.timers.set(() => void this.onLimit(sessionID), limitInMs);
    this.active.set(sessionID, run);
  }

  /** The active run of a session, or of its parent session when it is a subagent's. */
  async runOf(sessionID: string): Promise<{ sessionID: string; runId: string } | undefined> {
    const direct = this.active.get(sessionID);
    if (direct) return { sessionID, runId: direct.runId };
    if (this.active.size === 0) return undefined;
    let root = this.roots.get(sessionID);
    if (root === undefined) {
      try {
        let current: string = sessionID;
        for (let depth = 0; depth < 6; depth++) {
          const parent = await this.sessions()?.parent(current);
          if (!parent) break;
          current = parent;
        }
        root = current === sessionID ? null : current;
      } catch {
        root = null;
      }
      this.roots.set(sessionID, root);
    }
    const run = root ? this.active.get(root) : undefined;
    return run && root ? { sessionID: root, runId: run.runId } : undefined;
  }

  isActive(sessionID: string): boolean {
    return this.active.has(sessionID);
  }

  /** In a job session, a permission that is not allowed fails the run: nobody can answer it. */
  async onPermission(event: PermissionEvent): Promise<void> {
    if (event.effect === "allow") return;
    const run = await this.runOf(event.sessionID);
    if (!run) return;
    const reason = `permission ${event.effect === "ask" ? "needed" : "denied"}: ${event.action} ${event.resources.join(" ")}`.trim();
    event.effect = "deny";
    event.message = "This scheduled job run was stopped because it needed a permission that was not granted.";
    this.end(run.sessionID, "failed", reason, true);
  }

  /** Execution events of a job session: a stop without a report gets one reminder, then fails. */
  async onExecution(kind: "succeeded" | "failed" | "interrupted", sessionID: string, error?: string): Promise<void> {
    const run = this.active.get(sessionID);
    if (!run || kind === "interrupted") return;
    if (kind === "failed") return void this.end(sessionID, "failed", `execution failed: ${error ?? "unknown error"}`, false);
    run.idles += 1;
    if (run.idles > 1) return void this.end(sessionID, "failed", "no result reported", false);
    try {
      await this.sessions()?.prompt(sessionID, REMINDER_MESSAGE);
    } catch (e) {
      this.end(sessionID, "failed", `no result reported (${(e as Error).message ?? e})`, false);
    }
  }

  /** The job-result tool: ends the run and stops the session once the tool has returned. */
  report(sessionID: string, result: "succeeded" | "failed", message: string): boolean {
    if (!this.active.has(sessionID)) return false;
    this.end(sessionID, result, message || null, false, 100);
    return true;
  }

  private async onLimit(sessionID: string): Promise<void> {
    const run = this.active.get(sessionID);
    if (!run) return;
    this.log("time limit", { sessionID });
    const api = this.sessions();
    try {
      await api?.interrupt(sessionID);
    } catch (error) {
      this.log("interrupt failed", String(error));
    }
    if (!this.active.has(sessionID)) return;
    run.grace = this.timers.set(() => this.end(sessionID, "failed", "timed out, no result reported", true), this.graceMs);
    try {
      await api?.prompt(sessionID, limitMessage(run.timeoutMinutes, Math.round(this.graceMs / MINUTE)));
    } catch (error) {
      this.end(sessionID, "failed", "timed out, no result reported", true);
    }
  }

  /** Records the outcome, forgets the run and stops the session (now, or shortly after a tool result). */
  private end(sessionID: string, status: "succeeded" | "failed", reason: string | null, interruptNow: boolean, interruptAfterMs = 0): void {
    const run = this.active.get(sessionID);
    if (!run) return;
    this.timers.clear(run.limit);
    this.timers.clear(run.grace);
    this.active.delete(sessionID);
    this.conclude(run.runId, run.jobId, status, reason);
    const stop = () => void this.sessions()?.interrupt(sessionID).catch((error) => this.log("interrupt failed", String(error)));
    if (interruptNow) stop();
    else this.timers.set(stop, interruptAfterMs);
  }
}
