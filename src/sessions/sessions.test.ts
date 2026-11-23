import { describe, expect, test } from "bun:test";
import { applyLocalChanges, rootSessions } from "./sessions.ts";

describe("rootSessions", () => {
  const s = (id: string, updated: number, parentID?: string) => ({ id, parentID, time: { updated }, location: { directory: "/x" } });
  test("hides children and sorts newest first", () => {
    expect(rootSessions([s("a", 1), s("b", 3), s("c", 2, "b")]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("local changes", () => {
  const list = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }];
  test("removes and renames", () => {
    expect(applyLocalChanges(list, { b: true }, { c: "New" })).toEqual([{ id: "a", title: "A" }, { id: "c", title: "New" }]);
  });
  test("no changes keeps the list", () => {
    expect(applyLocalChanges(list, {}, {})).toEqual(list);
  });
});
