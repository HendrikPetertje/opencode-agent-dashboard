import { spawn } from "node:child_process";

const MAX_MESSAGE = 200;

export type Outcome = "succeeded" | "failed";

export interface Finished {
  runId: string;
  jobId: string;
  jobName: string;
  status: Outcome;
  reason: string | null;
  sessionId: string | null;
}

export interface Notice {
  title: string;
  message: string;
  variant: "success" | "error" | "warning";
  runId: string;
  sessionId?: string;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

const timedOut = (reason: string | null) => !!reason && /^timed out/i.test(reason);

/** What to tell the user about a finished run: succeeded, failed or timed out. */
export function describeFinished(finished: Finished): Notice {
  const label = finished.status === "succeeded" ? "succeeded" : timedOut(finished.reason) ? "timed out" : "failed";
  return {
    title: `${clip(oneLine(finished.jobName), 60)}: ${label}`,
    message: clip(oneLine(finished.reason ?? (finished.status === "succeeded" ? "The job finished." : "The job failed.")), MAX_MESSAGE),
    variant: finished.status === "succeeded" ? "success" : timedOut(finished.reason) ? "warning" : "error",
    runId: finished.runId,
    sessionId: finished.sessionId ?? undefined,
  };
}

/**
 * The command that shows an operating system notification, or undefined where there is none. The text is passed as
 * separate arguments, never inside a script or a shell line, so job names and agent messages cannot inject anything.
 */
export function osCommand(platform: string, title: string, message: string): { command: string; args: string[] } | undefined {
  if (platform === "darwin") {
    return {
      command: "osascript",
      args: ["-e", "on run argv", "-e", "display notification (item 1 of argv) with title (item 2 of argv)", "-e", "end run", "--", message, title],
    };
  }
  if (platform === "linux") return { command: "notify-send", args: ["--app-name=opencode", "--", title, message] };
  return undefined;
}

/** Shows an operating system notification; failures are ignored. */
export function osNotify(notice: Pick<Notice, "title" | "message">, platform: string = process.platform): boolean {
  const command = osCommand(platform, notice.title, notice.message);
  if (!command) return false;
  try {
    const child = spawn(command.command, command.args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Which terminal user interfaces are connected, by id, kept alive by regular presence calls. */
export class Presence {
  private seen = new Map<string, number>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 45_000,
  ) {}
  beat(id: string): void {
    this.seen.set(id, this.now());
  }
  known(id: string): boolean {
    return this.seen.has(id);
  }
  leave(id: string): void {
    this.seen.delete(id);
  }
  any(): boolean {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, at] of this.seen) {
      if (at < cutoff) this.seen.delete(id);
    }
    return this.seen.size > 0;
  }
}
