import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codeVersion, pluginRoot } from "./code-version.ts";

describe("codeVersion", () => {
  const root = mkdtempSync(join(tmpdir(), "code-version-"));
  const deep = join(root, "src", "schedule", "server");
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(join(root, "index.ts"), "");
  writeFileSync(join(deep, "a.ts"), "");
  const at = (file: string, seconds: number) => utimesSync(file, seconds, seconds);
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test("finds the plugin root from any folder below it", () => {
    expect(pluginRoot(deep)).toBe(root);
    expect(pluginRoot(root)).toBe(root);
  });
  test("touching a file in a subfolder changes the version", () => {
    at(join(root, "index.ts"), 1000);
    at(join(deep, "a.ts"), 1000);
    const before = codeVersion(deep);
    at(join(deep, "a.ts"), 2000);
    expect(codeVersion(deep)).not.toBe(before);
  });
  test("a new file in a new subfolder counts", () => {
    const before = codeVersion(deep);
    mkdirSync(join(root, "src", "new"), { recursive: true });
    writeFileSync(join(root, "src", "new", "b.tsx"), "");
    at(join(root, "src", "new", "b.tsx"), 5000);
    expect(codeVersion(deep)).not.toBe(before);
  });
  test("tests and node_modules are ignored", () => {
    const before = codeVersion(deep);
    writeFileSync(join(deep, "a.test.ts"), "");
    at(join(deep, "a.test.ts"), 9000);
    mkdirSync(join(root, "src", "node_modules"), { recursive: true });
    writeFileSync(join(root, "src", "node_modules", "c.ts"), "");
    at(join(root, "src", "node_modules", "c.ts"), 9000);
    expect(codeVersion(deep)).toBe(before);
  });
  test("unknown when there is no plugin", () => {
    expect(codeVersion(tmpdir() + "/definitely-not-a-plugin-folder")).toBe("unknown");
  });
});
