import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/** The plugin's folder: the nearest parent of `from` that has a `package.json`. */
export function pluginRoot(from: string): string | undefined {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Identifies the plugin's code by the newest modification time of its source files (`index.ts` and everything under
 * `src/`, tests excluded). Every project location loads its own copy of the server modules, so the identity of a class
 * cannot tell a hot reload from another location loading the same code: this can. "unknown" when it cannot be read.
 */
export function codeVersion(from: string): string {
  try {
    const root = pluginRoot(from);
    if (!root) return "unknown";
    const files = [join(root, "index.ts"), ...sourceFiles(join(root, "src"))].filter(existsSync);
    return String(Math.max(...files.map((file) => statSync(file).mtimeMs)));
  } catch {
    return "unknown";
  }
}
