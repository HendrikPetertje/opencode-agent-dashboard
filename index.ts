/**
 * Agent dashboard, server part: serves options to the TUI over RPC and starts the job scheduler (src/schedule/server/setup.ts).
 *
 *   { "package": "./configured-plugins/agent-dashboard", "options": { "sessionLimit": 200 } }
 *
 * The scheduler is loaded dynamically so that a problem with it (for example a missing dependency) is logged
 * and does not stop the rest of the plugin from loading.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Plugin } from "@opencode/plugin";
import { parseSessionLimit } from "./src/shared/options.ts";
import { DashboardConfig } from "./src/rpc.ts";

function logFailure(message: string, error: unknown): void {
  try {
    const dir = join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "opencode-dashboard");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "dashboard.log"), `${new Date().toISOString()} ${message}: ${(error as Error)?.stack ?? error}\n`);
  } catch {}
}

export default Plugin.define({
  id: "agent-dashboard",
  async setup(ctx) {
    const sessionLimit = parseSessionLimit(ctx.options);
    await ctx.rpc.register(DashboardConfig, { config: async () => ({ sessionLimit }) });

    let cleanup: (() => Promise<void>) | undefined;
    try {
      const { setupSchedule } = await import("./src/schedule/server/setup.ts");
      cleanup = await setupSchedule(ctx);
    } catch (error) {
      logFailure("schedule could not start", error);
    }
    return async () => {
      await cleanup?.();
    };
  },
});
