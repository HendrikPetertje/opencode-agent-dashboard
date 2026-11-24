/**
 * The Schedule tab: a list of scheduled jobs on the left and a calendar of the selected job's runs on the right,
 * plus the keys to manage jobs. All data comes from the server part over RPC (see src/rpc.ts).
 */
import { TextAttributes } from "@opentui/core";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { chooseView, cursorRuns, markersFor, monthWeeks, sameDay, stepCursor, viewDays, weekDays, type Marker, type ViewKind } from "../shared/calendar.ts";
import { nextRuns } from "../shared/cron.ts";
import { ellipsize, formatDate } from "../../shared/text.ts";
import { moveIndex, neighbourAfterRemoval } from "../../shared/list.ts";
import type { Job, Run } from "../shared/types.ts";
import { DashboardSchedule } from "../../rpc.ts";
import { formatTime, monthName, symbolFor, weekdayName, WEEKDAY_NAMES } from "../shared/format.ts";
import { openJobEditor } from "./job-editor.tsx";
import { openRunPreview } from "./run-preview.tsx";
import type { Palette } from "../../shared/theme.ts";

const DOUBLE_TAP_MS = 600;
const DATE_WIDTH = 16;
const TITLE_SHARE = 0.4;
/** Marker, last run, outcome and next run columns plus the gaps between all five columns. */
const FIXED_COLUMNS = 1 + 16 + 1 + 16 + 4;
const MAX_RUNS_SHOWN = 500;
const TICK_MS = 30_000;
const FRAME_MS = 150;

export interface ScheduleArgs {
  ctx: any;
  /** The Schedule tab is shown and no dialog of the dashboard is open. */
  active: () => boolean;
  small: () => boolean;
  colors: () => Palette;
  directory: () => string | undefined;
  /** Opens a session in a tab and closes the dashboard. */
  openSession: (sessionID: string) => void;
  /** Turns the dashboard's own keys off while a dialog is open. */
  suspend: (value: boolean) => void;
}

type Pane = "list" | "calendar";

/** Nerd Font wrench, like the power icon of auto-mode and sandbox-mode. */
const TOOLS_ICON = "\uF0AD";

