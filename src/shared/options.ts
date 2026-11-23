export const DEFAULT_SESSION_LIMIT = 200;
const MAX_SESSION_LIMIT = 5000;

/** The `sessionLimit` plugin option: a positive whole number, otherwise the default. */
export function parseSessionLimit(options: Record<string, unknown> | undefined): number {
  const value = options?.sessionLimit;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return DEFAULT_SESSION_LIMIT;
  return Math.min(MAX_SESSION_LIMIT, Math.floor(value));
}

/** The `osNotifications` plugin option: operating system notifications for finished jobs when no TUI is open (default on). */
export function parseOsNotifications(options: Record<string, unknown> | undefined): boolean {
  return options?.osNotifications !== false;
}
