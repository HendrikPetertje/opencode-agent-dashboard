import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Db } from "./db.ts";
import { Runner, type SessionApi, type Timers } from "./runner.ts";
import * as store from "./store.ts";
import type { JobInput } from "../shared/types.ts";

const MINUTE = 60_000;
const at = (h: number, min: number) => new Date(2026, 10, 22, h, min).getTime();

class FakeTimers implements Timers {
  now = 0;
  private items: { at: number; fn: () => void; id: number }[] = [];
  private next = 1;
  set(fn: () => void, ms: number) {
    const id = this.next++;
    this.items.push({ at: this.now + ms, fn, id });
    return id;
  }
  clear(handle: unknown) {
    this.items = this.items.filter((item) => item.id !== handle);
  }
  advance(ms: number) {
    const until = this.now + ms;
    for (;;) {
      this.items.sort((a, b) => a.at - b.at);
      const item = this.items[0];
      if (!item || item.at > until) break;
      this.items.shift();
      this.now = item.at;
      item.fn();
    }
    this.now = until;
  }
}

function fakeSessions(states: Record<string, "running" | "idle" | "missing"> = {}) {
  const calls = { created: [] as any[], prompts: [] as [string, string][], interrupts: [] as string[] };
  let n = 0;
  const api: SessionApi = {
    create: async (input) => {
      calls.created.push(input);
      return { id: `ses_${++n}` };
    },
    prompt: async (id, text) => void calls.prompts.push([id, text]),
    interrupt: async (id) => void calls.interrupts.push(id),
    parent: async (id) => (id.startsWith("child_") ? "ses_1" : undefined),
    status: async (id) => states[id] ?? "running",
  };
  return { api, calls };
}

const job = (over: Partial<JobInput> = {}): JobInput => ({
  name: "Job",
  folder: "/work",
  agent: "build",
  model: "anthropic/claude",
  timeoutMinutes: 30,
  enabled: true,
  prompt: "do the thing",
  cron: "0 9 * * *",
  ...over,
});

let db: Db;
beforeEach(async () => {
  db = await openDatabase(join(mkdtempSync(join(tmpdir(), "runner-")), "d.db"));
});

