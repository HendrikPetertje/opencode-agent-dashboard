import { describe, expect, test } from "bun:test";
import { newId } from "./id.ts";

describe("ids", () => {
  test("27 chars, sortable, unique", () => {
    const ids = Array.from({ length: 500 }, newId);
    expect(new Set(ids).size).toBe(500);
    expect(ids.every((id) => id.length === 27)).toBe(true);
  });
  test("later ids sort after earlier ones", async () => {
    const a = newId();
    await new Promise((r) => setTimeout(r, 1100));
    expect(newId() > a).toBe(true);
  });
});
