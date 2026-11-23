import { describe, expect, test } from "bun:test";
import { dayKey, formatTime, newlineBindings, symbolFor, weekdayName } from "./format.ts";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("schedule format", () => {
  test("symbols", () => {
    expect(symbolFor("succeeded")).toBe("✓");
    expect(symbolFor("failed")).toBe("✗");
    expect(symbolFor("future")).toBe("★");
    expect(symbolFor("missing")).toBe("?");
    expect(symbolFor("none")).toBe("?");
    expect(symbolFor("running", 0)).not.toBe(symbolFor("running", 1));
  });
  test("time and day names", () => {
    expect(formatTime(local(2026, 11, 22, 9, 5))).toBe("09:05");
    expect(weekdayName(local(2026, 11, 22))).toBe("Sun");
    expect(weekdayName(local(2026, 11, 23))).toBe("Mon");
    expect(dayKey(local(2026, 11, 22, 23))).toBe(dayKey(local(2026, 11, 22, 1)));
  });
  test("newline bindings follow the configured shortcuts", () => {
    expect(newlineBindings(["alt+return", "ctrl+j"])).toEqual([
      { name: "return", meta: true, action: "newline" },
      { name: "j", ctrl: true, action: "newline" },
    ]);
    expect(newlineBindings(["shift+enter"])[0]).toEqual({ name: "return", shift: true, action: "newline" });
    expect(newlineBindings(undefined).length).toBe(4);
    expect(newlineBindings(["???+"]).length).toBe(4);
  });
});
