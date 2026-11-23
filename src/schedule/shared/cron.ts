import { Cron } from "croner";

const MAX_RUNS = 5000;

/** Five-field patterns only; evaluated in the local time zone. */
const parse = (expression: string) => new Cron(expression.trim(), { paused: true, mode: "5-part" });

/** The reason an expression is invalid, or undefined when it is valid. */
export function validateCron(expression: string): string | undefined {
  if (!expression.trim()) return "Enter a cron expression, for example 0 9 * * 1-5";
  try {
    parse(expression);
    return undefined;
  } catch (error) {
    return (error as Error).message || "Invalid cron expression";
  }
}

/** The next `count` run times after `from`. */
export function nextRuns(expression: string, count: number, from: Date = new Date()): Date[] {
  return parse(expression).nextRuns(count, from);
}

/** Run times from `from` (inclusive) up to `to` (exclusive). */
export function runsBetween(expression: string, from: Date, to: Date): Date[] {
  const cron = parse(expression);
  const found: Date[] = [];
  let cursor: Date | null = cron.nextRun(new Date(from.getTime() - 1));
  while (cursor && cursor < to && found.length < MAX_RUNS) {
    found.push(cursor);
    cursor = cron.nextRun(cursor);
  }
  return found;
}

export function matchesCron(expression: string, date: Date): boolean {
  return parse(expression).match(date);
}
