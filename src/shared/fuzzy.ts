/** How well `query` matches `text`, higher is better; undefined when it does not match. Case-insensitive. */
export function fuzzyScore(query: string, text: string): number | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const hay = text.toLowerCase();
  let total = 0;
  for (const term of needle.split(/\s+/)) {
    const score = termScore(term, hay);
    if (score === undefined) return undefined;
    total += score;
  }
  return total;
}

const isBoundary = (hay: string, at: number) => at === 0 || "/-_. :".includes(hay[at - 1]!);

function termScore(term: string, hay: string): number | undefined {
  // A plain substring is the best kind of match: the earlier and the more word-aligned, the better.
  const at = hay.indexOf(term);
  if (at !== -1) return 100 - Math.min(at, 50) + (isBoundary(hay, at) ? 20 : 0);
  // Otherwise every character has to appear in order; consecutive and word-start characters score more.
  let score = 0;
  let from = 0;
  let last = -2;
  let first = -1;
  for (const char of term) {
    const found = hay.indexOf(char, from);
    if (found === -1) return undefined;
    score += 1 + (found === last + 1 ? 4 : 0) + (isBoundary(hay, found) ? 3 : 0) - Math.min(found - from, 5) * 0.2;
    if (first === -1) first = found;
    last = found;
    from = found + 1;
  }
  // Characters scattered over a long stretch are noise, not a match.
  return last - first + 1 <= term.length * 2 + 2 ? score : undefined;
}

/** Items whose label matches, best first; with no query every item in its original order. */
export function fuzzyFilter<T extends { label: string }>(items: readonly T[], query: string): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, item.label) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== undefined)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
