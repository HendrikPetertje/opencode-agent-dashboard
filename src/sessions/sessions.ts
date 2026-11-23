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

/** Applies local deletions and renames on top of server data, until the server data catches up. */
export function applyLocalChanges<T extends { id: string; title?: string }>(
  sessions: readonly T[],
  removed: Readonly<Record<string, true>>,
  renamed: Readonly<Record<string, string>>,
): T[] {
  return sessions.filter((s) => !removed[s.id]).map((s) => (renamed[s.id] !== undefined ? { ...s, title: renamed[s.id] } : s));
}
