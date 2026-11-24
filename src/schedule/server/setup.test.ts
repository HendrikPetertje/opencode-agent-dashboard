import { afterAll, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The RPC helper only exists inside OpenCode; the contract is just a plain definition here.
mock.module("@opencode/plugin/rpc", () => ({ Rpc: { define: (definition: unknown) => definition } }));

const state = mkdtempSync(join(tmpdir(), "setup-state-"));
const folder = mkdtempSync(join(tmpdir(), "setup-folder-"));
process.env.XDG_STATE_HOME = state;
const { setupSchedule } = await import("./setup.ts");

function fakeContext() {
  const registered: Record<string, any> = {};
  const hooks: Record<string, (event: any) => unknown> = {};
  const emitted: unknown[] = [];
  const disposable = { dispose: async () => {} };
  const transforms = { added: 0, disposed: 0 };
  const ctx: any = {
    options: {},
    transforms,
    rpc: {
      register: async (definition: any, handlers: any) => {
        registered[definition.id] = handlers;
        return { events: { emit: async (...args: unknown[]) => void emitted.push(args) } };
      },
    },
    tool: {
      transform: async (callback: (editor: any) => void) => {
        const names: string[] = [];
        callback({ get: () => undefined, add: (tool: any) => names.push(tool.name) });
        if (names.some((name) => name.startsWith("schedule-job-"))) transforms.added++;
        return { dispose: async () => void (names.some((name) => name.startsWith("schedule-job-")) && transforms.disposed++) };
      },
    },
    session: {
      hook: async (name: string, callback: (event: any) => unknown) => ((hooks[`session.${name}`] = callback), disposable),
      get: async () => ({}),
      create: async () => ({ id: "ses_1" }),
      prompt: async () => {},
      interrupt: async () => {},
      wait: async () => {},
    },
    permission: { hook: async (name: string, callback: (event: any) => unknown) => ((hooks[`permission.${name}`] = callback), disposable) },
    event: {
      subscribe: ({ signal }: { signal: AbortSignal }) =>
        (async function* () {
          await new Promise((resolve) => signal.addEventListener("abort", resolve));
        })(),
    },
  };
  return { ctx, registered, hooks, emitted };
}

const input = (over: Record<string, unknown> = {}) => ({
  job: { name: "Nightly", folder, agent: "build", model: "", timeoutMinutes: 30, enabled: true, prompt: "do it", cron: "0 9 * * *", ...over },
});

const { ctx, registered, hooks, emitted } = fakeContext();
const cleanup = await setupSchedule(ctx);
const schedule = registered["agent-dashboard.schedule"];
afterAll(async () => {
  await cleanup();
  rmSync(state, { recursive: true, force: true });
  rmSync(folder, { recursive: true, force: true });
});

test("registers the schedule RPC with every method", () => {
  expect(Object.keys(schedule).sort()).toEqual(["agentTools", "archive", "jobs", "presence", "purge", "restore", "runs", "save", "sessions"]);
});

test("agent tools are off by default and the toggle hides or shows them", async () => {
  const tools = () => ({ bash: {}, "schedule-job-list": {}, "x_schedule-job-save": {} });
  expect(await schedule.agentTools({})).toEqual({ enabled: false });
  expect(ctx.transforms).toEqual({ added: 0, disposed: 0 });
  const off = { sessionID: "ses_off", tools: tools(), system: [] as any[] };
  await hooks["session.context"]!(off);
  expect(Object.keys(off.tools)).toEqual(["bash"]);

  expect(await schedule.agentTools({ enabled: true })).toEqual({ enabled: true });
  expect(ctx.transforms).toEqual({ added: 1, disposed: 0 });
  const on = { sessionID: "ses_on", tools: tools(), system: [] as any[] };
  await hooks["session.context"]!(on);
  expect(Object.keys(on.tools)).toEqual(["bash", "schedule-job-list", "x_schedule-job-save"]);

  (globalThis as any).__opencodeSandboxMode = { isSandboxed: () => true };
  try {
    const sandboxed = { sessionID: "ses_sandboxed", tools: tools(), system: [] as any[] };
    await hooks["session.context"]!(sandboxed);
    expect(Object.keys(sandboxed.tools)).toEqual(["bash"]);
  } finally {
    delete (globalThis as any).__opencodeSandboxMode;
    await schedule.agentTools({ enabled: false });
  }
  expect(ctx.transforms).toEqual({ added: 1, disposed: 1 });
});

test("jobs, save, runs, archive, restore, sessions and purge work against the real store", async () => {
  expect(await schedule.jobs({})).toMatchObject({ jobs: [], lastRuns: {} });
  const { job } = await schedule.save(input());
  expect(job).toMatchObject({ name: "Nightly", folder, enabled: true });
  const listed = await schedule.jobs({ archived: false });
  expect(listed.jobs.map((j: any) => j.id)).toEqual([job.id]);
  expect((await schedule.runs({ jobID: job.id })).runs).toEqual([]);
  expect((await schedule.sessions({ jobID: job.id })).sessionIDs).toEqual([]);

  await schedule.archive({ jobID: job.id });
  expect((await schedule.jobs({})).jobs).toEqual([]);
  const archived = (await schedule.jobs({ archived: true })).jobs;
  expect(archived).toHaveLength(1);
  expect(archived[0].enabled).toBe(false);

  await schedule.restore({ jobID: job.id });
  expect((await schedule.jobs({})).jobs[0]).toMatchObject({ id: job.id, enabled: false });

  await schedule.purge({ jobID: job.id });
  expect((await schedule.jobs({})).jobs).toEqual([]);
  expect((await schedule.jobs({ archived: true })).jobs).toEqual([]);
  expect(emitted.length).toBeGreaterThan(0);
});

test("saving validates the job", async () => {
  await expect(schedule.save(input({ name: "" }))).rejects.toThrow("name");
  await expect(schedule.save(input({ cron: "nonsense" }))).rejects.toThrow("Cron");
  await expect(schedule.save(input({ folder: join(folder, "missing") }))).rejects.toThrow("folder");
  await expect(schedule.archive({})).rejects.toThrow("jobID");
});

test("presence calls are accepted", async () => {
  expect(await schedule.presence({ id: "tui-1" })).toEqual({});
  expect(await schedule.presence({ id: "tui-1", gone: true })).toEqual({});
  expect(await schedule.presence({})).toEqual({});
});

test("normal sessions lose the job-result tool, and permission checks pass through", async () => {
  const event = { sessionID: "ses_normal", tools: { "job-result": {}, bash: {} }, system: [] as any[] };
  await hooks["session.context"]!(event);
  expect(Object.keys(event.tools)).toEqual(["bash"]);
  expect(event.system).toEqual([]);
  const permission = { sessionID: "ses_normal", action: "bash", resources: ["ls"], effect: "ask" };
  await hooks["permission.evaluate"]!(permission);
  expect(permission.effect).toBe("ask");
});