function make(options: { now?: number; sessions?: ReturnType<typeof fakeSessions>; database?: Db; folderExists?: boolean } = {}) {
  const timers = new FakeTimers();
  const sessions = options.sessions ?? fakeSessions();
  let now = options.now ?? at(8, 59);
  let emits = 0;
  const runner = new Runner({
    db: options.database ?? db,
    sessions: () => sessions.api,
    now: () => now,
    sleep: async () => {},
    timers,
    emit: () => void emits++,
    folderExists: () => options.folderExists ?? true,
    graceMs: 5 * MINUTE,
  });
  return { runner, timers, sessions, setNow: (v: number) => (now = v), emits: () => emits };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("scheduling and claims", () => {
  test("a due job starts a session with the job's settings", async () => {
    const created = store.saveJob(db, job());
    const { runner, sessions, setNow } = make();
    setNow(at(9, 0));
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(1);
    expect(sessions.calls.created[0]).toMatchObject({
      title: "Job",
      agent: "build",
      model: { providerID: "anthropic", id: "claude" },
      directory: "/work",
      metadata: { dashboardJob: { jobID: created.id } },
    });
    expect(sessions.calls.prompts[0]).toEqual(["ses_1", "do the thing"]);
    const [run] = store.listRuns(db, { jobId: created.id });
    expect(run!.status).toBe("running");
    expect(run!.sessionId).toBe("ses_1");
    expect(run!.scheduledFor).toBe(at(9, 0));
  });
  test("slots are not run twice and nothing runs before it is due", async () => {
    store.saveJob(db, job());
    const { runner, sessions, setNow } = make();
    await runner.tick();
    setNow(at(9, 0));
    await runner.tick();
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(1);
  });
  test("no catch-up for slots missed before start", async () => {
    store.saveJob(db, job());
    const { runner, sessions } = make({ now: at(9, 30) });
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(0);
  });
  test("disabled jobs do not run", async () => {
    store.saveJob(db, job({ enabled: false }));
    const { runner, sessions, setNow } = make();
    setNow(at(9, 0));
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(0);
  });
  test("a job is skipped while its previous run is still running", async () => {
    const j = store.saveJob(db, job({ cron: "* * * * *" }));
    const { runner, sessions, setNow } = make();
    setNow(at(9, 0));
    await runner.tick();
    await flush();
    setNow(at(9, 1));
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(1);
    expect(store.listRuns(db, { jobId: j.id })).toHaveLength(1);
  });
  test("two instances: only the oldest claim starts a session", async () => {
    store.saveJob(db, job());
    const other = await openDatabase((db as any).path ?? join(mkdtempSync(join(tmpdir(), "x-")), "o.db"));
    // same database for both runners: reopen the same file
    const shared = db;
    const a = make({ database: shared });
    const b = make({ database: shared, sessions: fakeSessions() });
    a.setNow(at(9, 0));
    b.setNow(at(9, 0));
    // both claim before either one checks
    const claimA = a.runner.tick();
    const claimB = b.runner.tick();
    await Promise.all([claimA, claimB]);
    await flush();
    other.close();
    expect(a.sessions.calls.created.length + b.sessions.calls.created.length).toBe(1);
    expect(store.listRuns(shared)).toHaveLength(1);
  });
  test("a claim is dropped when the job was disabled during the wait", async () => {
    const j = store.saveJob(db, job());
    const sessions = fakeSessions();
    const timers = new FakeTimers();
    const runner = new Runner({
      db,
      sessions: () => sessions.api,
      now: () => at(9, 0),
      sleep: async () => void store.saveJob(db, { ...job({ enabled: false }), id: j.id }),
      timers,
      folderExists: () => true,
    });
    await runner.claim(j.id, at(9, 0));
    expect(sessions.calls.created).toHaveLength(0);
    expect(store.listRuns(db)).toHaveLength(0);
  });
  test("a missing folder fails the run without a session", async () => {
    const j = store.saveJob(db, job());
    const { runner, sessions, setNow } = make({ folderExists: false });
    setNow(at(9, 0));
    await runner.tick();
    await flush();
    expect(sessions.calls.created).toHaveLength(0);
    const [run] = store.listRuns(db, { jobId: j.id });
    expect(run!.status).toBe("failed");
    expect(run!.reason).toContain("folder");
  });
});

async function started(over: Partial<JobInput> = {}) {
  const j = store.saveJob(db, job(over));
  const ctx = make();
  ctx.setNow(at(9, 0));
  await ctx.runner.tick();
  await flush();
  const run = () => store.listRuns(db, { jobId: j.id })[0]!;
  return { ...ctx, job: j, run };
}

describe("supervision", () => {
  test("job-result ends the run and stops the session", async () => {
    const { runner, sessions, run, timers } = await started();
    expect(runner.report("ses_1", "succeeded", "all good")).toBe(true);
    expect(run()).toMatchObject({ status: "succeeded", reason: "all good" });
    expect(runner.isActive("ses_1")).toBe(false);
    timers.advance(200);
    expect(sessions.calls.interrupts).toContain("ses_1");
    expect(runner.report("ses_1", "failed", "again")).toBe(false);
    expect(run().status).toBe("succeeded");
  });
  test("a permission that is not allowed fails the run, denies, and stops", async () => {
    const { runner, sessions, run } = await started();
    const event = { sessionID: "ses_1", action: "bash", resources: ["rm -rf /"], effect: "ask" } as any;
    await runner.onPermission(event);
    expect(event.effect).toBe("deny");
    expect(run().status).toBe("failed");
    expect(run().reason).toContain("bash");
    expect(sessions.calls.interrupts).toContain("ses_1");
  });
  test("allowed permissions and other sessions are left alone", async () => {
    const { runner, run } = await started();
    const allowed = { sessionID: "ses_1", action: "read", resources: ["x"], effect: "allow" } as any;
    await runner.onPermission(allowed);
    const other = { sessionID: "ses_99", action: "bash", resources: ["ls"], effect: "ask" } as any;
    await runner.onPermission(other);
    expect(other.effect).toBe("ask");
    expect(run().status).toBe("running");
  });
  test("a subagent's permission fails the parent's run", async () => {
    const { runner, run } = await started();
    const event = { sessionID: "child_1", action: "edit", resources: ["a.ts"], effect: "deny" } as any;
    await runner.onPermission(event);
    expect(run().status).toBe("failed");
  });
  test("stopping without a result: one reminder, then failure", async () => {
    const { runner, sessions, run } = await started();
    await runner.onExecution("succeeded", "ses_1");
    expect(sessions.calls.prompts.at(-1)![1]).toContain("job-result");
    expect(run().status).toBe("running");
    await runner.onExecution("succeeded", "ses_1");
    expect(run()).toMatchObject({ status: "failed", reason: "no result reported" });
  });
  test("the reminder can still lead to a result", async () => {
    const { runner, run } = await started();
    await runner.onExecution("succeeded", "ses_1");
    runner.report("ses_1", "failed", "could not finish");
    expect(run()).toMatchObject({ status: "failed", reason: "could not finish" });
  });
  test("a failed execution fails the run", async () => {
    const { runner, run } = await started();
    await runner.onExecution("failed", "ses_1", "boom");
    expect(run().reason).toContain("boom");
  });
  test("interrupted events are ignored", async () => {
    const { runner, run } = await started();
    await runner.onExecution("interrupted", "ses_1");
    expect(run().status).toBe("running");
  });
});

describe("time limit", () => {
  test("interrupts, asks for a report, then fails after the grace period", async () => {
    const { timers, sessions, run } = await started({ timeoutMinutes: 10 });
    timers.advance(10 * MINUTE + 1);
    await flush();
    expect(sessions.calls.interrupts).toEqual(["ses_1"]);
    expect(sessions.calls.prompts.at(-1)![1]).toContain("10 minutes");
    expect(sessions.calls.prompts.at(-1)![1]).toContain("5 minutes");
    expect(run().status).toBe("running");
    timers.advance(5 * MINUTE + 1);
    expect(run()).toMatchObject({ status: "failed", reason: "timed out, no result reported" });
  });
  test("a report during the grace period stands", async () => {
    const { timers, runner, run } = await started({ timeoutMinutes: 10 });
    timers.advance(10 * MINUTE + 1);
    await flush();
    runner.report("ses_1", "succeeded", "stashed and done");
    timers.advance(10 * MINUTE);
    expect(run()).toMatchObject({ status: "succeeded", reason: "stashed and done" });
  });
  test("a report before the limit cancels it", async () => {
    const { timers, runner, sessions } = await started({ timeoutMinutes: 10 });
    runner.report("ses_1", "succeeded", "quick");
    timers.advance(20 * MINUTE);
    await flush();
    expect(sessions.calls.prompts).toHaveLength(1);
  });
});

describe("restart", () => {
  function twoRuns() {
    const j = store.saveJob(db, job({ timeoutMinutes: 10 }));
    const stale = store.createClaim(db, j.id, at(7, 0), at(7, 0));
    store.markRunning(db, stale.id, "ses_old", at(7, 0));
    const fresh = store.createClaim(db, j.id, at(8, 55), at(8, 55));
    store.markRunning(db, fresh.id, "ses_new", at(8, 55));
    return { stale, fresh };
  }
  test("stale running runs fail, recent ones are adopted", async () => {
    const { stale, fresh } = twoRuns();
    const { runner } = make({ now: at(9, 0) });
    await runner.adopt();
    expect(store.getRun(db, stale.id)!.status).toBe("failed");
    expect(store.getRun(db, fresh.id)!.status).toBe("running");
    expect(runner.isActive("ses_new")).toBe(true);
    expect(runner.report("ses_new", "succeeded", "ok")).toBe(true);
  });
  test("an idle session is told to continue", async () => {
    const { fresh } = twoRuns();
    const sessions = fakeSessions({ ses_new: "idle" });
    const { runner } = make({ now: at(9, 0), sessions });
    await runner.adopt();
    expect(sessions.calls.prompts).toHaveLength(1);
    expect(sessions.calls.prompts[0]![0]).toBe("ses_new");
    expect(sessions.calls.prompts[0]![1]).toContain("restarted");
    expect(store.getRun(db, fresh.id)!.status).toBe("running");
  });
  test("a session that is still executing is left alone", async () => {
    twoRuns();
    const sessions = fakeSessions({ ses_new: "running" });
    const { runner } = make({ now: at(9, 0), sessions });
    await runner.adopt();
    expect(sessions.calls.prompts).toHaveLength(0);
    expect(runner.isActive("ses_new")).toBe(true);
  });
  test("a session that no longer exists fails the run", async () => {
    const { fresh } = twoRuns();
    const { runner } = make({ now: at(9, 0), sessions: fakeSessions({ ses_new: "missing" }) });
    await runner.adopt();
    expect(store.getRun(db, fresh.id)).toMatchObject({ status: "failed", reason: "the session no longer exists" });
    expect(runner.isActive("ses_new")).toBe(false);
  });
  test("a resumed run keeps its original time limit", async () => {
    twoRuns();
    const sessions = fakeSessions({ ses_new: "idle" });
    const { runner, timers } = make({ now: at(9, 0), sessions });
    await runner.adopt();
    // started 08:55 with 10 minutes: the limit is 5 minutes away, not 10
    timers.advance(5 * MINUTE + 1);
    await flush();
    expect(sessions.calls.interrupts).toEqual(["ses_new"]);
    expect(sessions.calls.prompts.at(-1)![1]).toContain("time allotted");
  });
  test("start picks up runs once and only once", async () => {
    twoRuns();
    const sessions = fakeSessions({ ses_new: "idle" });
    const { runner } = make({ now: at(9, 0), sessions });
    runner.start();
    runner.start();
    await flush();
    expect(sessions.calls.prompts).toHaveLength(1);
    runner.stop();
  });
});

describe("finished notifications", () => {
  function listener() {
    const events: any[] = [];
    return { events, finished: (e: any) => void events.push(e) };
  }
  async function startedWith(extra: Partial<Parameters<typeof make>[0]> = {}, finished?: (e: any) => void) {
    const j = store.saveJob(db, job({ timeoutMinutes: 10 }));
    const timers = new FakeTimers();
    const sessions = fakeSessions();
    let now = at(9, 0);
    const runner = new Runner({ db, sessions: () => sessions.api, now: () => now, sleep: async () => {}, timers, folderExists: () => true, graceMs: 5 * MINUTE, finished });
    await (runner as any).claim(j.id, at(9, 0));
    return { j, runner, timers, sessions, run: () => store.listRuns(db, { jobId: j.id })[0]! };
  }
  test("a reported success is announced once", async () => {
    const l = listener();
    const { runner, run, j } = await startedWith({}, l.finished);
    runner.report("ses_1", "succeeded", "all good");
    runner.report("ses_1", "failed", "again");
    expect(l.events).toEqual([{ runId: run().id, jobId: j.id, status: "succeeded", reason: "all good" }]);
  });
  test("failures and timeouts are announced", async () => {
    const l = listener();
    const { timers, run } = await startedWith({}, l.finished);
    timers.advance(10 * MINUTE + 1);
    await flush();
    timers.advance(5 * MINUTE + 1);
    expect(l.events).toHaveLength(1);
    expect(l.events[0]).toMatchObject({ runId: run().id, status: "failed", reason: "timed out, no result reported" });
  });
  test("a run that could not start is announced", async () => {
    const l = listener();
    const j = store.saveJob(db, job());
    const runner = new Runner({ db, sessions: () => fakeSessions().api, now: () => at(9, 0), sleep: async () => {}, timers: new FakeTimers(), folderExists: () => false, finished: l.finished });
    await (runner as any).claim(j.id, at(9, 0));
    expect(l.events).toHaveLength(1);
    expect(l.events[0].reason).toContain("folder");
  });
  test("a failing listener does not break the run", async () => {
    const { runner, run } = await startedWith({}, () => {
      throw new Error("boom");
    });
    runner.report("ses_1", "succeeded", "ok");
    expect(run().status).toBe("succeeded");
  });
});
