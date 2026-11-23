/**
 * Keeps the folder structure honest (see OUTLINE.md): which code may import which. Only relative imports and
 * package names are checked, tests are skipped.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = ["index.ts", "tui.tsx", ...walk(join(root, "src")).map((file) => relative(root, file))];

interface Import {
  from: string;
  spec: string;
  /** The imported file for relative imports, relative to the plugin root. */
  target?: string;
}

const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function importsOf(file: string): Import[] {
  const source = readFileSync(join(root, file), "utf8");
  return [...source.matchAll(IMPORT)].map((match) => {
    const spec = match[1]!;
    return { from: file, spec, target: spec.startsWith(".") ? relative(root, resolve(root, dirname(file), spec)) : undefined };
  });
}

const all = files.flatMap(importsOf);
const under = (path: string | undefined, prefix: string) => !!path && (path === prefix || path.startsWith(`${prefix}/`));
const offenders = (list: Import[]) => list.map((item) => `${item.from} imports ${item.spec}`);

const server = (file: string) => file === "index.ts" || under(file, "src/schedule/server");
const scheduleShared = (file: string) => under(file, "src/schedule/shared");
const shared = (file: string) => under(file, "src/shared");
const tui = (file: string) => file === "tui.tsx" || under(file, "src/dashboard") || under(file, "src/sessions") || under(file, "src/schedule/ui");

describe("architecture", () => {
  test("every source file lives in a known place", () => {
    const known = ["index.ts", "tui.tsx", "src/rpc.ts"];
    const strays = files.filter((file) => !known.includes(file) && !["src/shared", "src/dashboard", "src/sessions", "src/schedule/shared", "src/schedule/ui", "src/schedule/server"].some((dir) => under(file, dir)));
    expect(strays).toEqual([]);
  });

  test("src/shared knows nothing about the features", () => {
    const bad = all.filter((i) => shared(i.from) && (under(i.target, "src/dashboard") || under(i.target, "src/sessions") || under(i.target, "src/schedule")));
    expect(offenders(bad)).toEqual([]);
  });

  test("schedule/shared is pure: no UI, database or Node code, only itself and plain helpers", () => {
    const forbiddenPackage = (spec: string) => /^(solid-js|@opentui|@opencode|bun:|node:|ksuid)/.test(spec);
    const bad = all.filter(
      (i) =>
        scheduleShared(i.from) &&
        (forbiddenPackage(i.spec) ||
          (i.target !== undefined && !(under(i.target, "src/schedule/shared") || under(i.target, "src/shared"))) ||
          i.target?.endsWith(".tsx") ||
          i.target === "src/shared/theme.ts" ||
          // croner is only wrapped in cron.ts
          (i.spec === "croner" && i.from !== "src/schedule/shared/cron.ts")),
    );
    expect(offenders(bad)).toEqual([]);
  });

  test("TUI code never reaches into the server or the database", () => {
    const bad = all.filter(
      (i) => tui(i.from) && (under(i.target, "src/schedule/server") || /^(ksuid|croner|bun:|node:sqlite)/.test(i.spec)),
    );
    expect(offenders(bad)).toEqual([]);
  });

  test("server code has no UI: no .tsx, Solid or OpenTUI", () => {
    const bad = all.filter((i) => server(i.from) && (i.target?.endsWith(".tsx") || /^(solid-js|@opentui|@opencode\/plugin\/tui)/.test(i.spec)));
    expect(offenders(bad)).toEqual([]);
  });

  test("sessions and the schedule UI do not depend on the dashboard shell", () => {
    const bad = all.filter((i) => (under(i.from, "src/sessions") || under(i.from, "src/schedule/ui")) && under(i.target, "src/dashboard"));
    expect(offenders(bad)).toEqual([]);
  });

  test("the RPC contract imports nothing but the RPC helper", () => {
    const bad = all.filter((i) => i.from === "src/rpc.ts" && i.spec !== "@opencode/plugin/rpc");
    expect(offenders(bad)).toEqual([]);
  });
});
