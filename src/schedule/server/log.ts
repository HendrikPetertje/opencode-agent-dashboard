import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./store.ts";

/** Appends a line to `dashboard.log` in the state folder; logging never throws. */
export function log(message: string, data?: unknown): void {
  try {
    const dir = stateDir();
    mkdirSync(dir, { recursive: true });
    const extra = data === undefined ? "" : ` ${typeof data === "string" ? data : JSON.stringify(data)}`;
    appendFileSync(join(dir, "dashboard.log"), `${new Date().toISOString()} ${message}${extra}\n`);
  } catch {}
}