export function createSchedule(args: ScheduleArgs) {
  const { ctx } = args;
  const c = () => args.colors();
  const location = () => ctx.location ?? ctx.data.location.default();
  const rpc = () => ctx.client.rpc(DashboardSchedule) as any;
  const call = (method: string, input: unknown = {}) => rpc()[method](input, { location: location() });

  const [jobs, setJobs] = createSignal<Job[]>([]);
  const [lastRuns, setLastRuns] = createSignal<Record<string, Run>>({});
  const [archived, setArchived] = createSignal(false);
  const [selectedID, setSelectedID] = createSignal<string | undefined>();
  const [pane, setPane] = createSignal<Pane>("list");
  const [runs, setRuns] = createSignal<Run[]>([]);
  const [cursorID, setCursorID] = createSignal<string | undefined>();
  const [now, setNow] = createSignal(Date.now());
  const [frame, setFrame] = createSignal(0);
  const [problem, setProblem] = createSignal<string | undefined>();
  const [listWidth, setListWidth] = createSignal(0);
  const [agentTools, setAgentTools] = createSignal(false);
  let scroll: { scrollTo(position: number): void } | undefined;
  let pendingD = 0;
  let pendingG = 0;

  const fail = (what: string, error: unknown) =>
    ctx.ui.toast.show({ variant: "error", title: "Schedule", message: `Couldn't ${what}: ${(error as Error)?.message ?? error}` });
  const unavailable = (error: unknown) =>
    (error as any)?.type === "rpc.unavailable"
      ? "The schedule service is not running. See ~/.local/state/opencode-dashboard/dashboard.log"
      : `Couldn't load the schedule: ${(error as Error)?.message ?? error}`;

  const load = async () => {
    try {
      const reply = await call("jobs", { archived: archived() });
      setJobs(reply.jobs ?? []);
      setLastRuns(reply.lastRuns ?? {});
      setProblem(undefined);
    } catch (error) {
      setProblem(unavailable(error));
    }
    try {
      setAgentTools((await call("agentTools")).enabled === true);
    } catch {}
  };

  const toggleAgentTools = async () => {
    try {
      setAgentTools((await call("agentTools", { enabled: !agentTools() })).enabled === true);
    } catch (error) {
      fail("switch the job tools", error);
    }
  };

  const index = createMemo(() => {
    const at = jobs().findIndex((j) => j.id === selectedID());
    return at === -1 ? 0 : at;
  });
  const job = () => jobs()[index()];

  const loadRuns = async (jobID: string | undefined) => {
    if (!jobID) return setRuns([]);
    try {
      const reply = await call("runs", { jobID });
      setRuns(((reply.runs ?? []) as Run[]).slice(-MAX_RUNS_SHOWN));
    } catch {
      setRuns([]);
    }
  };

  const history = createMemo(() => cursorRuns(runs()));
  createEffect(
    on(
      () => job()?.id,
      (id) => {
        setCursorID(undefined);
        void loadRuns(id);
      },
    ),
  );
  createEffect(() => {
    const list = history();
    if (list.length === 0) return setCursorID(undefined);
    if (!list.some((r) => r.id === cursorID())) setCursorID(list.at(-1)!.id);
  });
  createEffect(on(archived, () => void load(), { defer: true }));

  onMount(() => {
    void load();
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    const spin = setInterval(() => {
      if (args.active() && (history().some((r) => r.status === "running") || Object.values(lastRuns()).some((r) => r.status === "running"))) setFrame((n) => n + 1);
    }, FRAME_MS);
    let stop: (() => void) | undefined;
    try {
      stop = rpc().events.on("changed", () => {
        void load();
        void loadRuns(job()?.id);
      });
    } catch {}
    onCleanup(() => {
      clearInterval(tick);
      clearInterval(spin);
      stop?.();
    });
  });

  const select = (delta: number) => {
    pendingD = 0;
    pendingG = 0;
    const next = moveIndex(index(), delta, jobs().length);
    setSelectedID(jobs()[next]?.id);
    scroll?.scrollTo(Math.max(0, next - 6));
  };
  const page = () => 8;
  const topOnSecondG = () => {
    const at = Date.now();
    if (at - pendingG < DOUBLE_TAP_MS) return select(-Infinity);
    pendingG = at;
  };

  // ---- actions

  const dialog = async <T,>(work: () => Promise<T>): Promise<T> => {
    args.suspend(true);
    try {
      return await work();
    } finally {
      args.suspend(false);
    }
  };

  const editor = (existing?: Job) =>
    openJobEditor({
      ctx,
      job: existing,
      defaultFolder: args.directory() ?? process.cwd(),
      colors: c,
      call,
      suspend: args.suspend,
      onSaved: (saved) => {
        setSelectedID(saved.id);
        void load();
      },
    });

  const archiveJob = async () => {
    const target = job();
    if (!target) return;
    const next = neighbourAfterRemoval(jobs(), index());
    const ok = await dialog(() =>
      ctx.ui.dialog.confirm({
        title: "Archive job?",
        message: `"${target.name}" will be disabled and moved to the archive (A). Its runs are kept.`,
        label: { confirm: "Archive", cancel: "Cancel" },
      }),
    );
    if (!ok) return;
    try {
      await call("archive", { jobID: target.id });
    } catch (error) {
      return fail("archive the job", error);
    }
    setSelectedID(next);
    void load();
  };

  const restoreJob = async () => {
    const target = job();
    if (!target) return;
    const next = neighbourAfterRemoval(jobs(), index());
    try {
      await call("restore", { jobID: target.id });
    } catch (error) {
      return fail("restore the job", error);
    }
    setSelectedID(next);
    void load();
    ctx.ui.toast.show({ variant: "success", title: "Schedule", message: `"${target.name}" is back in the list, disabled. Enable it in the editor.` });
  };

  const purgeJob = async () => {
    const target = job();
    if (!target) return;
    const next = neighbourAfterRemoval(jobs(), index());
    const sure = await dialog(() =>
      ctx.ui.dialog.confirm({
        title: "Delete permanently?",
        message: `"${target.name}" and its run history will be removed for good.`,
        label: { confirm: "Delete", cancel: "Cancel" },
      }),
    );
    if (!sure) return;
    const removeSessions = await dialog(() =>
      ctx.ui.dialog.confirm({
        title: "Remove sessions?",
        message: "Remove associated OpenCode sessions for this job?",
        label: { confirm: "Yes", cancel: "No" },
      }),
    );
    // Escape (undefined) cancels the whole deletion; "No" keeps the sessions.
    if (removeSessions === undefined) return;
    const errors: string[] = [];
    if (removeSessions) {
      try {
        const { sessionIDs } = await call("sessions", { jobID: target.id });
        for (const sessionID of sessionIDs as string[]) {
          try {
            await ctx.client.session.remove({ sessionID });
          } catch (error) {
            errors.push((error as Error)?.message ?? String(error));
          }
        }
      } catch (error) {
        errors.push((error as Error)?.message ?? String(error));
      }
    }
    try {
      await call("purge", { jobID: target.id });
    } catch (error) {
      return fail("delete the job", error);
    }
    if (errors.length > 0) fail(`remove ${errors.length} session(s)`, errors[0]);
    setSelectedID(next);
    void load();
  };

  const deleteKey = () => {
    const at = Date.now();
    if (!job() || at - pendingD >= DOUBLE_TAP_MS) {
      pendingD = job() ? at : 0;
      return;
    }
    pendingD = 0;
    void (archived() ? purgeJob() : archiveJob());
  };

  const cursorRun = () => history().find((r) => r.id === cursorID());
  const stepRun = (direction: "older" | "newer") => {
    const list = history();
    if (list.length === 0) return;
    const at = Math.max(0, list.findIndex((r) => r.id === cursorID()));
    setCursorID(list[stepCursor(at, direction, list.length)]!.id);
  };
  const previewRun = () => {
    const run = cursorRun();
    const target = job();
    if (!run || !target) return;
    openRunPreview({ ctx, job: target, run, colors: c, suspend: args.suspend, openSession: args.openSession });
  };

  // ---- keys (added to the dashboard's layer)

  const listFocus = () => args.active() && pane() === "list";
  const calendarFocus = () => args.active() && pane() === "calendar";
  const live = () => args.active();
  const commands = [
    { bind: "right", enabled: live, run: () => setPane("calendar") },
    { bind: "l", enabled: live, run: () => setPane("calendar") },
    { bind: "left", enabled: live, run: () => setPane("list") },
    { bind: "h", enabled: live, run: () => setPane("list") },
    { bind: "j", enabled: listFocus, run: () => select(1) },
    { bind: "k", enabled: listFocus, run: () => select(-1) },
    { bind: "down", enabled: listFocus, run: () => select(1) },
    { bind: "up", enabled: listFocus, run: () => select(-1) },
    { bind: "pagedown", enabled: listFocus, run: () => select(page()) },
    { bind: "ctrl+d", enabled: listFocus, run: () => select(page()) },
    { bind: "pageup", enabled: listFocus, run: () => select(-page()) },
    { bind: "ctrl+u", enabled: listFocus, run: () => select(-page()) },
    { bind: "home", enabled: listFocus, run: () => select(-Infinity) },
    { bind: "g", enabled: listFocus, run: topOnSecondG },
    { bind: "end", enabled: listFocus, run: () => select(Infinity) },
    { bind: "shift+g", enabled: listFocus, run: () => select(Infinity) },
    { bind: "return", enabled: () => listFocus() && !archived() && !!job(), run: () => editor(job()) },
    { bind: "e", enabled: () => listFocus() && !archived() && !!job(), run: () => editor(job()) },
    { bind: "a", enabled: () => listFocus() && !archived(), run: () => editor() },
    { bind: "d", enabled: listFocus, run: deleteKey },
    { bind: "shift+a", enabled: listFocus, run: () => (setArchived((v) => !v), setSelectedID(undefined)) },
    { bind: "u", enabled: () => listFocus() && archived() && !!job(), run: () => void restoreJob() },
    { bind: "down", enabled: calendarFocus, run: () => stepRun("newer") },
    { bind: "j", enabled: calendarFocus, run: () => stepRun("newer") },
    { bind: "up", enabled: calendarFocus, run: () => stepRun("older") },
    { bind: "k", enabled: calendarFocus, run: () => stepRun("older") },
    { bind: "return", enabled: calendarFocus, run: previewRun },
    { bind: "t", enabled: live, run: () => void toggleAgentTools() },
  ];

  const legend = () =>
    pane() === "calendar"
      ? "esc close · tab switch · ↑/↓ runs · ←/→ panes · enter preview"
      : archived()
        ? "esc close · tab switch · ↑/↓ move · ←/→ panes · u restore · dd delete · A back"
        : "esc close · tab switch · ↑/↓ move · ←/→ panes · e edit · a new · dd archive · A archive";

  // ---- calendar data

  const today = createMemo(() => new Date(now()));
  const view = createMemo<ViewKind>(() => {
    const j = job();
    if (!j) return "month";
    try {
      return chooseView(j.cron, today());
    } catch {
      return "month";
    }
  });
  const markers = createMemo(() => {
    const map = new Map<string, Marker[]>();
    const j = job();
    if (!j) return map;
    for (const day of viewDays(view(), today())) {
      try {
        map.set(day.toDateString(), markersFor(day, { expression: j.cron, runs: runs(), now: today(), createdAt: j.createdAt, scheduled: j.enabled && j.archivedAt === null }));
      } catch {
        map.set(day.toDateString(), []);
      }
    }
    return map;
  });

  // ---- rendering

  const markerColor = (status: Marker["status"]) =>
    status === "succeeded" ? c().success : status === "failed" ? c().error : status === "running" ? c().warning : c().muted;

  const MarkerLine = (props: { marker: Marker; long?: boolean }) => {
    const selected = () => pane() === "calendar" && props.marker.runId !== undefined && props.marker.runId === cursorID();
    const reason = () => (props.long ? history().find((r) => r.id === props.marker.runId)?.reason : undefined);
    return (
      <box flexDirection="row" flexShrink={0} gap={1} backgroundColor={(selected() ? c().bar : undefined) as any}>
        <text fg={(selected() ? c().accent : c().text) as any} attributes={selected() ? TextAttributes.BOLD : 0} wrapMode="none">{formatTime(props.marker.time)}</text>
        <text fg={markerColor(props.marker.status) as any} wrapMode="none">{symbolFor(props.marker.status, frame())}</text>
        <Show when={props.long}>
          <text fg={c().muted as any} wrapMode="none">{props.marker.status}{reason() ? ` · ${reason()}` : ""}</text>
        </Show>
      </box>
    );
  };

  const DayCell = (p: { day: Date; month?: number; showMonth?: boolean }) => {
    const isToday = () => sameDay(p.day, today());
    const dim = () => p.month !== undefined && p.day.getMonth() !== p.month;
    return (
      <box flexDirection="column" flexGrow={1} flexBasis={0} minWidth={0} overflow="hidden" paddingLeft={1}>
        <text
          fg={(isToday() ? c().accent : dim() ? c().muted : c().text) as any}
          attributes={isToday() ? TextAttributes.BOLD | TextAttributes.UNDERLINE : 0}
          wrapMode="none"
        >
          {p.showMonth || p.day.getDate() === 1 ? `${p.day.getDate()} ${monthName(p.day)}` : String(p.day.getDate())}
        </text>
        <For each={markers().get(p.day.toDateString()) ?? []}>{(m) => <MarkerLine marker={m} />}</For>
      </box>
    );
  };

  const MonthView = () => {
    const month = () => today().getMonth();
    return (
      <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
        <box flexDirection="row" flexShrink={0}>
          <For each={WEEKDAY_NAMES}>{(n) => <box flexGrow={1} flexBasis={0} paddingLeft={1}><text fg={c().muted as any}>{n}</text></box>}</For>
        </box>
        <scrollbox flexGrow={1} flexBasis={0} minHeight={0}>
          <For each={monthWeeks(today())}>
            {(week) => (
              <box flexDirection="row" flexShrink={0} minHeight={3}>
                <For each={week}>{(day) => <DayCell day={day} month={month()} />}</For>
              </box>
            )}
          </For>
        </scrollbox>
      </box>
    );
  };

  const WeekView = () => (
    <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
      <box flexDirection="row" flexShrink={0}>
        <For each={weekDays(today())}>
          {(day) => (
            <box flexGrow={1} flexBasis={0} paddingLeft={1}>
              <text fg={(sameDay(day, today()) ? c().accent : c().muted) as any} attributes={sameDay(day, today()) ? TextAttributes.BOLD : 0}>{`${weekdayName(day)} ${day.getDate()}`}</text>
            </box>
          )}
        </For>
      </box>
      <scrollbox flexGrow={1} flexBasis={0} minHeight={0}>
        <box flexDirection="row" flexShrink={0}>
          <For each={weekDays(today())}>
            {(day) => (
              <box flexDirection="column" flexGrow={1} flexBasis={0} minWidth={0} overflow="hidden" paddingLeft={1}>
                <For each={markers().get(day.toDateString()) ?? []}>{(m) => <MarkerLine marker={m} />}</For>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </box>
  );

  const TodayView = () => (
    <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
      <text fg={c().accent as any} attributes={TextAttributes.BOLD} flexShrink={0}>{`Today · ${weekdayName(today())} ${today().getDate()} ${monthName(today())}`}</text>
      <scrollbox flexGrow={1} flexBasis={0} minHeight={0}>
        <For each={markers().get(today().toDateString()) ?? []}>{(m) => <MarkerLine marker={m} long />}</For>
      </scrollbox>
    </box>
  );

  const detail = () => {
    const run = cursorRun();
    return run ? `${formatDate(run.scheduledFor)} · ${run.status}${run.reason ? ` · ${run.reason}` : ""}` : "";
  };

  const Calendar = () => (
    <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0} minWidth={0}>
      <Show when={job()} fallback={<text fg={c().muted as any}>No job selected.</text>}>
        {(selected) => (
          <>
            <box flexDirection="row" flexShrink={0} gap={1}>
              <text fg={(pane() === "calendar" ? c().accent : c().text) as any} attributes={TextAttributes.BOLD} wrapMode="none">{ellipsize(selected().name, 40)}</text>
              <text fg={c().muted as any} wrapMode="none">{`${selected().cron} · ${view()}`}</text>
            </box>
            <Show when={view() === "month"}><MonthView /></Show>
            <Show when={view() === "week"}><WeekView /></Show>
            <Show when={view() === "today"}><TodayView /></Show>
            <text fg={c().muted as any} flexShrink={0} wrapMode="none">{detail()}</text>
          </>
        )}
      </Show>
    </box>
  );

  const titleWidth = createMemo(() => {
    const longest = Math.max(5, ...jobs().map((j) => j.name.length));
    const width = listWidth() || 80;
    // The other columns need their room first; the title gets what is left, at most 40% of the pane.
    return Math.max(8, Math.min(longest, Math.floor(width * TITLE_SHARE), width - FIXED_COLUMNS));
  });
  const Cell = (p: { width?: number; color: unknown; bold?: boolean; children: string }) => (
    <box flexShrink={0} width={p.width} minWidth={0} overflow="hidden">
      <text fg={p.color as any} attributes={p.bold ? TextAttributes.BOLD : 0} wrapMode="none">{p.children}</text>
    </box>
  );
  const Columns = (p: { marker: string; title: string; last: string; outcome: string; outcomeColor: unknown; next: string; color: unknown; bold?: boolean; onSelect?: () => void }) => (
    <box flexDirection="row" flexShrink={0} height={1} gap={1} onMouseUp={p.onSelect}>
      <box flexShrink={0} width={1}><text fg={c().accent as any}>{p.marker}</text></box>
      <Cell width={titleWidth()} color={p.color} bold={p.bold}>{ellipsize(p.title, titleWidth())}</Cell>
      <Cell width={DATE_WIDTH} color={p.color} bold={p.bold}>{p.last}</Cell>
      <box flexShrink={0} width={1}><text fg={p.outcomeColor as any}>{p.outcome}</text></box>
      <Cell width={DATE_WIDTH} color={p.color} bold={p.bold}>{p.next}</Cell>
    </box>
  );
  const nextOf = (j: Job) => {
    if (!j.enabled || j.archivedAt !== null) return "disabled";
    try {
      const next = nextRuns(j.cron, 1, today())[0];
      return next ? formatDate(next.getTime()) : "—";
    } catch {
      return "invalid cron";
    }
  };
  const JobRow = (p: { job: Job; selected: boolean }) => {
    const last = () => lastRuns()[p.job.id];
    const status = () => (last() ? (last()!.status === "succeeded" ? "succeeded" : last()!.status === "failed" ? "failed" : "running") : "none");
    const dimmed = () => !p.job.enabled;
    return (
      <Columns
        marker={p.selected ? "▌" : " "}
        title={p.job.name}
        last={last() ? formatDate(last()!.scheduledFor) : ""}
        outcome={symbolFor(status(), frame())}
        outcomeColor={markerColor(status() === "none" ? "missing" : (status() as Marker["status"]))}
        next={nextOf(p.job)}
        color={dimmed() ? c().muted : c().text}
        bold={p.selected}
        onSelect={() => setSelectedID(p.job.id)}
      />
    );
  };

  const List = () => (
    <box
      flexDirection="column"
      flexGrow={1}
      flexBasis={0}
      minHeight={0}
      minWidth={0}
      onSizeChange={function (this: { width: number }) {
        const width = this.width;
        queueMicrotask(() => setListWidth(width));
      }}
    >
      <Show when={archived()}>
        <text fg={c().warning as any} flexShrink={0} wrapMode="none">Archive</text>
      </Show>
      <Columns marker=" " title="Title" last="Last run" outcome=" " outcomeColor={c().muted} next="Next run" color={pane() === "list" ? c().accent : c().muted} />
      <scrollbox ref={(el: any) => (scroll = el)} flexGrow={1} flexBasis={0} minHeight={0}>
        <For
          each={jobs()}
          fallback={<text fg={c().muted as any} wrapMode="word">{problem() ?? (archived() ? "The archive is empty." : "No jobs yet. Press a to add one.")}</text>}
        >
          {(item) => <JobRow job={item} selected={item.id === job()?.id} />}
        </For>
      </scrollbox>
    </box>
  );

  const Tab = () => (
    <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0}>
      <box flexDirection="row" flexGrow={1} flexBasis={0} minHeight={0} gap={2}>
        <Show when={!args.small() || pane() === "list"}>
          <List />
        </Show>
        <Show when={!args.small() || pane() === "calendar"}>
          <Calendar />
        </Show>
      </box>
      <box flexDirection="row" flexShrink={0} justifyContent="flex-end">
        <text fg={(agentTools() ? c().accent : c().muted) as any} onMouseUp={() => void toggleAgentTools()}>
          {`${TOOLS_ICON} agent tools ${agentTools() ? "ON" : "OFF"} (t)`}
        </text>
      </box>
    </box>
  );

  return { Tab, commands, legend };
}
