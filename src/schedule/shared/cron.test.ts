import { describe, expect, test } from "bun:test";
import { matchesCron, nextRuns, runsBetween, validateCron } from "./cron.ts";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("cron", () => {
  test("validates five-field expressions", () => {
    expect(validateCron("0 9 * * 1-5")).toBeUndefined();
    expect(validateCron("*/15 * * * *")).toBeUndefined();
    expect(validateCron("")).toBeDefined();
    expect(validateCron("not a cron")).toBeDefined();
    expect(validateCron("0 0 9 * * *")).toBeDefined();
  });
  test("next runs", () => {
    const runs = nextRuns("0 9 * * 1-5", 3, local(2026, 11, 20, 10));
    expect(runs.map((d) => [d.getMonth() + 1, d.getDate(), d.getHours()])).toEqual([
      [11, 23, 9],
      [11, 24, 9],
      [11, 25, 9],
    ]);
  });
  test("runs between is inclusive/exclusive", () => {
    const runs = runsBetween("0 * * * *", local(2026, 11, 22, 10), local(2026, 11, 22, 13));
    expect(runs.map((d) => d.getHours())).toEqual([10, 11, 12]);
  });
  test("match", () => {
    expect(matchesCron("30 8 * * *", local(2026, 11, 22, 8, 30))).toBe(true);
    expect(matchesCron("30 8 * * *", local(2026, 11, 22, 8, 31))).toBe(false);
  });
});
