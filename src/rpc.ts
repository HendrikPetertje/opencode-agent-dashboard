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

const object = { type: "object" } as const;

/** Jobs and runs live in the server part's database; the TUI reads and changes them only through these methods. */
export const DashboardSchedule = Rpc.define({
  id: "agent-dashboard.schedule",
  methods: {
    jobs: { input: object, output: object },
    save: { input: object, output: object },
    archive: { input: object, output: object },
    restore: { input: object, output: object },
    sessions: { input: object, output: object },
    purge: { input: object, output: object },
    runs: { input: object, output: object },
    /** Every TUI calls this regularly so the server knows whether one is open. */
    presence: { input: object, output: object },
    /** `{ enabled? }`: reads, or with `enabled` sets, whether agents get the job tools. Returns `{ enabled }`. */
    agentTools: { input: object, output: object },
  },
  events: {
    changed: { schema: object },
    /** A job run ended: shown as a toast by every open TUI. */
    finished: { schema: object },
  },
});
