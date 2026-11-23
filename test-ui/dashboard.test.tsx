import { afterEach, expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { setCurrent } from "@opencode/plugin/tui";
import plugin from "/work/plugin/tui.tsx";

let setup: any;
afterEach(() => setup?.renderer.destroy());

const day = 86_400_000;
const now = Date.now();

// A tiny stand-in for the renderer's key handler: global listeners run in the order they were added.
const listeners: Record<string, ((event: any) => void)[]> = { keypress: [], paste: [] };
const keys = {
  on: (name: string, fn: (event: any) => void) => void listeners[name]!.push(fn),
  off: (name: string, fn: (event: any) => void) => void (listeners[name] = listeners[name]!.filter((f) => f !== fn)),
};
const press = (name = "x", type: "keypress" | "paste" = "keypress") => {
  const event = { name, prevented: false, stopped: false, defaultPrevented: false, preventDefault() { this.prevented = true; this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
  for (const fn of [...listeners[type]!]) fn(event);
  return event;
};

test("the dashboard opens, shows sessions, and its Schedule tab shows jobs", async () => {
  const claims: any[] = [];
  const layers: any[] = [];
  const toasts: any[] = [];
  const job = { id: "j1", name: "Nightly check", folder: "/x", agent: "build", model: null, timeoutMinutes: 30, enabled: true, archivedAt: null, prompt: "p", cron: "0 9 * * *", createdAt: now - 10 * day, updatedAt: now };
  const events: Record<string, (p: any) => void> = {};
  const presence: any[] = [];
  const ctx: any = {
    options: {},
    location: { directory: "/x" },
    theme: { text: { base: "#ffffff", muted: "#888888", feedback: { info: { base: "#9ccfd8" }, success: { base: "#0f0" }, error: { base: "#f00" }, warning: { base: "#ff0" } } }, background: { base: "#111111", raised: { high: "#222222" } } },
    renderer: { currentFocusedRenderable: undefined, keyInput: keys },
    data: {
      location: { default: () => ({ directory: "/x" }) },
      session: { list: () => [{ id: "s1", title: "First session", time: { updated: now }, location: { directory: "/x" } }], message: { sync: async () => {}, list: () => [] } },
    },
    client: {
      session: { list: async () => ({ data: [], cursor: {} }), remove: async () => {}, update: async () => {} },
      rpc: (def: any) =>
        def.id === "agent-dashboard"
          ? { config: async () => ({ sessionLimit: 200 }) }
          : { jobs: async () => ({ jobs: [job], lastRuns: {}, now }), runs: async () => ({ runs: [] }), presence: async (i: any) => (presence.push(i), {}), events: { on: (name: string, cb: any) => ((events[name] = cb), () => {}) } },
    },
    ui: {
      slot: (claim: any) => (claims.push(claim), () => {}),
      toast: { show: (t: any) => toasts.push(t) },
      dialog: { confirm: async () => true, prompt: async () => undefined, show() {}, set() {}, clear() {} },
      tabs: { enabled: () => true, focus() {} },
      router: { current: () => ({ type: "home" }), navigate() {} },
    },
    keymap: { layer: (f: any) => layers.push(f), mode: { push: () => () => {} }, shortcuts: () => [] },
  };
  setCurrent(ctx);
  const cleanup = await plugin.setup(ctx);
  expect(presence.length).toBeGreaterThan(0);
  const app = claims.find((c) => c.append === "app");
  expect(app).toBeDefined();
  // the open command is in the global layer
  const global = layers.map((f) => f()).find((l) => l.commands?.some((c: any) => c.id === "agent-dashboard.open"));
  setup = await testRender(() => app.render({}), { width: 140, height: 40 });
  await setup.renderOnce();
  expect(setup.captureCharFrame()).not.toContain("Sessions");
  expect(press("x").prevented).toBe(false); // closed: keys are left alone
  global.commands.find((c: any) => c.id === "agent-dashboard.open").run();
  await Bun.sleep(100);
  await setup.renderOnce();
  let f = setup.captureCharFrame() as string;
  console.log(f.split("\n").filter((l) => l.trim()).join("\n"));
  expect(f).toContain("Sessions");
  expect(f).toContain("Schedule");
  expect(f).toContain("First session");
  expect(f).toContain("tab switch");
  expect(f).not.toContain("not available yet");
  const dashboardLayer = layers.map((f) => f()).find((l) => l.mode === "agent-dashboard");
  // open: keys nobody handles are swallowed, so they cannot reach the prompt or other shortcuts; pastes too
  const stray = press("x");
  expect(stray.prevented).toBe(true);
  expect(stray.stopped).toBe(true);
  expect(press("v", "paste").prevented).toBe(true);
  // h and l no longer move between tabs on the Sessions tab
  expect(dashboardLayer.commands.some((c: any) => (c.bind === "h" || c.bind === "l") && (!c.enabled || c.enabled()))).toBe(false);
  // switch to the schedule tab with the "2" key command of the dashboard layer
  dashboardLayer.commands.find((c: any) => c.bind === "2").run();
  await Bun.sleep(150);
  await setup.renderOnce();
  f = setup.captureCharFrame() as string;
  console.log(f.split("\n").filter((l) => l.trim()).join("\n"));
  expect(f).toContain("Nightly check");
  expect(f).toContain("Next run");
  expect(f).toContain("Mon");
  expect(f).toContain("e edit");
  // on the Schedule tab h and l switch panes
  expect(dashboardLayer.commands.some((c: any) => c.bind === "h" && c.enabled && c.enabled())).toBe(true);
  // a finished-run event becomes a toast, once
  const notice = { runId: "r1", title: "Nightly check: succeeded", message: "ok", variant: "success", sessionId: "ses_1" };
  events.finished!({ type: "rpc.agent-dashboard.schedule.finished", data: notice });
  events.finished!({ type: "rpc.agent-dashboard.schedule.finished", data: notice });
  expect(toasts).toHaveLength(1);
  expect(toasts[0]).toMatchObject({ title: "Nightly check: succeeded", sessionID: "ses_1", variant: "success" });
  cleanup?.();
});
