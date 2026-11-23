import { Rpc } from "@opencode/plugin/rpc";

/** Lets the TUI part ask the server part for the plugin options, which the TUI part does not receive. */
export const DashboardConfig = Rpc.define({
  id: "agent-dashboard",
  methods: {
    config: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: { sessionLimit: { type: "number" } },
        required: ["sessionLimit"],
        additionalProperties: false,
      },
    },
  },
  events: {},
});
