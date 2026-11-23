export interface SessionLike {
  id: string;
  parentID?: string;
  title?: string;
  time: { updated: number };
  location: { directory: string };
}

/** Root sessions (no parent), most recently updated first. */
export function rootSessions<T extends SessionLike>(sessions: readonly T[]): T[] {
  return sessions.filter((s) => !s.parentID).sort((a, b) => b.time.updated - a.time.updated);
}

export interface MessageLike {
  type: string;
  text?: string;
  content?: readonly { type: string; text?: string }[];
}

export interface PreviewLine {
  role: "user" | "assistant";
  text: string;
}

/** The last `limit` user and assistant text messages; tool calls, reasoning and other message kinds are skipped. */
export function previewMessages(messages: readonly MessageLike[], limit = 10, maxChars = 600): PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (const message of messages) {
    let text = "";
    if (message.type === "user") text = message.text ?? "";
    else if (message.type === "assistant") {
      text = (message.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
    } else continue;
    text = text.trim();
    if (!text) continue;
    lines.push({ role: message.type as "user" | "assistant", text: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text });
  }
  return lines.slice(-limit);
}

/** Moves a selection by `delta`, clamped to the list. */
export function moveIndex(index: number, delta: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), index + delta));
}

/** Applies local deletions and renames on top of server data, until the server data catches up. */
export function applyLocalChanges<T extends { id: string; title?: string }>(
  sessions: readonly T[],
  removed: Readonly<Record<string, true>>,
  renamed: Readonly<Record<string, string>>,
): T[] {
  return sessions.filter((s) => !removed[s.id]).map((s) => (renamed[s.id] !== undefined ? { ...s, title: renamed[s.id] } : s));
}

/** The session to select after removing the one at `index`: the next row, or the previous one at the end. */
export function neighbourAfterRemoval<T extends { id: string }>(sessions: readonly T[], index: number): string | undefined {
  return (sessions[index + 1] ?? sessions[index - 1])?.id;
}
