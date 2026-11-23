/**
 * Agent dashboard TUI: a near-full-window modal (drawn from the `app` slot, since
 * dialog sizes are fixed presets) with a Sessions tab and a Schedule placeholder.
 * Opened with /dashboard, the command palette, or <leader>h (override in cli.json under `agent-dashboard.open`).
 */
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { RGBA, TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { ellipsize, ellipsizeStart, folderLabel, formatDate } from "./src/folder.ts";
import { modalLayout } from "./src/layout.ts";
import { DEFAULT_SESSION_LIMIT, parseSessionLimit } from "./src/options.ts";
import { DashboardConfig } from "./rpc.ts";
import { applyLocalChanges, moveIndex, neighbourAfterRemoval, previewMessages, rootSessions } from "./src/sessions.ts";

const TABS = ["Sessions", "Schedule"] as const;
const MODE = "agent-dashboard";
const ROW_HEIGHT = 1;
const DATE_WIDTH = 16;
const FOLDER_MAX = 28;
const TITLE_SHARE = 0.5;
const DOUBLE_TAP_MS = 600;
const MIN_PROMPT_ROW = 16;
const MEASURE_INTERVAL_MS = 1000;
const MIN_MODAL_HEIGHT = 12;
const SCRIM = RGBA.fromInts(0, 0, 0, 150);
const PREVIEW_DEBOUNCE_MS = 100;
const HISTORY_PAGE_SIZE = 200;
const HISTORY_MAX_PAGES = 5;

// Fallback only: terminal palette slot 4 is foam in Rosé Pine.
function ansi(index: number, fallback: string) {
  const from = (RGBA as any)?.fromIndex;
  if (typeof from === "function") {
    try {
      return from.call(RGBA, index, fallback);
    } catch {}
  }
  return fallback;
}

export default Plugin.define({
  id: "agent-dashboard.tui",
  async setup(context) {
    // The TUI part does not receive plugin options, so the server part passes them over RPC.
    let sessionLimit = DEFAULT_SESSION_LIMIT;
    try {
      const location = context.location ?? context.data.location.default();
      const reply = (await context.client.rpc(DashboardConfig).config({}, { location })) as { sessionLimit: number };
      sessionLimit = parseSessionLimit(reply);
    } catch {
      sessionLimit = parseSessionLimit(context.options);
    }
    const [visible, setVisible] = createSignal(false);
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    const directory = () => context.location?.directory ?? context.data.location.default()?.directory;

    // Screen row of the prompt block, measured by an invisible anchor in the composer slot; the modal itself
    // is drawn from the `app` slot, since anything inside the session pane is painted under the sidebar.
    const [promptTop, setPromptTop] = createSignal<number | undefined>();

    const Dashboard = () => {
      const ctx = usePlugin();
      const dims = useTerminalDimensions();
      const layout = createMemo(() => modalLayout(dims().width, dims().height));
      const boxHeight = () => {
        const top = promptTop();
        return top === undefined ? layout().height : Math.max(MIN_MODAL_HEIGHT, top - 1 - layout().margin);
      };
      const [tab, setTab] = createSignal(0);
      const [selectedID, setSelectedID] = createSignal<string | undefined>();
      const [loaded, setLoaded] = createSignal(0);
      let scroll: { scrollTo(position: number): void } | undefined;

      const text = () => ctx.theme.text.base as any;
      const muted = () => ctx.theme.text.muted as any;
      // The theme's "info" token is the closest to Rosé Pine's foam.
      const bar = () => ((ctx.theme.background as any).base ?? ctx.theme.background.raised.high) as any;
      const surface = () => ctx.theme.background.raised.high as any;
      const accent = () => ((ctx.theme.text as any).feedback?.info?.base ?? ansi(4, "#9ccfd8")) as any;

      // The data cache only holds sessions this TUI has loaded, so fetch the history and let live data win.
      const [history, setHistory] = createSignal<any[]>([]);
      void (async () => {
        const found: any[] = [];
        let cursor: string | undefined;
        try {
          for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
            const reply: any = await ctx.client.session.list({ limit: HISTORY_PAGE_SIZE, order: "desc", cursor } as any);
            found.push(...(reply?.data ?? []));
            cursor = reply?.cursor?.next ?? undefined;
            if (!cursor || found.filter((x) => !x.parentID).length >= sessionLimit) break;
          }
        } catch (error) {
          ctx.ui.toast.show({ variant: "error", title: "Dashboard", message: `Couldn't load sessions: ${(error as Error)?.message ?? error}` });
        }
        setHistory(found);
      })();
      // Deletions and renames done here, applied on top of server data until the caches catch up.
      const [removed, setRemoved] = createSignal<Record<string, true>>({});
      const [renamed, setRenamed] = createSignal<Record<string, string>>({});
      const [prompting, setPrompting] = createSignal(false);
      const sessions = createMemo(() => {
        const byID = new Map<string, any>();
        for (const session of history()) byID.set(session.id, session);
        for (const session of ctx.data.session.list()) byID.set(session.id, session);
        return applyLocalChanges(rootSessions([...byID.values()]), removed(), renamed()).slice(0, sessionLimit);
      });
      const index = createMemo(() => {
        const at = sessions().findIndex((s) => s.id === selectedID());
        return at === -1 ? 0 : at;
      });
      const current = () => sessions()[index()];

      const listRows = () => Math.max(1, boxHeight() - 6);
      let pendingD = 0;
      let pendingG = 0;
      const select = (delta: number) => {
        pendingD = 0;
        pendingG = 0;
        const next = moveIndex(index(), delta, sessions().length);
        setSelectedID(sessions()[next]?.id);
        scroll?.scrollTo(Math.max(0, next * ROW_HEIGHT - Math.floor(listRows() / 2)));
      };
      const openSession = () => {
        const id = current()?.id;
        if (!id) return;
        if (ctx.ui.tabs.enabled()) ctx.ui.tabs.focus(id);
        else ctx.ui.router.navigate({ type: "session", sessionID: id });
        hide();
      };
      const page = () => Math.max(1, listRows() - 1);
      const goTop = () => select(-Infinity);
      const goBottom = () => select(Infinity);
      const topOnSecondG = () => {
        const now = Date.now();
        if (now - pendingG < DOUBLE_TAP_MS) return goTop();
        pendingG = now;
      };
      const cycleTab = (step: number) => {
        pendingD = 0;
        pendingG = 0;
        setTab((now) => (now + step + TABS.length) % TABS.length);
      };
      const failed = (what: string, error: unknown) =>
        ctx.ui.toast.show({ variant: "error", title: "Dashboard", message: `Couldn't ${what}: ${(error as Error)?.message ?? error}` });

      const deleteSession = async () => {
        const now = Date.now();
        const target = current();
        if (!target || now - pendingD >= DOUBLE_TAP_MS) {
          pendingD = target ? now : 0;
          return;
        }
        pendingD = 0;
        const next = neighbourAfterRemoval(sessions(), index());
        setPrompting(true);
        let confirmed: boolean | undefined;
        try {
          confirmed = await ctx.ui.dialog.confirm({
            title: "Delete session?",
            message: `"${target.title || "(untitled)"}" and its messages will be removed permanently.`,
            label: { confirm: "Delete", cancel: "Cancel" },
          });
        } finally {
          setPrompting(false);
        }
        if (!confirmed) return;
        try {
          await ctx.client.session.remove({ sessionID: target.id } as any);
        } catch (error) {
          return failed("delete the session", error);
        }
        setRemoved((all) => ({ ...all, [target.id]: true }));
        setSelectedID(next);
      };

      const renameSession = async () => {
        const target = current();
        if (!target) return;
        setPrompting(true);
        let answer: string | undefined;
        try {
          answer = await ctx.ui.dialog.prompt({ title: "Rename session", value: target.title ?? "" });
        } finally {
          setPrompting(false);
        }
        const title = answer?.trim();
        if (!title || title === target.title) return;
        try {
          await ctx.client.session.update({ sessionID: target.id, title } as any);
        } catch (error) {
          return failed("rename the session", error);
        }
        setRenamed((all) => ({ ...all, [target.id]: title }));
      };

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
      ctx.keymap.layer(() => ({
        mode: MODE,
        priority: 100,
        enabled: () => !prompting(),
        commands: [
          {
            bind: "escape",
            run: (_input, event) => {
              event?.preventDefault?.();
              hide();
            },
          },
          { bind: "tab", run: () => cycleTab(1) },
          { bind: "shift+tab", run: () => cycleTab(-1) },
          { bind: "right", run: () => cycleTab(1) },
          { bind: "left", run: () => cycleTab(-1) },
          { bind: "l", run: () => cycleTab(1) },
          { bind: "h", run: () => cycleTab(-1) },
          { bind: "1", run: () => setTab(0) },
          { bind: "2", run: () => setTab(1) },
          { bind: "j", enabled: () => tab() === 0, run: () => select(1) },
          { bind: "k", enabled: () => tab() === 0, run: () => select(-1) },
          { bind: "down", enabled: () => tab() === 0, run: () => select(1) },
          { bind: "up", enabled: () => tab() === 0, run: () => select(-1) },
          { bind: "pagedown", enabled: () => tab() === 0, run: () => select(page()) },
          { bind: "ctrl+d", enabled: () => tab() === 0, run: () => select(page()) },
          { bind: "pageup", enabled: () => tab() === 0, run: () => select(-page()) },
          { bind: "ctrl+u", enabled: () => tab() === 0, run: () => select(-page()) },
          { bind: "home", enabled: () => tab() === 0, run: goTop },
          { bind: "g", enabled: () => tab() === 0, run: topOnSecondG },
          { bind: "end", enabled: () => tab() === 0, run: goBottom },
          { bind: "shift+g", enabled: () => tab() === 0, run: goBottom },
          { bind: "return", enabled: () => tab() === 0, run: openSession },
          { bind: "d", enabled: () => tab() === 0, run: () => void deleteSession() },
          { bind: "r", enabled: () => tab() === 0, run: () => void renameSession() },
        ],
      }));

      createEffect(
        on(
          () => (layout().small ? undefined : current()?.id),
          (id) => {
            if (!id) return;
            const timer = setTimeout(() => void ctx.data.session.message.sync(id).then(() => setLoaded((n) => n + 1)), PREVIEW_DEBOUNCE_MS);
            onCleanup(() => clearTimeout(timer));
          },
        ),
      );
      const preview = createMemo(() => {
        loaded();
        const id = current()?.id;
        return id ? previewMessages(ctx.data.session.message.list(id) as any) : [];
      });

      const folderWidth = createMemo(() => Math.min(FOLDER_MAX, Math.max(6, ...sessions().map((x) => folderLabel(x.location.directory).length))));
      const [listWidth, setListWidth] = createSignal(0);
      // The title takes at most half the list, or less when every title is shorter.
      const titleWidth = createMemo(() => {
        const longest = Math.max(5, ...sessions().map((x) => (x.title || "(untitled)").length));
        return Math.max(5, Math.min(longest, Math.floor((listWidth() || 80) * TITLE_SHARE)));
      });
      const Cell = (props: { width?: number; grow?: boolean; color: unknown; bold?: boolean; children: string }) => (
        <box flexShrink={props.grow ? 1 : 0} flexGrow={props.grow ? 1 : 0} width={props.width} minWidth={0} overflow="hidden">
          <text fg={props.color as any} attributes={props.bold ? TextAttributes.BOLD : 0} wrapMode="none">{props.children}</text>
        </box>
      );
      const Columns = (props: { marker: string; title: string; date: string; folder: string; color: unknown; bold?: boolean; onSelect?: () => void }) => (
        <box flexDirection="row" flexShrink={0} height={ROW_HEIGHT} gap={2} onMouseUp={props.onSelect}>
          <box flexShrink={0} width={1}>
            <text fg={accent()}>{props.marker}</text>
          </box>
          <Cell width={titleWidth()} color={props.color} bold={props.bold}>{ellipsize(props.title, titleWidth())}</Cell>
          <Cell width={DATE_WIDTH} color={props.color} bold={props.bold}>{props.date}</Cell>
          <Cell width={folderWidth()} color={props.color} bold={props.bold}>{ellipsizeStart(props.folder, folderWidth())}</Cell>
        </box>
      );
      const SessionRow = (props: { title: string; updated: number; dir: string; selected: boolean; onSelect: () => void }) => (
        <Columns
          marker={props.selected ? "▌" : " "}
          title={props.title || "(untitled)"}
          date={formatDate(props.updated)}
          folder={folderLabel(props.dir)}
          color={props.dir === directory() ? accent() : text()}
          bold={props.selected}
          onSelect={props.onSelect}
        />
      );

      const SessionsTab = () => (
        <box flexDirection="row" flexGrow={1} flexBasis={0} minHeight={0} gap={2}>
          <box
            flexDirection="column"
            flexGrow={1}
            flexBasis={0}
            minHeight={0}
            onSizeChange={function (this: { width: number }) {
              const width = this.width;
              queueMicrotask(() => setListWidth(width));
            }}
          >
            <Columns marker=" " title="Title" date="Date" folder="Folder" color={muted()} />
            <scrollbox ref={(el: any) => (scroll = el)} flexGrow={1} flexBasis={0} minHeight={0}>
              <For each={sessions()} fallback={<text fg={muted()}>No sessions yet.</text>}>
                {(session) => (
                  <SessionRow
                    title={session.title ?? ""}
                    updated={session.time.updated}
                    dir={session.location.directory}
                    selected={session.id === current()?.id}
                    onSelect={() => setSelectedID(session.id)}
                  />
                )}
              </For>
            </scrollbox>
          </box>
          <Show when={!layout().small}>
            <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0} backgroundColor={bar()}>
              <scrollbox flexGrow={1} flexBasis={0} minHeight={0} stickyScroll stickyStart="bottom" paddingTop={1} paddingLeft={1} paddingRight={1}>
                <For each={preview()} fallback={<text fg={muted()}>{current() ? "Loading messages…" : ""}</text>}>
                  {(line) =>
                    line.role === "user" ? (
                      <box
                        flexShrink={0}
                        marginBottom={1}
                        border={["left"]}
                        borderStyle="heavy"
                        borderColor={accent()}
                        backgroundColor={surface()}
                        paddingLeft={1}
                        paddingRight={1}
                        paddingTop={1}
                        paddingBottom={1}
                      >
                        <text fg={text()} wrapMode="word">{line.text}</text>
                      </box>
                    ) : (
                      <box flexShrink={0} marginBottom={1} paddingLeft={2}>
                        <text fg={text()} wrapMode="word">{line.text}</text>
                      </box>
                    )
                  }
                </For>
              </scrollbox>
            </box>
          </Show>
        </box>
      );

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
          borderColor={muted()}
          backgroundColor={surface()}
        >
          <box flexDirection="row" flexShrink={0} backgroundColor={bar()}>
            <For each={TABS as unknown as string[]}>
              {(name, i) => (
                <box
                  flexShrink={0}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={tab() === i() ? surface() : bar()}
                  onMouseUp={() => setTab(i())}
                >
                  <text fg={tab() === i() ? text() : muted()} attributes={tab() === i() ? TextAttributes.BOLD : 0}>
                    {name}
                  </text>
                </box>
              )}
            </For>
            <box flexGrow={1} />
            <box flexShrink={0} paddingLeft={1} paddingRight={1} onMouseUp={hide}>
              <text fg={muted()}>esc</text>
            </box>
          </box>
          <box height={1} flexShrink={0} />
          <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0} paddingLeft={1} paddingRight={1}>
            <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
              <Show when={tab() === 0} fallback={<text fg={muted()}>The schedule is not available yet.</text>}>
                <SessionsTab />
              </Show>
            </box>
            <text fg={muted()} flexShrink={0} wrapMode="none">
              {tab() === 0 ? "esc close · ←/→ tabs · j/k move · enter open · dd delete · r rename" : "esc close · ←/→ tabs"}
            </text>
          </box>
        </box>
        </box>
      );
    };

    const inSession = () => context.ui.router.current()?.type === "session";
    const stopOverlay = context.ui.slot({
      append: "app",
      render: () => (
        <Show when={visible()}>
          <Dashboard />
        </Show>
      ),
    });

    /** Invisible marker above the prompt: reports its screen row so the modal can end one cell above it. */
    const Anchor = () => {
      const dims = useTerminalDimensions();
      let el: { y: number } | undefined;
      // A reading this high means the layout was not settled yet (or is unusable); keep the full height then.
      const measure = () => {
        if (!el) return;
        const y = el.y;
        setPromptTop(y >= MIN_PROMPT_ROW ? y : undefined);
      };
      onMount(() => {
        queueMicrotask(measure);
        const timer = setInterval(measure, MEASURE_INTERVAL_MS);
        onCleanup(() => clearInterval(timer));
      });
      createEffect(on(() => [dims().width, dims().height], () => queueMicrotask(measure), { defer: true }));
      onCleanup(() => setPromptTop(undefined));
      return <box ref={(node: any) => (el = node)} height={0} flexShrink={0} />;
    };
    const stopComposer = context.ui.slot({
      prepend: "session.composer.top",
      render: () => (
        <Show when={visible() && inSession()}>
          <Anchor />
        </Show>
      ),
    });

    // `bind` is the default; override it in cli.json under keybinds by command id.
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "agent-dashboard.open",
          title: "Show dashboard",
          group: "Dashboard",
          bind: "<leader>h",
          palette: true,
          slash: { name: "dashboard" },
          run: show,
        },
      ],
      bindings: ["agent-dashboard.open"],
    }));

    return () => {
      hide();
      stopOverlay?.();
      stopComposer?.();
    };
  },
});
