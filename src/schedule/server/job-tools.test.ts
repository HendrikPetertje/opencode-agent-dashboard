import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./db.ts";
import { isTool, JOB_TOOLS, jobTools, SANDBOX_REFUSAL, sandboxed, TOOLS_OFF } from "./job-tools.ts";

const dir = mkdtempSync(join(tmpdir(), "job-tools-"));
const folder = mkdtempSync(join(tmpdir(), "job-tools-folder-"));
const db = await openDatabase(join(dir, "dashboard.db"));
afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  rmSync(folder, { recursive: true, force: true });
});

let changes = 0;
let sandbox = false;
let enabled = true;
const tools = Object.fromEntries(
  jobTools({ db: () => db, changed: () => void changes++, directoryOf: async () => folder, sandboxed: () => sandbox, enabled: () => enabled }).map((tool) => [tool.name, tool]),
);
const call = async (name: string, input: unknown) => (await tools[name]!.execute(input, { sessionID: "ses_1" })).content as string;
const idOf = (text: string) => /id: (\S+)/.exec(text)![1]!;
const job = { name: "Nightly", folder, agent: "build", cron: "0 9 * * *", timeoutMinutes: 30, enabled: true, prompt: "do it" };

describe("job tools", () => {
  test("fixed names in a fixed order", () => {
    expect(Object.keys(tools)).toEqual([...JOB_TOOLS]);
  });

  test("create, list, partial update, archive, restore", async () => {
    expect(await call("schedule-job-list", {})).toBe("No scheduled jobs.");
    const created = await call("schedule-job-save", job);
    expect(created).toStartWith("Saved.");
    expect(created).toContain("model: (agent default)");
    const id = idOf(created);

    const updated = await call("schedule-job-save", { id, cron: "30 7 * * 1-5" });
    expect(updated).toContain("cron: 30 7 * * 1-5");
    expect(updated).toContain("name: Nightly");
    expect(updated).toContain("prompt:\ndo it");

    expect(await call("schedule-job-list", {})).toContain(`id: ${id}`);
    expect(await call("schedule-job-archive", { id })).toBe('Archived "Nightly".');
    expect(await call("schedule-job-list", {})).toBe("No scheduled jobs.");
    expect(await call("schedule-job-list", { archived: true })).toContain("enabled: false");
    expect(await call("schedule-job-restore", { id })).toContain("Restored");
    expect(changes).toBe(4);
  });

  test("errors come back as text and change nothing", async () => {
    const before = changes;
    expect(await call("schedule-job-save", { ...job, folder: join(folder, "missing") })).toBe("Error: The folder does not exist");
    expect(await call("schedule-job-save", { id: "nope", cron: "* * * * *" })).toBe("Error: No job with ID nope");
    expect(await call("schedule-job-archive", { id: "nope" })).toBe("Error: No job with ID nope");
    expect(changes).toBe(before);
  });

  test("refuses while the toggle is off", async () => {
    enabled = false;
    try {
      expect(await call("schedule-job-list", {})).toBe(TOOLS_OFF);
    } finally {
      enabled = true;
    }
  });

  test("refuses in a sandboxed session", async () => {
    sandbox = true;
    try {
      const before = changes;
      expect(await call("schedule-job-save", job)).toBe(SANDBOX_REFUSAL);
      expect(await call("schedule-job-list", {})).toBe(SANDBOX_REFUSAL);
      expect(changes).toBe(before);
    } finally {
      sandbox = false;
    }
  });
});

describe("sandboxed", () => {
  test("no sandbox-mode plugin: not sandboxed", () => expect(sandboxed("/x", {})).toBe(false));
  test("off and on", () => {
    expect(sandboxed("/x", { __opencodeSandboxMode: { isSandboxed: () => false } })).toBe(false);
    expect(sandboxed("/x", { __opencodeSandboxMode: { isSandboxed: () => true } })).toBe(true);
  });
  test("fails closed when the answer is unclear", () => {
    expect(sandboxed("/x", { __opencodeSandboxMode: {} })).toBe(true);
    expect(sandboxed("/x", { __opencodeSandboxMode: { isSandboxed: () => undefined } })).toBe(true);
    expect(sandboxed("/x", { __opencodeSandboxMode: { isSandboxed: () => { throw new Error("x"); } } })).toBe(true);
  });
});

test("isTool matches namespaced names", () => {
  expect(isTool("schedule-job-save", JOB_TOOLS)).toBe(true);
  expect(isTool("ns_schedule-job-save", JOB_TOOLS)).toBe(true);
  expect(isTool("schedule-job-saver", JOB_TOOLS)).toBe(false);
});
