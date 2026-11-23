import { describe, expect, test } from "bun:test";
import { describeFinished, osCommand, Presence } from "./notify.ts";

describe("notifications", () => {
  const base = { runId: "r1", jobId: "j1", jobName: "Nightly", sessionId: "ses_1" };
  test("describes succeeded, failed and timed out runs", () => {
    expect(describeFinished({ ...base, status: "succeeded", reason: "done" })).toMatchObject({ title: "Nightly: succeeded", message: "done", variant: "success", sessionId: "ses_1" });
    expect(describeFinished({ ...base, status: "failed", reason: "permission needed: bash" })).toMatchObject({ title: "Nightly: failed", variant: "error" });
    expect(describeFinished({ ...base, status: "failed", reason: "timed out, no result reported" })).toMatchObject({ title: "Nightly: timed out", variant: "warning" });
    expect(describeFinished({ ...base, status: "failed", reason: "timed out (OpenCode was not running)" }).title).toBe("Nightly: timed out");
  });
  test("long or multi-line messages are shortened to one line", () => {
    const notice = describeFinished({ ...base, status: "failed", reason: `a\n\n${"x".repeat(500)}` });
    expect(notice.message.includes("\n")).toBe(false);
    expect(notice.message.length).toBeLessThanOrEqual(200);
    expect(notice.message.endsWith("…")).toBe(true);
  });
  test("missing reasons get a default message and no session stays optional", () => {
    expect(describeFinished({ ...base, sessionId: null, status: "succeeded", reason: null })).toMatchObject({ message: "The job finished.", sessionId: undefined });
  });
  test("os commands pass the text as arguments, never inside a script", () => {
    const evil = 'x" & do shell script "touch /tmp/pwned" & "';
    const mac = osCommand("darwin", evil, evil)!;
    expect(mac.command).toBe("osascript");
    expect(mac.args.filter((a) => a.includes("do shell script"))).toEqual([evil, evil]);
    expect(mac.args.slice(0, 6).join(" ")).not.toContain("do shell script");
    expect(osCommand("linux", "t", "m")).toEqual({ command: "notify-send", args: ["--app-name=opencode", "--", "t", "m"] });
    expect(osCommand("win32", "t", "m")).toBeUndefined();
  });
  test("presence expires", () => {
    let now = 1000;
    const presence = new Presence(() => now, 45_000);
    expect(presence.any()).toBe(false);
    presence.beat("a");
    expect(presence.any()).toBe(true);
    now += 44_000;
    expect(presence.any()).toBe(true);
    now += 2_000;
    expect(presence.any()).toBe(false);
    presence.beat("b");
    presence.leave("b");
    expect(presence.any()).toBe(false);
  });
});
