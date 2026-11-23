/**
 * The Sessions tab: a table of all root sessions (live data plus history from the server) next to a preview of the
 * selected session's last messages, with the keys to move, open, delete and rename.
 * Same shape as the Schedule tab: `createSessionsTab(args)` returns the tab, its key commands and its legend.
 */
import { TextAttributes } from "@opentui/core";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { moveIndex, neighbourAfterRemoval } from "../shared/list.ts";
import { createMessagePreview, MessagePreview } from "../shared/message-preview.tsx";
import { ellipsize, ellipsizeStart, folderLabel, formatDate } from "../shared/text.ts";
import type { Palette } from "../shared/theme.ts";
import { applyLocalChanges, rootSessions } from "./sessions.ts";

const ROW_HEIGHT = 1;
const DATE_WIDTH = 16;
const FOLDER_MAX = 28;
const TITLE_SHARE = 0.5;
const DOUBLE_TAP_MS = 600;
const HISTORY_PAGE_SIZE = 200;
const HISTORY_MAX_PAGES = 5;

export interface SessionsTabArgs {
  ctx: any;
  /** The Sessions tab is shown and no dialog of the dashboard is open. */
  active: () => boolean;
  small: () => boolean;
  colors: () => Palette;
  /** Rows the list can show, for keeping the selection in view and for paging. */
  rows: () => number;
  /** The most recently updated root sessions to list. */
  sessionLimit: number;
  /** The current folder; its sessions are highlighted. */
  directory: () => string | undefined;
  /** Opens a session in a tab and closes the dashboard. */
  openSession: (sessionID: string) => void;
  /** Moves to the next (1) or previous (-1) tab. */
  /** Turns the dashboard's own keys off while a dialog is open. */
  suspend: (value: boolean) => void;
}

export function createSessionsTab(args: SessionsTabArgs) {
  const { ctx } = args;
  const c = () => args.colors();

  const [selectedID, setSelectedID] = createSignal<string | undefined>();
  const [listWidth, setListWidth] = createSignal(0);
  let scroll: { scrollTo(position: number): void } | undefined;
  let pendingD = 0;
  let pendingG = 0;

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
        if (!cursor || found.filter((x) => !x.parentID).length >= args.sessionLimit) break;
      }
    } catch (error) {
      ctx.ui.toast.show({ variant: "error", title: "Dashboard", message: `Couldn't load sessions: ${(error as Error)?.message ?? error}` });
    }
    setHistory(found);
  })();

  // Deletions and renames done here, applied on top of server data until the caches catch up.
  const [removed, setRemoved] = createSignal<Record<string, true>>({});
  const [renamed, setRenamed] = createSignal<Record<string, string>>({});
  const sessions = createMemo(() => {
    const byID = new Map<string, any>();
    for (const session of history()) byID.set(session.id, session);
    for (const session of ctx.data.session.list()) byID.set(session.id, session);
    return applyLocalChanges(rootSessions([...byID.values()]), removed(), renamed()).slice(0, args.sessionLimit);
  });
  const index = createMemo(() => {
    const at = sessions().findIndex((s) => s.id === selectedID());
    return at === -1 ? 0 : at;
  });
  const current = () => sessions()[index()];

  // Pressing d or g once is only the start of dd / gg; leaving the tab forgets it.
  createEffect(
    on(args.active, () => {
      pendingD = 0;
      pendingG = 0;
    }),
  );

  const select = (delta: number) => {
    pendingD = 0;
    pendingG = 0;
    const next = moveIndex(index(), delta, sessions().length);
    setSelectedID(sessions()[next]?.id);
    scroll?.scrollTo(Math.max(0, next * ROW_HEIGHT - Math.floor(args.rows() / 2)));
  };
  const openSession = () => {
    const id = current()?.id;
    if (id) args.openSession(id);
  };
  const page = () => Math.max(1, args.rows() - 1);
  const goTop = () => select(-Infinity);
  const goBottom = () => select(Infinity);
  const topOnSecondG = () => {
    const now = Date.now();
    if (now - pendingG < DOUBLE_TAP_MS) return goTop();
    pendingG = now;
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
    args.suspend(true);
    let confirmed: boolean | undefined;
    try {
      confirmed = await ctx.ui.dialog.confirm({
        title: "Delete session?",
        message: `"${target.title || "(untitled)"}" and its messages will be removed permanently.`,
        label: { confirm: "Delete", cancel: "Cancel" },
      });
    } finally {
      args.suspend(false);
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
    args.suspend(true);
    let answer: string | undefined;
    try {
      answer = await ctx.ui.dialog.prompt({ title: "Rename session", value: target.title ?? "" });
    } finally {
      args.suspend(false);
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

  const live = () => args.active();
  const commands = [
    { bind: "j", enabled: live, run: () => select(1) },
    { bind: "k", enabled: live, run: () => select(-1) },
    { bind: "down", enabled: live, run: () => select(1) },
    { bind: "up", enabled: live, run: () => select(-1) },
    { bind: "pagedown", enabled: live, run: () => select(page()) },
    { bind: "ctrl+d", enabled: live, run: () => select(page()) },
    { bind: "pageup", enabled: live, run: () => select(-page()) },
    { bind: "ctrl+u", enabled: live, run: () => select(-page()) },
    { bind: "home", enabled: live, run: goTop },
    { bind: "g", enabled: live, run: topOnSecondG },
    { bind: "end", enabled: live, run: goBottom },
    { bind: "shift+g", enabled: live, run: goBottom },
    { bind: "return", enabled: live, run: openSession },
    { bind: "d", enabled: live, run: () => void deleteSession() },
    { bind: "r", enabled: live, run: () => void renameSession() },
  ];

  const legend = () => "esc close · tab switch · j/k move · enter open · dd delete · r rename";

  // ---- rendering

  const preview = createMessagePreview(ctx, () => (args.small() ? undefined : current()?.id));
  const folderWidth = createMemo(() => Math.min(FOLDER_MAX, Math.max(6, ...sessions().map((x) => folderLabel(x.location.directory).length))));
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
        <text fg={c().accent as any}>{props.marker}</text>
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
      color={props.dir === args.directory() ? c().accent : c().text}
      bold={props.selected}
      onSelect={props.onSelect}
    />
  );

  const Tab = () => (
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
        <Columns marker=" " title="Title" date="Date" folder="Folder" color={c().muted} />
        <scrollbox ref={(el: any) => (scroll = el)} flexGrow={1} flexBasis={0} minHeight={0}>
          <For each={sessions()} fallback={<text fg={c().muted as any}>No sessions yet.</text>}>
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
      <Show when={!args.small()}>
        <MessagePreview lines={preview} empty={() => (current() ? "Loading messages…" : "")} colors={c} />
      </Show>
    </box>
  );

  return { Tab, commands, legend };
}
