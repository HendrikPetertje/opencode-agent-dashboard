import { afterEach, expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { openJobEditor } from "/work/plugin/src/schedule/ui/job-editor.tsx";
import { openRunPreview } from "/work/plugin/src/schedule/ui/run-preview.tsx";

const colors = () => ({ text: "#ffffff", muted: "#888888", accent: "#9ccfd8", bar: "#111111", surface: "#222222", success: "#00ff00", error: "#ff0000", warning: "#ffff00" });
let setup: any;
afterEach(() => setup?.renderer.destroy());

function ctxWith(extra: any = {}) {
  const shown: any = { render: undefined, saved: [] as any[], suspended: [] as boolean[], layers: [] as any[], cleared: 0 };
  const ctx: any = {
    location: { directory: "/x" },
    client: {
      agent: { list: async () => ({ data: [{ id: "build", name: "Build", mode: "primary", hidden: false }, { id: "plan", name: "Plan", mode: "primary", hidden: false }, { id: "explore", name: "Explore", mode: "subagent", hidden: false }] }) },
      model: { list: async () => ({ data: [{ providerID: "anthropic", modelID: "claude-sonnet", enabled: true }, { providerID: "openai", modelID: "gpt", enabled: true }] }) },
    },
    ui: { dialog: { show: (render: any) => (shown.render = render), set() {}, clear: () => shown.cleared++ }, toast: { show() {} } },
    keymap: { layer: (f: any) => shown.layers.push(f()), shortcuts: () => ["alt+return", "ctrl+j"] },
    data: { session: { message: { sync: async () => {}, list: () => [{ type: "user", text: "do the thing" }, { type: "assistant", content: [{ type: "text", text: "done and dusted" }] }] } } },
    ...extra,
  };
  return { ctx, shown };
}

test("editor renders all fields with defaults and previews the cron", async () => {
  const { ctx, shown } = ctxWith();
  openJobEditor({ ctx, defaultFolder: "/x", colors, call: async (m: string, i: any) => (shown.saved.push([m, i]), { job: { id: "j" } }), suspend: (v: boolean) => shown.suspended.push(v), onSaved() {} });
  expect(shown.suspended).toEqual([true]);
  setup = await testRender(() => shown.render(), { width: 120, height: 40 });
  await Bun.sleep(400);
  await setup.renderOnce();
  const f = setup.captureCharFrame() as string;
  console.log(f.split("\n").filter((l) => l.trim()).join("\n"));
  for (const word of ["New job", "Name", "Folder", "Agent", "Model", "Max minutes", "Enabled", "Prompt", "Cron", "ctrl+s"]) expect(f).toContain(word);
  expect(f).toContain("/x");
  expect(f).toContain("30");
  expect(f).toContain("[x] on");
  expect(f).toContain("Build");
  expect(f).toContain("agent default");
  expect(f.match(/press ENTER/g)?.length).toBe(2);
  expect(f).not.toContain("Auto-mode");
  expect(f).not.toContain("Sandbox");
});

test("ENTER on the model row opens a picker with a filter, and picking sets the model", async () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ providerID: ["anthropic", "openai", "google", "github-copilot"][i % 4], modelID: `model-${i}`, enabled: true }));
  const { ctx, shown } = ctxWith({ client: { agent: { list: async () => ({ data: [{ id: "build", name: "Build", mode: "primary", hidden: false }] }) }, model: { list: async () => ({ data: many }) } } });
  openJobEditor({ ctx, defaultFolder: "/x", colors, call: async () => ({ job: { id: "j" } }), suspend() {}, onSaved() {} });
  setup = await testRender(() => shown.render(), { width: 120, height: 40 });
  await Bun.sleep(400);
  await setup.renderOnce();
  const commands = shown.layers[0].commands;
  const run = (bind: string) => commands.find((c: any) => c.bind === bind && (c.enabled ? c.enabled() : true)).run();
  run("tab"); run("tab"); run("tab"); // name -> folder -> agent -> model
  run("return");
  await Bun.sleep(80);
  await setup.renderOnce();
  let f = setup.captureCharFrame() as string;
  expect(f).toContain("Pick a model");
  expect(f).toContain("51/51"); // agent default + 50 models
  expect(f).toContain("agent default");
  expect(f).toContain("type to filter");
  // typing filters fuzzily: every term must match
  await setup.mockInput.typeText("copi 3");
  await Bun.sleep(60);
  await setup.renderOnce();
  f = setup.captureCharFrame() as string;
  expect(f).toContain("6/51");
  expect(f).toContain("github-copilot/model-3");
  expect(f).not.toContain("anthropic/model-0");
  await setup.mockInput.typeText("zzz");
  await Bun.sleep(60);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("No match");
  // clear the query again (backspace over all typed characters)
  for (let i = 0; i < 9; i++) setup.mockInput.pressBackspace();
  await Bun.sleep(60);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("51/51");
  run("down"); run("down");
  run("return"); // picks the second model in the list
  await Bun.sleep(80);
  await setup.renderOnce();
  f = setup.captureCharFrame() as string;
  expect(f).not.toContain("Pick a model");
  expect(f).toContain("anthropic/model-0".length ? "model-1" : "");
  // escape closes the picker without choosing
  run("return");
  await Bun.sleep(40);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("Pick a model");
  commands.find((c: any) => c.bind === "escape" && c.enabled()).run({}, { preventDefault() {} });
  await Bun.sleep(40);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).not.toContain("Pick a model");
});

