import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { createSchedule } from "/work/plugin/src/schedule/ui/schedule-tab.tsx";

const day = 86_400_000;
const now = Date.now();
const at = (daysAgo: number, hour: number) => {
  const d = new Date(now - daysAgo * day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

function fixture(cronA = "0 9 * * *") {
  const jobs = [
    { id: "j1", name: "Nightly dependency check", folder: "/x", agent: "build", model: null, timeoutMinutes: 30, enabled: true, archivedAt: null, prompt: "p", cron: cronA, createdAt: now - 30 * day, updatedAt: now },
    { id: "j2", name: "Weekly report", folder: "/x", agent: "build", model: null, timeoutMinutes: 30, enabled: false, archivedAt: null, prompt: "p", cron: "0 8 * * 1", createdAt: now - 30 * day, updatedAt: now },
  ];
  const runs = [
    { id: "r1", jobId: "j1", scheduledFor: at(3, 9), createdAt: at(3, 9), startedAt: at(3, 9), finishedAt: at(3, 9) + 1000, status: "succeeded", reason: "ok", sessionId: "ses_1" },
    { id: "r2", jobId: "j1", scheduledFor: at(2, 9), createdAt: at(2, 9), startedAt: at(2, 9), finishedAt: at(2, 9) + 1000, status: "failed", reason: "permission needed: bash", sessionId: "ses_2" },
  ];
  return { jobs, runs, lastRuns: { j1: runs[1] } };
}

function makeCtx(data: ReturnType<typeof fixture>, shown: any[] = []) {
  const calls: any[] = [];
  const ctx: any = {
    location: { directory: "/x" },
    data: { location: { default: () => ({ directory: "/x" }) } },
    client: {
      rpc: () => ({
        jobs: async (input: any) => (calls.push(["jobs", input]), { jobs: input?.archived ? [] : data.jobs, lastRuns: data.lastRuns, now }),
        runs: async (input: any) => (calls.push(["runs", input]), { runs: data.runs.filter((r) => r.jobId === input.jobID) }),
        archive: async (input: any) => (calls.push(["archive", input]), {}),
        agentTools: async (input: any) => (calls.push(["agentTools", input]), (data as any).tools = typeof input?.enabled === "boolean" ? input.enabled : !!(data as any).tools, { enabled: (data as any).tools }),
        events: { on: () => () => {} },
      }),
    },
    ui: {
      toast: { show: (t: any) => shown.push(t) },
      dialog: { confirm: async () => true, show: (render: any) => shown.push({ dialog: render }), set() {}, clear() {} },
    },
    keymap: { layer() {}, shortcuts: () => [] },
  };
  return { ctx, calls };
}

const colors = () => ({ text: "#ffffff", muted: "#888888", accent: "#9ccfd8", bar: "#111111", surface: "#222222", success: "#00ff00", error: "#ff0000", warning: "#ffff00" });

let setup: any;
afterEach(() => setup?.renderer.destroy());

async function mount(data = fixture(), small = false) {
  const { ctx, calls } = makeCtx(data);
  let schedule: ReturnType<typeof createSchedule>;
  const App = () => {
    schedule = createSchedule({ ctx, active: () => true, small: () => small, colors, directory: () => "/x", openSession() {}, suspend() {} });
    return (
      <box width={120} height={40} flexDirection="column">
        <schedule.Tab />
      </box>
    );
  };
  setup = await testRender(() => <App />, { width: 120, height: 40 });
  await Bun.sleep(80);
  await setup.renderOnce();
  return { frame: () => setup.captureCharFrame() as string, schedule: schedule!, calls, rerender: async () => (await Bun.sleep(40), await setup.renderOnce()) };
}

describe("schedule tab", () => {
  test("lists jobs with columns, outcome symbols and next run", async () => {
    const { frame } = await mount();
    const f = frame();
    console.log(f);
    expect(f).toContain("Title");
    expect(f).toContain("Last run");
    expect(f).toContain("Next run");
    expect(f).toContain("Nightly dependency check");
    expect(f).toContain("Weekly report");
    expect(f).toContain("✗");
    expect(f).toContain("disabled");
  });
  test("calendar shows weekday headers, run markers and the selected job", async () => {
    const { frame } = await mount();
    const f = frame();
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) expect(f).toContain(d);
    expect(f).toContain("09:00");
    expect(f).toContain("✓");
    expect(f).toContain("0 9 * * *");
    expect(f).toContain("month");
  });
  test("agent tools toggle in the footer, off by default", async () => {
    const { frame, schedule, rerender, calls } = await mount();
    expect(frame()).toContain("agent tools OFF (t)");
    schedule.commands.find((c) => c.bind === "t")!.run();
    await rerender();
    expect(calls).toContainEqual(["agentTools", { enabled: true }]);
    expect(frame()).toContain("agent tools ON (t)");
  });
  test("keys: pane switch and run cursor", async () => {
    const { frame, schedule, rerender } = await mount();
    const key = (name: string) => schedule.commands.find((c) => c.bind === name && (c.enabled ? c.enabled() : true))!;
    key("right").run();
    await rerender();
    expect(schedule.legend()).toContain("↑/↓ runs");
    expect(frame()).toContain("permission needed");
    key("up").run();
    await rerender();
    expect(frame()).toContain("succeeded · ok");
    key("left").run();
    await rerender();
    expect(schedule.legend()).toContain("e edit");
  });
  test("busy jobs switch to the week and today views", async () => {
    const week = await mount(fixture("0 9,12,15 * * *"));
    expect(week.frame()).toContain("week");
    setup.renderer.destroy();
    const today = await mount(fixture("0 */4 * * *"));
    expect(today.frame()).toContain("Today");
  });
  test("archive view, new job and run preview open from their keys", async () => {
    const data = fixture();
    const shown: any[] = [];
    const { ctx, calls } = makeCtx(data, shown);
    let schedule: any;
    const App = () => {
      schedule = createSchedule({ ctx, active: () => true, small: () => false, colors, directory: () => "/x", openSession() {}, suspend() {} });
      return <box width={120} height={30}><schedule.Tab /></box>;
    };
    setup = await testRender(() => <App />, { width: 120, height: 30 });
    await Bun.sleep(80);
    await setup.renderOnce();
    const run = (bind: string) => schedule.commands.find((c: any) => c.bind === bind && (c.enabled ? c.enabled() : true)).run();
    run("a");
    expect(shown.some((s) => s.dialog)).toBe(true);
    shown.length = 0;
    run("right");
    run("return");
    expect(shown.some((s) => s.dialog)).toBe(true);
    run("left");
    run("shift+a");
    await Bun.sleep(60);
    await setup.renderOnce();
    expect(calls.some((c) => c[0] === "jobs" && c[1].archived === true)).toBe(true);
    const f = setup.captureCharFrame() as string;
    expect(f).toContain("Archive");
    expect(f).toContain("The archive is empty.");
    expect(schedule.legend()).toContain("A back");
  });
  test("small terminals show one pane at a time", async () => {
    const { frame, schedule, rerender } = await mount(fixture(), true);
    expect(frame()).not.toContain("Mon");
    schedule.commands.find((c) => c.bind === "right")!.run();
    await rerender();
    expect(frame()).toContain("Mon");
  });
  test("empty list explains how to add a job", async () => {
    const { frame } = await mount({ jobs: [], runs: [], lastRuns: {} } as any);
    expect(frame()).toContain("No jobs yet");
  });
});
