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
