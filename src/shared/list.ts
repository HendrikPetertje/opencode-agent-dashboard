/** Moves a selection by `delta`, clamped to the list. */
export function moveIndex(index: number, delta: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), index + delta));
}

/** The session to select after removing the one at `index`: the next row, or the previous one at the end. */
export function neighbourAfterRemoval<T extends { id: string }>(sessions: readonly T[], index: number): string | undefined {
  return (sessions[index + 1] ?? sessions[index - 1])?.id;
}
