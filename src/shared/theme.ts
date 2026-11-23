import { RGBA } from "@opentui/core";

/** Terminal palette slot as a colour, with a fallback for terminals that do not report it. */
function ansi(index: number, fallback: string) {
  const from = (RGBA as any)?.fromIndex;
  if (typeof from === "function") {
    try {
      return from.call(RGBA, index, fallback);
    } catch {}
  }
  return fallback;
}

/** The colours the dashboard draws with, all read from the active OpenCode theme. */
export interface Palette {
  text: unknown;
  muted: unknown;
  accent: unknown;
  bar: unknown;
  surface: unknown;
  success: unknown;
  error: unknown;
  warning: unknown;
}

/** Reads the palette from the theme; call it inside accessors so a theme change is picked up. */
export function readPalette(theme: any): Palette {
  // The theme's "info" token is the closest to Rosé Pine's foam; terminal slot 4 is the fallback.
  const accent = theme.text.feedback?.info?.base ?? ansi(4, "#9ccfd8");
  const feedback = (kind: "success" | "error" | "warning", fallback: unknown) => theme.text.feedback?.[kind]?.base ?? fallback;
  return {
    text: theme.text.base,
    muted: theme.text.muted,
    accent,
    bar: theme.background.base ?? theme.background.raised.high,
    surface: theme.background.raised.high,
    success: feedback("success", accent),
    error: feedback("error", theme.text.muted),
    warning: feedback("warning", accent),
  };
}
