import { describe, expect, test } from "bun:test";
import { chooseView, cursorRuns, markersFor, monthWeeks, startOfWeek, stepCursor, viewFor, weekDays } from "./calendar.ts";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("calendar", () => {
  test("view choice", () => {
    expect(viewFor(2)).toBe("month");
    expect(viewFor(3)).toBe("week");
    expect(viewFor(4)).toBe("week");
    expect(viewFor(5)).toBe("today");
  });
  test("weeks start on monday", () => {
    expect(startOfWeek(local(2026, 11, 22)).getDate()).toBe(16); // Sunday 22nd -> Monday 16th
    expect(weekDays(local(2026, 11, 22)).map((d) => d.getDate())).toEqual([16, 17, 18, 19, 20, 21, 22]);
  });
  test("month weeks mid month", () => {
    const weeks = monthWeeks(local(2026, 11, 19));
    expect(weeks[0]![0]!.getDate()).toBe(26); // Mon 26 Oct holds Nov 1
    expect(weeks.at(-1)!.some((d) => d.getDate() === 30 && d.getMonth() === 10)).toBe(true);
    expect(weeks.length).toBe(6);
  });
  test("first week keeps the previous month's last week as first row", () => {
    const weeks = monthWeeks(local(2026, 11, 3));
    expect(weeks[0]![0]!.getDate()).toBe(26); // Mon 26 Oct - Sun 1 Nov: the last week of October
    expect(weeks.length).toBe(6);
  });
  test("first week adds the previous week when the 1st is a monday", () => {
    const weeks = monthWeeks(local(2026, 6, 3)); // 1 June 2026 is a Monday
    expect(weeks[0]![0]!.getMonth()).toBe(4); // May
    expect(weeks[0]![0]!.getDate()).toBe(25);
    expect(weeks[1]![0]!.getDate()).toBe(1);
  });
  test("view from frequency", () => {
    expect(chooseView("0 9 * * *", local(2026, 11, 19))).toBe("month");
    expect(chooseView("0 9,12,15 * * *", local(2026, 11, 19))).toBe("week");
    expect(chooseView("0 */4 * * *", local(2026, 11, 19))).toBe("today");
  });
  test("markers: outcome, future star, missing", () => {
    const day = local(2026, 11, 22);
    const now = local(2026, 11, 22, 12);
    const runs = [{ id: "r1", scheduledFor: local(2026, 11, 22, 8).getTime(), status: "succeeded" as const }];
    const m = markersFor(day, { expression: "0 8,10,18 * * *", runs, now, createdAt: local(2026, 11, 1).getTime(), scheduled: true });
    expect(m.map((x) => [x.time.getHours(), x.status])).toEqual([
      [8, "succeeded"],
      [10, "missing"],
      [18, "future"],
    ]);
  });
  test("markers: disabled has no future stars, missing only after creation", () => {
    const day = local(2026, 11, 22);
    const now = local(2026, 11, 22, 12);
    const m = markersFor(day, { expression: "0 8,18 * * *", runs: [], now, createdAt: local(2026, 11, 22, 9).getTime(), scheduled: false });
    expect(m).toEqual([]);
  });
  test("run cursor", () => {
    const runs = cursorRuns([
      { id: "b", scheduledFor: 2, status: "failed" as const },
      { id: "c", scheduledFor: 3, status: "claiming" as const },
      { id: "a", scheduledFor: 1, status: "succeeded" as const },
    ]);
    expect(runs.map((r) => r.id)).toEqual(["a", "b"]);
    expect(stepCursor(1, "older", 2)).toBe(0);
    expect(stepCursor(0, "older", 2)).toBe(0);
    expect(stepCursor(1, "newer", 2)).toBe(1);
  });
});
