import { describe, expect, test } from "bun:test";
import { previewMessages } from "./messages.ts";

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
