/**
 * Agent dashboard: a modal overview of sessions. The UI lives in tui.tsx; this
 * server part reads the plugin options and hands them to the TUI over RPC (see rpc.ts).
 *
 *   { "package": "./configured-plugins/agent-dashboard", "options": { "sessionLimit": 200 } }
 */
import { Plugin } from "@opencode/plugin";
import { parseSessionLimit } from "./src/options.ts";
import { DashboardConfig } from "./rpc.ts";

export default Plugin.define({
  id: "agent-dashboard",
  async setup(ctx) {
    const sessionLimit = parseSessionLimit(ctx.options);
    await ctx.rpc.register(DashboardConfig, { config: async () => ({ sessionLimit }) });
  },
});
