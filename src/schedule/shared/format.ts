import type { MarkerStatus } from "./calendar.ts";

const SPINNER = ["◜", "◠", "◝", "◞", "◡", "◟"];

/** ✓ success, ✗ failure, spinner while running, ★ future, ? unknown. */
export function symbolFor(status: MarkerStatus | "none", frame = 0): string {
  switch (status) {
    case "succeeded":
      return "✓";
    case "failed":
      return "✗";
    case "running":
      return SPINNER[frame % SPINNER.length]!;
    case "future":
      return "★";
    default:
      return "?";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const weekdayName = (d: Date) => DAYS[(d.getDay() + 6) % 7]!;
export const monthName = (d: Date) => MONTHS[d.getMonth()]!;
export const WEEKDAY_NAMES = DAYS;

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Key combinations (as shown by the keymap, for example `alt+return`) as textarea key bindings. */
export function newlineBindings(shortcuts: readonly string[] | undefined): { name: string; ctrl?: boolean; shift?: boolean; meta?: boolean; super?: boolean; action: "newline" }[] {
  const defaults = ["shift+return", "ctrl+return", "alt+return", "ctrl+j"];
  const source = shortcuts && shortcuts.length > 0 ? shortcuts : defaults;
  const bindings = source.flatMap((shortcut) => {
    const parts = shortcut.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
    const name = parts.pop();
    if (!name || !/^[a-z0-9_-]+$/.test(name)) return [];
    const binding: any = { name: name === "enter" ? "return" : name, action: "newline" as const };
    for (const part of parts) {
      if (part === "ctrl" || part === "control") binding.ctrl = true;
      else if (part === "shift") binding.shift = true;
      else if (part === "alt" || part === "option" || part === "meta") binding.meta = true;
      else if (part === "cmd" || part === "super" || part === "command") binding.super = true;
      else return [];
    }
    return [binding];
  });
  return bindings.length > 0 ? bindings : newlineBindings(defaults);
}
