import { describe, expect, test } from "bun:test";
import { moveIndex, neighbourAfterRemoval } from "./list.ts";

test("moveIndex clamps", () => {
  expect(moveIndex(0, -1, 5)).toBe(0);
  expect(moveIndex(4, 1, 5)).toBe(4);
  expect(moveIndex(2, 1, 5)).toBe(3);
  expect(moveIndex(0, 1, 0)).toBe(0);
  expect(moveIndex(3, -Infinity, 5)).toBe(0);
  expect(moveIndex(1, Infinity, 5)).toBe(4);
});

test("neighbourAfterRemoval picks the next row, or the previous one at the end", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  expect(neighbourAfterRemoval(list, 0)).toBe("b");
  expect(neighbourAfterRemoval(list, 1)).toBe("c");
  expect(neighbourAfterRemoval(list, 2)).toBe("b");
  expect(neighbourAfterRemoval([list[0]!], 0)).toBeUndefined();
});
