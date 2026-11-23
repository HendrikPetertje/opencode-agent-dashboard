/**
 * The dashboard modal: the overlay with its scrim, the tab bar, the legend and the key layer. The tabs themselves
 * (`createSessionsTab`, `createSchedule`) are built the same way and listed in one array, so adding a tab means
 * writing one more `create…Tab` and adding it there.
 */
import { TextAttributes, RGBA } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { usePlugin } from "@opencode/plugin/tui";
import { createSchedule } from "../schedule/ui/schedule-tab.tsx";
import { createSessionsTab } from "../sessions/sessions-tab.tsx";
import { readPalette } from "../shared/theme.ts";
import { modalLayout } from "./layout.ts";

const MODE = "agent-dashboard";
const MIN_MODAL_HEIGHT = 12;
/** Rows of the modal that are not the tab's list: border, tab bar, spacer, legend. */
const CHROME_ROWS = 6;
const SCRIM = RGBA.fromInts(0, 0, 0, 150);

export interface DashboardProps {
  sessionLimit: number;
  directory: () => string | undefined;
  /** Screen row of the prompt (when in a session), so the modal can end one cell above it. */
  promptTop: () => number | undefined;
  hide: () => void;
}

export function Dashboard(props: DashboardProps) {
  const ctx = usePlugin();
  const dims = useTerminalDimensions();
  const layout = createMemo(() => modalLayout(dims().width, dims().height));
  const boxHeight = () => {
    const top = props.promptTop();
    return top === undefined ? layout().height : Math.max(MIN_MODAL_HEIGHT, top - 1 - layout().margin);
  };
  const [tab, setTab] = createSignal(0);
  const [prompting, setPrompting] = createSignal(false);
  const c = () => readPalette(ctx.theme);

  const cycleTab = (step: number) => setTab((now) => (now + step + tabs.length) % tabs.length);
  const openSession = (sessionID: string) => {
    if (ctx.ui.tabs.enabled()) ctx.ui.tabs.focus(sessionID);
    else ctx.ui.router.navigate({ type: "session", sessionID });
    props.hide();
  };
  const shared = { ctx, small: () => layout().small, colors: c, directory: props.directory, openSession, suspend: setPrompting };

  const tabs = [
    {
      name: "Sessions",
      ...createSessionsTab({ ...shared, active: () => tab() === 0 && !prompting(), rows: () => Math.max(1, boxHeight() - CHROME_ROWS), sessionLimit: props.sessionLimit }),
    },
    { name: "Schedule", ...createSchedule({ ...shared, active: () => tab() === 1 && !prompting() }) },
  ];

  // Take the text cursor out of the prompt while the modal is open, and give it back on close.
  const focused = (ctx.renderer as any).currentFocusedRenderable;
  try {
    focused?.blur?.();
  } catch {}
  // Deferred, so the key press that closed the modal is not also handled by the prompt or the base layers.
  onCleanup(() =>
    setTimeout(() => {
      try {
        if (!focused?.isDestroyed) focused?.focus?.();
      } catch {}
    }, 50),
  );
  const popMode = ctx.keymap.mode.push(MODE);
  onCleanup(() => setTimeout(popMode, 50));

  // Keys the dashboard does not handle must do nothing: not type into the prompt below, not trigger other shortcuts.
  // This listener is added after the keymap's own, so keys the dashboard's layer handled are already marked as
  // handled; whatever is left is swallowed. While a dialog of the dashboard is open the dialog gets its keys.
  const keys = (ctx.renderer as any)?.keyInput;
  if (keys?.on) {
    const swallow = (event: any) => {
      if (prompting()) return;
      event.preventDefault?.();
      event.stopPropagation?.();
    };
    keys.on("keypress", swallow);
    keys.on("paste", swallow);
    onCleanup(() =>
      setTimeout(() => {
        keys.off?.("keypress", swallow);
        keys.off?.("paste", swallow);
      }, 50),
    );
  }

  ctx.keymap.layer(() => ({
    mode: MODE,
    priority: 100,
    enabled: () => !prompting(),
    commands: [
      {
        bind: "escape",
        run: (_input, event) => {
          event?.preventDefault?.();
          props.hide();
        },
      },
      { bind: "tab", run: () => cycleTab(1) },
      { bind: "shift+tab", run: () => cycleTab(-1) },
      ...tabs.map((entry, i) => ({ bind: String(i + 1), run: () => setTab(i) })),
      ...tabs.flatMap((entry) => entry.commands),
    ],
  }));

  return (
    <box position="absolute" left={0} top={0} width={dims().width} height={dims().height} zIndex={999} backgroundColor={SCRIM}>
      <box
        position="absolute"
        left={layout().margin}
        top={layout().margin}
        width={layout().width}
        height={boxHeight()}
        zIndex={1000}
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={c().muted as any}
        backgroundColor={c().surface as any}
      >
        <box flexDirection="row" flexShrink={0} backgroundColor={c().bar as any}>
          <For each={tabs}>
            {(entry, i) => (
              <box
                flexShrink={0}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={(tab() === i() ? c().surface : c().bar) as any}
                onMouseUp={() => setTab(i())}
              >
                <text fg={(tab() === i() ? c().text : c().muted) as any} attributes={tab() === i() ? TextAttributes.BOLD : 0}>
                  {entry.name}
                </text>
              </box>
            )}
          </For>
          <box flexGrow={1} />
          <box flexShrink={0} paddingLeft={1} paddingRight={1} onMouseUp={props.hide}>
            <text fg={c().muted as any}>esc</text>
          </box>
        </box>
        <box height={1} flexShrink={0} />
        <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0} paddingLeft={1} paddingRight={1}>
          <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
            <For each={tabs}>
              {(entry, i) => (
                <Show when={tab() === i()}>
                  <entry.Tab />
                </Show>
              )}
            </For>
          </box>
          <text fg={c().muted as any} flexShrink={0} wrapMode="none">
            {tabs[tab()]!.legend()}
          </text>
        </box>
      </box>
    </box>
  );
}