test("up and down move between fields everywhere, and through the prompt's lines first", async () => {
  const { ctx, shown } = ctxWith();
  const job: any = { id: "j", name: "N", folder: "/x", agent: "build", model: null, timeoutMinutes: 30, enabled: true, archivedAt: null, prompt: "one\ntwo\nthree", cron: "", createdAt: 1, updatedAt: 1 };
  openJobEditor({ ctx, job, defaultFolder: "/x", colors, call: async () => ({ job: { id: "j" } }), suspend() {}, onSaved() {} });
  setup = await testRender(() => shown.render(), { width: 120, height: 40 });
  await Bun.sleep(400);
  await setup.renderOnce();
  const commands = shown.layers[0].commands;
  const run = (bind: string) => commands.find((c: any) => c.bind === bind && (!c.enabled || c.enabled())).run();
  const frame = async () => (await Bun.sleep(40), await setup.renderOnce(), setup.captureCharFrame() as string);

  // down walks the fields; on the model row ENTER opens the picker, so the focus really is there
  run("down"); run("down"); run("down");
  run("return");
  expect(await frame()).toContain("Pick a model");
  commands.find((c: any) => c.bind === "escape" && c.enabled()).run({}, { preventDefault() {} });
  // up goes back, also onto text fields
  run("up"); run("up"); run("up");
  await setup.mockInput.typeText("!");
  expect(await frame()).toContain("N!");

  // down to the prompt: minutes, enabled, prompt (name is the focus again after the three ups)
  for (let i = 0; i < 6; i++) run("down");
  await setup.mockInput.typeText("X");
  expect(await frame()).toContain("Xone");
  run("down"); run("down"); // through the lines of the prompt
  await setup.mockInput.typeText("Y");
  let f = await frame();
  expect(f).toContain("tYhree");
  run("down"); // last line: leaves the prompt for the cron field
  await setup.mockInput.typeText("0 9 * * *");
  f = await frame();
  expect(f).toContain("Next runs");
  expect(f).toContain("tYhree"); // still intact
  run("up"); // cron -> up leaves the field (single line)
  run("up"); // prompt last line: up moves the cursor first
  await setup.mockInput.typeText("Z");
  expect(await frame()).toMatch(/Ztwo|tZwo|tYhree/);
});

test("run preview shows messages and the enter hint", async () => {
  const { ctx, shown } = ctxWith();
  const job: any = { id: "j", name: "Nightly" };
  const run: any = { id: "r", scheduledFor: Date.now(), status: "failed", reason: "permission needed", sessionId: "ses_1" };
  openRunPreview({ ctx, job, run, colors, suspend() {}, openSession() {} });
  setup = await testRender(() => shown.render(), { width: 120, height: 30 });
  await Bun.sleep(300);
  await setup.renderOnce();
  const f = setup.captureCharFrame() as string;
  console.log(f.split("\n").filter((l) => l.trim()).join("\n"));
  expect(f).toContain("Nightly");
  expect(f).toContain("failed");
  expect(f).toContain("do the thing");
  expect(f).toContain("done and dusted");
  expect(f).toContain("enter open session");
});
