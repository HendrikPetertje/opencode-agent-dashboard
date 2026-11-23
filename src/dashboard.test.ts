import { describe, expect, test } from "bun:test";
import { ellipsize, ellipsizeStart, folderLabel, formatDate } from "./folder.ts";
import { modalLayout, SMALL_WIDTH } from "./layout.ts";
import { DEFAULT_SESSION_LIMIT, parseSessionLimit } from "./options.ts";
import { applyLocalChanges, moveIndex, neighbourAfterRemoval, previewMessages, rootSessions } from "./sessions.ts";

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

describe("folderLabel", () => {
  test("last two segments", () => {
    expect(folderLabel("/home/me/code/myrepo/ABC-12-fix")).toBe("myrepo/ABC-12-fix");
  });
  test("shallow paths", () => {
    expect(folderLabel("/repo")).toBe("repo");
    expect(folderLabel("/")).toBe("");
    expect(folderLabel(undefined)).toBe("");
  });
});

test("formatDate is zero padded", () => {
  expect(formatDate(new Date(2026, 0, 2, 3, 4).getTime())).toBe("2026-01-02 03:04");
});

describe("rootSessions", () => {
  const s = (id: string, updated: number, parentID?: string) => ({ id, parentID, time: { updated }, location: { directory: "/x" } });
  test("hides children and sorts newest first", () => {
    expect(rootSessions([s("a", 1), s("b", 3), s("c", 2, "b")]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("previewMessages", () => {
  test("keeps user and assistant text only, last N", () => {
    const messages = [
      { type: "user", text: "one" },
      { type: "system", text: "skip" },
      { type: "assistant", content: [{ type: "reasoning", text: "hmm" }, { type: "text", text: "two" }, { type: "tool" }] },
      { type: "assistant", content: [{ type: "tool" }] },
      { type: "user", text: "three" },
    ];
    expect(previewMessages(messages, 2)).toEqual([
      { role: "assistant", text: "two" },
      { role: "user", text: "three" },
    ]);
  });
  test("truncates long messages", () => {
    expect(previewMessages([{ type: "user", text: "x".repeat(50) }], 10, 10)[0]!.text).toBe(`${"x".repeat(10)}…`);
  });
});

test("moveIndex clamps", () => {
  expect(moveIndex(0, -1, 5)).toBe(0);
  expect(moveIndex(4, 1, 5)).toBe(4);
  expect(moveIndex(2, 1, 5)).toBe(3);
  expect(moveIndex(0, 1, 0)).toBe(0);
  expect(moveIndex(3, -Infinity, 5)).toBe(0);
  expect(moveIndex(1, Infinity, 5)).toBe(4);
});

test("ellipsize", () => {
  expect(ellipsize("short", 10)).toBe("short");
  expect(ellipsize("a long title here", 8)).toBe("a long …");
  expect(ellipsize("abc", 1)).toBe("…");
  expect(ellipsize("abc", 0)).toBe("");
});

test("ellipsizeStart keeps the end", () => {
  expect(ellipsizeStart("short", 10)).toBe("short");
  expect(ellipsizeStart("myrepo/ABC-12-fix-it", 8)).toBe("…-fix-it");
  expect(ellipsizeStart("abc", 1)).toBe("…");
});

test("parseSessionLimit", () => {
  expect(parseSessionLimit(undefined)).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: 50 })).toBe(50);
  expect(parseSessionLimit({ sessionLimit: 12.7 })).toBe(12);
  expect(parseSessionLimit({ sessionLimit: 0 })).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: "10" })).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: 10 ** 9 })).toBe(5000);
});

describe("local changes", () => {
  const list = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }];
  test("removes and renames", () => {
    expect(applyLocalChanges(list, { b: true }, { c: "New" })).toEqual([{ id: "a", title: "A" }, { id: "c", title: "New" }]);
  });
  test("no changes keeps the list", () => {
    expect(applyLocalChanges(list, {}, {})).toEqual(list);
  });
  test("neighbour after removal", () => {
    expect(neighbourAfterRemoval(list, 0)).toBe("b");
    expect(neighbourAfterRemoval(list, 1)).toBe("c");
    expect(neighbourAfterRemoval(list, 2)).toBe("b");
    expect(neighbourAfterRemoval([list[0]!], 0)).toBeUndefined();
  });
});
