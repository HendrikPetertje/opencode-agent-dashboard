import { describe, expect, test } from "bun:test";
import { modalLayout, SMALL_WIDTH } from "./layout.ts";

describe("modalLayout", () => {
  test("regular terminals leave 4 rows and columns on each side", () => {
    expect(modalLayout(200, 50)).toEqual({ small: false, margin: 4, width: 192, height: 42 });
  });
  test("small terminals leave 2 on each side", () => {
    expect(modalLayout(SMALL_WIDTH, 30)).toEqual({ small: true, margin: 2, width: SMALL_WIDTH - 4, height: 26 });
  });
  test("never collapses below a minimum", () => {
    const l = modalLayout(10, 5);
    expect(l.width).toBeGreaterThanOrEqual(20);
    expect(l.height).toBeGreaterThanOrEqual(8);
  });
});
