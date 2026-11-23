/** Server side of the schedule: database, runner, job-result tool, hooks and RPC. Loaded dynamically by index.ts. */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { codeVersion } from "./code-version.ts";
import { openDatabase, type Db } from "./db.ts";
import { parseOsNotifications } from "../../shared/options.ts";
import { describeFinished, osNotify, Presence, type Finished } from "./notify.ts";
import { log } from "./log.ts";
import { HEADLESS_INSTRUCTIONS, JOB_RESULT_DESCRIPTION } from "./prompts.ts";
import { Runner, type SessionApi } from "./runner.ts";
import * as store from "./store.ts";
import { parseJobInput } from "./validate.ts";
import { DashboardSchedule } from "../../rpc.ts";

const TOOL = "job-result";
const STATUS_WAIT_MS = 1500;
const KEY = Symbol.for("agent-dashboard.runtime");

interface Runtime {
  users: Set<any>;
  emitters: Set<() => void>;
  /** Sends a finished-run notice to the TUIs connected through one plugin instance. */
  finishers: Set<(notice: unknown) => void>;
  presence: Presence;
  /** Whether finished runs show an operating system notification when no TUI is open (the `osNotifications` option). */
  osNotifications: boolean;
  db: Db;
  runner: Runner;
  /** Version of the code this runtime was built with; a different one means the plugin was edited and reloaded. */
  version: string;
  seenEvents: Set<string>;
}

const VERSION = codeVersion(dirname(fileURLToPath(import.meta.url)));

const runtimeOf = (): Runtime | undefined => (globalThis as any)[KEY];

async function acquire(ctx: any, emit: () => void): Promise<Runtime> {
  let runtime = runtimeOf();
  // A hot reload loads this file again while the previous runtime still exists: rebuild it so new code is used.
  if (runtime && runtime.version !== VERSION) {
    runtime.runner.stop();
    runtime.db.close();
    log("runtime replaced after a reload");
    const carried = runtime;
    runtime = undefined;
    (globalThis as any)[KEY] = undefined;
    const fresh = await create();
    carried.users.forEach((user) => fresh.users.add(user));
    carried.emitters.forEach((fn) => fresh.emitters.add(fn));
    carried.finishers.forEach((fn) => fresh.finishers.add(fn));
    runtime = fresh;
  }
  runtime ??= await create();
  runtime.users.add(ctx);
  runtime.emitters.add(emit);
  // Started once a session API exists, because picking up running runs needs it.
  runtime.runner.start();
  return runtime;
}

async function create(): Promise<Runtime> {
  mkdirSync(store.stateDir(), { recursive: true });
  const db = await openDatabase(store.databasePath());
  log(`database opened with ${db.driver}`);
  const created: Runtime = {
    users: new Set(),
    emitters: new Set(),
    finishers: new Set(),
    presence: new Presence(),
    osNotifications: true,
    db,
    seenEvents: new Set(),
    version: VERSION,
    runner: undefined as unknown as Runner,
  };
  created.runner = new Runner({
    db,
    sessions: () => sessionApi(created.users.values().next().value),
    emit: () => created.emitters.forEach((fn) => fn()),
    finished: (event) => announce(created, event),
    log,
  });
  (globalThis as any)[KEY] = created;
  return created;
}

/** A run ended: a toast in every open TUI, or else (when enabled) an operating system notification. */
function announce(runtime: Runtime, event: { runId: string; jobId: string; status: "succeeded" | "failed"; reason: string | null }): void {
  const job = store.getJob(runtime.db, event.jobId);
  const run = store.getRun(runtime.db, event.runId);
  const finished: Finished = { ...event, jobName: job?.name ?? "Scheduled job", sessionId: run?.sessionId ?? null };
  const notice = describeFinished(finished);
  const tui = runtime.presence.any();
  log("finished", { job: finished.jobName, status: finished.status, tuiOpen: tui, toastTargets: runtime.finishers.size, osNotifications: runtime.osNotifications });
  if (tui) {
    runtime.finishers.forEach((send) => send(notice));
  } else if (runtime.osNotifications) {
    osNotify(notice);
  }
}

function release(ctx: any, emit: () => void): void {
  const runtime = runtimeOf();
  if (!runtime) return;
  runtime.users.delete(ctx);
  runtime.emitters.delete(emit);
  if (runtime.users.size > 0) return;
  runtime.runner.stop();
  runtime.db.close();
  delete (globalThis as any)[KEY];
  log("runtime stopped");
}

function sessionApi(ctx: any): SessionApi | undefined {
  if (!ctx) return undefined;
  return {
    create: async (input) => {
      const created = await ctx.session.create({
        title: input.title,
        agent: input.agent,
        ...(input.model ? { model: input.model } : {}),
        location: { directory: input.directory },
        metadata: input.metadata,
      } as any);
      return { id: String((created as any).id) };
    },
    prompt: async (sessionID, text) => void (await ctx.session.prompt({ sessionID, text } as any)),
    interrupt: async (sessionID) => void (await ctx.session.interrupt({ sessionID } as any)),
    parent: async (sessionID) => ((await ctx.session.get({ sessionID } as any)) as any)?.parentID ?? undefined,
    // `wait` returns once the session is idle, so an immediate return means nothing is executing.
    status: async (sessionID) => {
      try {
        await ctx.session.get({ sessionID } as any);
      } catch {
        return "missing";
      }
      const idle = ctx.session.wait({ sessionID } as any).then(() => true as const, () => true as const);
      return (await Promise.race([idle, new Promise<false>((resolve) => setTimeout(() => resolve(false), STATUS_WAIT_MS))])) ? "idle" : "running";
    },
  };
}


