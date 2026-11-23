import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JobInput } from "../shared/types.ts";
import { openDatabase } from "./db.ts";
import * as store from "./store.ts";

describe("store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dashboard-"));
  const path = join(dir, "dashboard.db");
  const db = await openDatabase(path);
  const job = (over: Partial<JobInput> = {}): JobInput => ({
    name: "Nightly",
    folder: "/tmp/x",
    agent: "build",
    model: null,
    timeoutMinutes: 30,
    enabled: true,
    prompt: "do it",
    cron: "0 2 * * *",
    ...over,
  });

  test("state dir", () => {
    expect(store.stateDir({ XDG_STATE_HOME: "/x" })).toBe("/x/opencode-dashboard");
    expect(store.databasePath({ XDG_STATE_HOME: "/x" })).toBe("/x/opencode-dashboard/dashboard.db");
  });
  test("jobs round trip, update, archive, restore", () => {
    const created = store.saveJob(db, job());
    expect(created.id).toHaveLength(27);
    expect(store.listJobs(db).map((j) => j.name)).toEqual(["Nightly"]);
    const updated = store.saveJob(db, { ...job({ name: "Renamed", enabled: false }), id: created.id });
    expect(updated.name).toBe("Renamed");
    expect(updated.enabled).toBe(false);
    store.saveJob(db, { ...job(), id: created.id });
    store.archiveJob(db, created.id);
    expect(store.listJobs(db)).toEqual([]);
    const archived = store.listJobs(db, { archived: true });
    expect(archived).toHaveLength(1);
    expect(archived[0]!.enabled).toBe(false);
    store.restoreJob(db, created.id);
    expect(store.listJobs(db)[0]!.enabled).toBe(false);
    store.purgeJob(db, created.id);
  });
  test("claims: oldest wins, ties go to the smaller id", () => {
    const j = store.saveJob(db, job({ name: "Claims" }));
    const slot = 1_000_000;
    const late = store.createClaim(db, j.id, slot, 5000);
    const early = store.createClaim(db, j.id, slot, 4000);
    expect(store.winningClaim(db, j.id, slot)!.id).toBe(early.id);
    const tieA = store.createClaim(db, j.id, 2_000_000, 7000);
    const tieB = store.createClaim(db, j.id, 2_000_000, 7000);
    expect(store.winningClaim(db, j.id, 2_000_000)!.id).toBe([tieA.id, tieB.id].sort()[0]!);
    store.deleteRun(db, late.id);
    expect(store.listRuns(db, { jobId: j.id }).map((r) => r.id)).not.toContain(late.id);
  });
  test("run lifecycle, last runs, sessions, cascade", () => {
    const j = store.saveJob(db, job({ name: "Life" }));
    const run = store.createClaim(db, j.id, 10_000, 10_000);
    store.markRunning(db, run.id, "ses_1", 10_500);
    expect(store.hasRunningRun(db, j.id)).toBe(true);
    expect(store.finishRun(db, run.id, "succeeded", "ok", 11_000)).toBe(true);
    expect(store.finishRun(db, run.id, "failed", "again", 12_000)).toBe(false);
    expect(store.lastRuns(db).get(j.id)!.status).toBe("succeeded");
    expect(store.sessionsOfJob(db, j.id)).toEqual(["ses_1"]);
    store.purgeJob(db, j.id);
    expect(store.listRuns(db, { jobId: j.id })).toEqual([]);
  });
  test("two connections can write at once", async () => {
    const other = await openDatabase(path);
    const j = store.saveJob(db, job({ name: "Concurrent" }));
    for (let i = 0; i < 50; i++) {
      store.createClaim(db, j.id, 100 + i, i);
      store.createClaim(other, j.id, 100 + i, i);
    }
    expect(store.listRuns(db, { jobId: j.id })).toHaveLength(100);
    other.close();
  });
  test("cleanup", () => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
