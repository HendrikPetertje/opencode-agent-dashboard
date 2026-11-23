/** The last two path segments: `REPO/worktree-dir` or `parent-folder/REPO`. */
export function folderLabel(directory: string | undefined): string {
  const parts = (directory ?? "").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `2026-11-22 19:31`, in local time. */
export function formatDate(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Cuts `text` to `width` cells, ending in an ellipsis when it was shortened. */
export function ellipsize(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  return width === 1 ? "…" : `${text.slice(0, width - 1)}…`;
}

/** Cuts `text` to `width` cells from the start, so the end stays visible, with a leading ellipsis. */
export function ellipsizeStart(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  return width === 1 ? "…" : `…${text.slice(text.length - (width - 1))}`;
}
