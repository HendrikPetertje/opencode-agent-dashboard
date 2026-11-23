import { runsBetween } from "./cron.ts";

export type ViewKind = "month" | "week" | "today";
export type MarkerStatus = "succeeded" | "failed" | "running" | "future" | "missing";

export interface Marker {
  time: Date;
  status: MarkerStatus;
  runId?: string;
}

export interface RunLike {
  id: string;
  scheduledFor: number;
  status: "claiming" | "running" | "succeeded" | "failed";
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** More than 4 runs on a day shows only today, more than 2 shows the week, otherwise the month. */
export function viewFor(maxRunsPerDay: number): ViewKind {
  if (maxRunsPerDay > 4) return "today";
  if (maxRunsPerDay > 2) return "week";
  return "month";
}

export function weekDays(day: Date): Date[] {
  const start = startOfWeek(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Weeks (Monday first) from the week of the 1st to the week of the last day of today's month.
 * When today is in the first 7 days of the month, the last week of the previous month is shown too:
 * it is already the first row when the 1st is not a Monday, otherwise the week before is added.
 */
export function monthWeeks(today: Date): Date[][] {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const firstWeek = startOfWeek(first);
  const lastWeek = startOfWeek(last);
  const weeks: Date[][] = [];
  for (let start = firstWeek; start <= lastWeek; start = addDays(start, 7)) weeks.push(weekDays(start));
  if (today.getDate() <= 7 && sameDay(firstWeek, first)) weeks.unshift(weekDays(addDays(firstWeek, -7)));
  return weeks;
}

/** The days a view shows. */
export function viewDays(kind: ViewKind, today: Date): Date[] {
  if (kind === "today") return [startOfDay(today)];
  if (kind === "week") return weekDays(today);
  return monthWeeks(today).flat();
}

/** The largest number of runs the expression has on any of `days`. */
function maxRunsPerDay(expression: string, days: Date[]): number {
  let max = 0;
  for (const day of days) max = Math.max(max, runsBetween(expression, startOfDay(day), addDays(day, 1)).length);
  return max;
}

/** Month is the default; the busier the job, the narrower the view. Uses the days of the current month and week. */
export function chooseView(expression: string, today: Date): ViewKind {
  const days = [...monthWeeks(today).flat(), ...weekDays(today)];
  return viewFor(maxRunsPerDay(expression, days));
}

const statusOf = (run: RunLike): MarkerStatus => (run.status === "succeeded" ? "succeeded" : run.status === "failed" ? "failed" : "running");

/**
 * Markers of one day: recorded runs by their outcome, scheduled slots that have no run as a star (future)
 * or a question mark (past, after the job existed).
 */
export function markersFor(
  day: Date,
  options: { expression: string; runs: readonly RunLike[]; now: Date; createdAt: number; scheduled: boolean },
): Marker[] {
  const from = startOfDay(day);
  const to = addDays(day, 1);
  const markers: Marker[] = options.runs
    .filter((run) => run.scheduledFor >= from.getTime() && run.scheduledFor < to.getTime())
    .map((run) => ({ time: new Date(run.scheduledFor), status: statusOf(run), runId: run.id }));
  const recorded = new Set(options.runs.map((run) => run.scheduledFor));
  for (const slot of runsBetween(options.expression, from, to)) {
    if (recorded.has(slot.getTime())) continue;
    if (slot > options.now) {
      if (options.scheduled) markers.push({ time: slot, status: "future" });
    } else if (slot.getTime() >= options.createdAt) {
      markers.push({ time: slot, status: "missing" });
    }
  }
  return markers.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/** Past runs in time order, the ones the run cursor steps through. */
export function cursorRuns<T extends RunLike>(runs: readonly T[]): T[] {
  return runs.filter((run) => run.status !== "claiming").sort((a, b) => a.scheduledFor - b.scheduledFor);
}

/** Up moves to an older run, down to a newer one; stops at the ends. */
export function stepCursor(index: number, direction: "older" | "newer", length: number): number {
  const next = direction === "older" ? index - 1 : index + 1;
  return Math.max(0, Math.min(length - 1, next));
}
