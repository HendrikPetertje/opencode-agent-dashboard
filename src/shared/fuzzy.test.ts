import { describe, expect, test } from "bun:test";
import { fuzzyFilter, fuzzyScore } from "./fuzzy.ts";

describe("fuzzy", () => {
  const models = ["anthropic/claude-sonnet-5", "anthropic/claude-opus-5", "openai/gpt-5", "openai/gpt-5-mini", "google/gemini-2.5-pro", "github-copilot/claude-haiku-5"].map((label) => ({ label }));
  test("empty query keeps the order", () => {
    expect(fuzzyFilter(models, "").map((m) => m.label)).toEqual(models.map((m) => m.label));
    expect(fuzzyFilter(models, "   ").length).toBe(models.length);
  });
  test("substring and subsequence matches, others dropped", () => {
    expect(fuzzyFilter(models, "opus").map((m) => m.label)).toEqual(["anthropic/claude-opus-5"]);
    expect(fuzzyFilter(models, "gpt5").map((m) => m.label)).toContain("openai/gpt-5");
    expect(fuzzyFilter(models, "zzz")).toEqual([]);
    expect(fuzzyScore("xyz", "abc")).toBeUndefined();
  });
  test("every space-separated term must match", () => {
    expect(fuzzyFilter(models, "claude haiku").map((m) => m.label)).toEqual(["github-copilot/claude-haiku-5"]);
    expect(fuzzyFilter(models, "openai opus")).toEqual([]);
  });
  test("better matches come first", () => {
    const ranked = fuzzyFilter(models, "gpt").map((m) => m.label);
    expect(ranked[0]).toBe("openai/gpt-5");
    const claude = fuzzyFilter(models, "cla").map((m) => m.label);
    expect(claude.length).toBe(3);
  });
  test("case does not matter", () => {
    expect(fuzzyFilter(models, "SONNET").length).toBe(1);
  });
});
