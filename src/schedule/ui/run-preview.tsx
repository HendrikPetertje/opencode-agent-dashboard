import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { formatDate } from "../../shared/text.ts";
import { createMessagePreview, MessagePreview } from "../../shared/message-preview.tsx";
import type { Job, Run } from "../shared/types.ts";
import type { Palette } from "../../shared/theme.ts";

export interface RunPreviewArgs {
  ctx: any;
  job: Job;
  run: Run;
  colors: () => Palette;
  suspend: (value: boolean) => void;
  /** Opens the session in a tab and closes the dashboard. */
  openSession: (sessionID: string) => void;
}

const MARGIN = 4;

/** A modal with the last messages of a run's session; Enter opens the session itself. */
export function openRunPreview(args: RunPreviewArgs): void {
  args.suspend(true);
  args.ctx.ui.dialog.show(
    () => <RunPreview {...args} />,
    () => args.suspend(false),
  );
  args.ctx.ui.dialog.set({ size: "xlarge", centered: true });
}

function RunPreview(args: RunPreviewArgs) {
  const { ctx, job, run } = args;
  const dims = useTerminalDimensions();
  const c = () => args.colors();
  const sessionID = run.sessionId ?? undefined;
  const lines = createMessagePreview(ctx, () => sessionID);
  const height = () => Math.max(10, Math.min(30, dims().height - 2 * MARGIN - 1));

  ctx.keymap.layer(() => ({
    mode: "global",
    priority: 10,
    commands: [
      {
        bind: "return",
        run: () => {
          if (!sessionID) return;
          ctx.ui.dialog.clear();
          args.openSession(sessionID);
        },
      },
    ],
  }));

  const statusColor = () => (run.status === "succeeded" ? c().success : run.status === "failed" ? c().error : c().warning);
  return (
    <box flexDirection="column" height={height()} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" flexShrink={0} gap={1}>
        <text fg={c().text as any} attributes={TextAttributes.BOLD}>{job.name}</text>
        <text fg={c().muted as any}>{formatDate(run.scheduledFor)}</text>
        <text fg={statusColor() as any}>{run.status}</text>
      </box>
      {run.reason ? <text fg={c().muted as any} flexShrink={0} wrapMode="word">{run.reason}</text> : null}
      <box height={1} flexShrink={0} />
      <MessagePreview
        lines={lines}
        empty={() => (sessionID ? "Loading messages…" : "No session is available for this run.")}
        colors={() => ({ text: c().text, muted: c().muted, accent: c().accent, bar: c().bar, surface: c().surface })}
      />
      <text fg={c().muted as any} flexShrink={0} wrapMode="none">{sessionID ? "enter open session · esc close" : "esc close"}</text>
    </box>
  );
}
