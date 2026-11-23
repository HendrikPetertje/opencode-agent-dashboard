/**
 * Agent dashboard TUI: a near-full-window modal (drawn from the `app` slot, since dialog sizes are fixed presets)
 * with a Sessions tab and a Schedule tab. Opened with /dashboard, the command palette, or <leader>h
 * (override in cli.json under `agent-dashboard.open`). The pieces live in src/dashboard, src/sessions and src/schedule.
 */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal, Show } from "solid-js";
import { Dashboard } from "./src/dashboard/dashboard.tsx";
import { startNotifications } from "./src/dashboard/notifications.ts";
import { createPromptAnchor } from "./src/dashboard/prompt-anchor.tsx";
import { DashboardConfig } from "./src/rpc.ts";
import { DEFAULT_SESSION_LIMIT, parseSessionLimit } from "./src/shared/options.ts";

export default Plugin.define({
  id: "agent-dashboard.tui",
  async setup(context) {
    // The TUI part does not receive plugin options, so the server part passes them over RPC.
    let sessionLimit = DEFAULT_SESSION_LIMIT;
    try {
      const location = context.location ?? context.data.location.default();
      const reply = (await context.client.rpc(DashboardConfig).config({}, { location })) as { sessionLimit: number };
      sessionLimit = parseSessionLimit(reply);
    } catch {
      sessionLimit = parseSessionLimit(context.options);
    }

    const stopNotifications = startNotifications(context);
    const [visible, setVisible] = createSignal(false);
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    const directory = () => context.location?.directory ?? context.data.location.default()?.directory;
    const { promptTop, Anchor } = createPromptAnchor();
    const inSession = () => context.ui.router.current()?.type === "session";

    const stopOverlay = context.ui.slot({
      append: "app",
      render: () => (
        <Show when={visible()}>
          <Dashboard sessionLimit={sessionLimit} directory={directory} promptTop={promptTop} hide={hide} />
        </Show>
      ),
    });
    const stopComposer = context.ui.slot({
      prepend: "session.composer.top",
      render: () => (
        <Show when={visible() && inSession()}>
          <Anchor />
        </Show>
      ),
    });

    // `bind` is the default; override it in cli.json under keybinds by command id.
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "agent-dashboard.open",
          title: "Show dashboard",
          group: "Dashboard",
          bind: "<leader>h",
          palette: true,
          slash: { name: "dashboard" },
          run: show,
        },
      ],
      bindings: ["agent-dashboard.open"],
    }));

    return () => {
      stopNotifications();
      hide();
      stopOverlay?.();
      stopComposer?.();
    };
  },
});
