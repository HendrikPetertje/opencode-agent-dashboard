import { describe, expect, test } from "bun:test";
import { ellipsize, ellipsizeStart, folderLabel, formatDate } from "./text.ts";

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
