import { DashboardSchedule } from "../rpc.ts";

const PRESENCE_MS = 20_000;
const TOAST_MS = 10_000;

/**
 * Tells the server a TUI is open (so a finished job shows a toast here instead of a system notification) and shows
 * that toast when a job run ends; it offers to open the run's session. Returns a function that stops both.
 */
export function startNotifications(context: any): () => void {
  const schedule = () => context.client.rpc(DashboardSchedule) as any;
  const where = () => ({ location: context.location ?? context.data.location.default() });
  const id = `tui-${Math.random().toString(36).slice(2)}`;
  const beat = (gone = false) => void schedule().presence({ id, gone }, where()).catch(() => {});
  beat();
  const heartbeat = setInterval(beat, PRESENCE_MS);

  // Every plugin instance emits the event, so the same run can arrive more than once.
  const shown = new Set<string>();
  let stopFinished: (() => void) | undefined;
  try {
    stopFinished = schedule().events.on("finished", (payload: any) => {
      // The client hands over an envelope; the notice itself is its `data`.
      const notice = payload?.data ?? payload;
      if (!notice?.title || shown.has(notice.runId)) return;
      shown.add(notice.runId);
      if (shown.size > 100) shown.clear();
      context.ui.toast.show({
        variant: notice.variant,
        title: notice.title,
        message: notice.message,
        duration: TOAST_MS,
        ...(notice.sessionId ? { sessionID: notice.sessionId } : {}),
      });
    });
  } catch {}

  return () => {
    clearInterval(heartbeat);
    beat(true);
    stopFinished?.();
  };
}