export async function setupSchedule(ctx: any): Promise<() => Promise<void>> {
  let registration: { events: { emit: (...args: any[]) => Promise<void> } } | undefined;
  const emit = () => void registration?.events.emit("changed" as any, {} as any).catch((error: unknown) => log("emit failed", String(error)));
  const runtime = await acquire(ctx, emit);
  // Always read the current runtime: a reload replaces it, and this instance may outlive the one it was built with.
  const cur = () => runtimeOf() ?? runtime;
  const db = () => cur().db;
  const runner = () => cur().runner;
  runtime.osNotifications = parseOsNotifications(ctx.options);
  const send = (notice: unknown) => void registration?.events.emit("finished" as any, notice as any).catch((error: unknown) => log("notify failed", String(error)));
  runtime.finishers.add(send);

  const changed = <T>(value: T): T => {
    cur().emitters.forEach((fn) => fn());
    return value;
  };
  const id = (input: any): string => {
    if (typeof input?.jobID !== "string" || !input.jobID) throw new Error("jobID is required");
    return input.jobID;
  };

  registration = (await ctx.rpc.register(DashboardSchedule, {
    jobs: async (input: any) => {
      const jobs = store.listJobs(db(), { archived: input?.archived === true });
      const last = store.lastRuns(db());
      return { jobs, lastRuns: Object.fromEntries(jobs.flatMap((job) => (last.has(job.id) ? [[job.id, last.get(job.id)]] : []))), now: Date.now() };
    },
    save: async (input: any) => changed({ job: store.saveJob(db(), parseJobInput(input?.job)) }),
    archive: async (input: any) => (store.archiveJob(db(), id(input)), changed({})),
    restore: async (input: any) => (store.restoreJob(db(), id(input)), changed({})),
    sessions: async (input: any) => ({ sessionIDs: store.sessionsOfJob(db(), id(input)) }),
    purge: async (input: any) => (store.purgeJob(db(), id(input)), changed({})),
    // Every TUI calls this regularly; while one is present a finished run shows a toast instead of a system notification.
    presence: async (input: any) => {
      if (typeof input?.id === "string" && input.id) {
        if (input.gone === true) {
          cur().presence.leave(input.id);
          log("tui left", { id: input.id });
        } else {
          if (!cur().presence.known(input.id)) log("tui present", { id: input.id });
          cur().presence.beat(input.id);
        }
      }
      return {};
    },
    runs: async (input: any) => ({
      runs: store.listRuns(db(), { jobId: id(input), from: typeof input?.from === "number" ? input.from : undefined, to: typeof input?.to === "number" ? input.to : undefined }),
    }),
  } as any)) as any;

  // The job-result tool; a session only gets it while its run is active (see the context hook below).
  const toolRegistration = await ctx.tool.transform((editor) => {
    if (editor.get(TOOL)) return;
    editor.add({
      name: TOOL,
      description: JOB_RESULT_DESCRIPTION,
      input: {
        type: "object",
        properties: {
          result: { type: "string", enum: ["succeeded", "failed"], description: "Whether the job succeeded or failed" },
          message: { type: "string", description: "A short message saying what happened" },
        },
        required: ["result", "message"],
        additionalProperties: false,
      },
      execute: async (input: any, context: any) => {
        const result = input?.result === "succeeded" ? "succeeded" : "failed";
        const message = typeof input?.message === "string" ? input.message : "";
        const accepted = runner().report(String(context.sessionID), result, message);
        return { content: accepted ? `Reported ${result}. This run is over and you are being stopped now.` : "This session is not an active job run, so nothing was reported." };
      },
    } as any);
  });

  const contextHook = await (ctx.session.hook as any)("context", (event: any) => {
    if (runner().isActive(String(event.sessionID))) {
      const system: any[] = event.system ?? [];
      if (!system.some((part) => typeof part?.text === "string" && part.text.includes("scheduled job in headless mode"))) {
        system.push({ type: "text", text: HEADLESS_INSTRUCTIONS });
      }
      return;
    }
    for (const name of Object.keys(event.tools ?? {})) if (name === TOOL || name.endsWith(`_${TOOL}`)) delete event.tools[name];
  });

  // Runs after auto-mode's hook when this plugin is listed after it, so the effect is already decided.
  const permissionHook = await ctx.permission.hook("evaluate", (event: any) => runner().onPermission(event));

  const abort = new AbortController();
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({
        types: ["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"],
        signal: abort.signal,
      } as any) as AsyncIterable<any>) {
        const seen = cur().seenEvents;
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        if (seen.size > 500) seen.clear();
        const kind = String(event.type).split(".").at(-1) as "succeeded" | "failed" | "interrupted";
        void runner().onExecution(kind, String(event.data?.sessionID), event.data?.error?.message).catch((error) => log("execution event failed", String(error)));
      }
    } catch (error) {
      if (!abort.signal.aborted) log("event subscription ended", String(error));
    }
  })();

  return async () => {
    abort.abort();
    await Promise.allSettled([toolRegistration, contextHook, permissionHook].map((r: any) => r?.dispose?.()));
    runtimeOf()?.finishers.delete(send);
    release(ctx, emit);
  };
}
