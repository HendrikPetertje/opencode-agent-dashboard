import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { nextRuns, validateCron } from "../shared/cron.ts";
import { formatDate } from "../../shared/text.ts";
import type { Job } from "../shared/types.ts";
import { createPicker } from "./picker.tsx";
import { newlineBindings } from "../shared/format.ts";
import type { Palette } from "../../shared/theme.ts";

export interface EditorArgs {
  ctx: any;
  /** The job to edit, or undefined for a new one. */
  job?: Job;
  defaultFolder: string;
  colors: () => Palette;
  call: (method: string, input: unknown) => Promise<any>;
  suspend: (value: boolean) => void;
  onSaved: (job: Job) => void;
}

type Field = "name" | "folder" | "agent" | "model" | "minutes" | "enabled" | "prompt" | "cron";
const LABELS: Record<Field, string> = {
  name: "Name",
  folder: "Folder",
  agent: "Agent",
  model: "Model",
  minutes: "Max minutes",
  enabled: "Enabled",
  prompt: "Prompt",
  cron: "Cron",
};
const TEXT_FIELDS: Field[] = ["name", "folder", "minutes", "prompt", "cron"];
const AGENT_DEFAULT = "";
const MODEL_DEFAULT = "";
const LABEL_WIDTH = 13;

interface Option {
  value: string;
  label: string;
}

/** Opens the job editor above the dashboard. */
export function openJobEditor(args: EditorArgs): void {
  args.suspend(true);
  args.ctx.ui.dialog.show(
    () => <JobEditor {...args} />,
    () => args.suspend(false),
  );
  args.ctx.ui.dialog.set({ size: "xlarge", centered: true });
}

function JobEditor(args: EditorArgs) {
  const { ctx, job } = args;
  const dims = useTerminalDimensions();
  const c = () => args.colors();
  const location = (directory: string) => ({ location: { directory } });

  const [name, setName] = createSignal(job?.name ?? "");
  const [folder, setFolder] = createSignal(job?.folder ?? args.defaultFolder);
  const [agent, setAgent] = createSignal(job?.agent ?? AGENT_DEFAULT);
  const [model, setModel] = createSignal(job?.model ?? MODEL_DEFAULT);
  const [minutes, setMinutes] = createSignal(String(job?.timeoutMinutes ?? 30));
  const [enabled, setEnabled] = createSignal(job?.enabled ?? true);
  const [cron, setCron] = createSignal(job?.cron ?? "");
  const [error, setError] = createSignal<string | undefined>();
  const [saving, setSaving] = createSignal(false);
  const [agents, setAgents] = createSignal<Option[]>([]);
  const [models, setModels] = createSignal<Option[]>([{ value: MODEL_DEFAULT, label: "agent default" }]);
  let prompt: any;

  const fields = createMemo<Field[]>(() => [
    "name",
    "folder",
    "agent",
    "model",
    "minutes",
    "enabled",
    "prompt",
    "cron",
  ]);
  const [focusAt, setFocusAt] = createSignal(0);
  const field = () => fields()[Math.min(focusAt(), fields().length - 1)]!;
  const onText = () => TEXT_FIELDS.includes(field());
  const move = (step: number) => {
    picker.close();
    setFocusAt((now) => (now + step + fields().length) % fields().length);
  };

  // Agents and models of the chosen folder (a project can define its own agents).
  createEffect(
    on(folder, (directory) => {
      const timer = setTimeout(async () => {
        try {
          const [agentReply, modelReply]: any[] = await Promise.all([ctx.client.agent.list(location(directory)), ctx.client.model.list(location(directory))]);
          const list = ((agentReply?.data ?? []) as any[]).filter((a) => !a.hidden && a.mode !== "subagent");
          setAgents(list.map((a) => ({ value: String(a.id), label: String(a.name ?? a.id) })));
          if (!agent() || !list.some((a) => a.id === agent())) setAgent(String((list.find((a) => a.id === "build") ?? list[0])?.id ?? AGENT_DEFAULT));
          setModels([
            { value: MODEL_DEFAULT, label: "agent default" },
            ...((modelReply?.data ?? []) as any[]).filter((m) => m.enabled !== false).map((m) => ({ value: `${m.providerID}/${m.modelID ?? m.id}`, label: `${m.providerID}/${m.modelID ?? m.id}` })),
          ]);
        } catch {}
      }, 300);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  const options = (which: "agent" | "model") => (which === "agent" ? agents() : models());
  const labelOf = (which: "agent" | "model", value: string) => options(which).find((o) => o.value === value)?.label ?? (value || (which === "model" ? "agent default" : "no agent for this folder"));
  const picker = createPicker({
    colors: args.colors,
    options,
    onPick: (which, value) => (which === "agent" ? setAgent(value) : setModel(value)),
    left: LABEL_WIDTH + 4,
    top: 4,
    width: () => Math.max(30, Math.min(72, dims().width - 30)),
  });

  const preview = createMemo(() => {
    const error = validateCron(cron());
    if (error) return { error } as const;
    return { runs: nextRuns(cron(), 3).map(formatDate) } as const;
  });

  const save = async () => {
    if (saving()) return;
    setError(undefined);
    setSaving(true);
    try {
      const reply = await args.call("save", {
        job: {
          id: job?.id,
          name: name(),
          folder: folder(),
          agent: agent(),
          model: model(),
          timeoutMinutes: Number(minutes()),
          enabled: enabled(),
          prompt: prompt?.plainText ?? job?.prompt ?? "",
          cron: cron(),
        },
      });
      ctx.ui.dialog.clear();
      args.onSaved(reply.job);
    } catch (e) {
      setError((e as Error).message || "Could not save the job");
    } finally {
      setSaving(false);
    }
  };

  const stepPrompt = (direction: 1 | -1) => {
    const before = prompt?.cursorOffset;
    if (direction === 1) prompt?.moveCursorDown?.();
    else prompt?.moveCursorUp?.();
    if (prompt?.cursorOffset === before) move(direction);
  };

  const toggle = () => {
    const f = field();
    if (f === "enabled") setEnabled((v) => !v);
    else if (f === "agent" || f === "model") picker.open(f);
  };

  ctx.keymap.layer(() => ({
    mode: "global",
    priority: 100,
    commands: [
      { bind: "tab", enabled: () => !picker.isOpen(), run: () => move(1) },
      { bind: "shift+tab", enabled: () => !picker.isOpen(), run: () => move(-1) },
      { bind: "ctrl+s", run: () => void save() },
      { bind: "down", enabled: () => !picker.isOpen(), run: () => (field() === "prompt" ? stepPrompt(1) : move(1)) },
      { bind: "up", enabled: () => !picker.isOpen(), run: () => (field() === "prompt" ? stepPrompt(-1) : move(-1)) },
      { bind: "return", enabled: () => !onText() && !picker.isOpen(), run: toggle },
      { bind: "space", enabled: () => !onText() && !picker.isOpen() && field() === "enabled", run: toggle },
      { bind: "left", enabled: () => !onText() && !picker.isOpen() && field() === "enabled", run: toggle },
      { bind: "right", enabled: () => !onText() && !picker.isOpen() && field() === "enabled", run: toggle },
      ...picker.commands,
    ],
  }));

  const fieldWidth = () => Math.max(20, Math.min(90, dims().width - 30));
  const promptHeight = () => Math.max(3, Math.min(8, dims().height - 28));
  const bindings = newlineBindings(ctx.keymap.shortcuts?.("input.newline"));

  const Row = (props: { field: Field; children: any }) => (
    <box flexDirection="row" flexShrink={0} gap={1}>
      <box width={LABEL_WIDTH} flexShrink={0}>
        <text fg={(field() === props.field ? c().accent : c().muted) as any} attributes={field() === props.field ? TextAttributes.BOLD : 0}>{LABELS[props.field]}</text>
      </box>
      {props.children}
    </box>
  );
  const Static = (props: { field: "agent" | "model" | "enabled"; value: () => string }) => (
    <box flexShrink={0} backgroundColor={(field() === props.field ? c().bar : c().surface) as any} paddingLeft={1} paddingRight={1} onMouseUp={() => setFocusAt(fields().indexOf(props.field))}>
      <text fg={c().text as any}>{props.value()}</text>
    </box>
  );
  /** The agent and model rows show the current choice and a gray reminder that ENTER opens the picker. */
  const Choice = (props: { field: "agent" | "model"; value: () => string }) => (
    <box flexDirection="row" flexShrink={0} gap={1}>
      <Static field={props.field} value={props.value} />
      <text fg={c().muted as any} wrapMode="none">press ENTER</text>
    </box>
  );
  const shown = (on: boolean) => (on ? "[x] on" : "[ ] off");
  const inputColors = () => ({ backgroundColor: c().surface as any, focusedBackgroundColor: c().bar as any, textColor: c().text as any, cursorColor: c().accent as any });

  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2} gap={1}>
      <text fg={c().text as any} attributes={TextAttributes.BOLD}>{job ? "Edit job" : "New job"}</text>
      <box flexDirection="column" flexShrink={0}>
        <Row field="name">
          <input width={fieldWidth()} value={name()} placeholder="Nightly dependency check" focused={!picker.isOpen() && field() === "name"} onInput={(v: string) => setName(v)} {...inputColors()} />
        </Row>
        <Row field="folder">
          <input width={fieldWidth()} value={folder()} placeholder="/path/to/project" focused={!picker.isOpen() && field() === "folder"} onInput={(v: string) => setFolder(v)} {...inputColors()} />
        </Row>
        <Row field="agent">
          <Choice field="agent" value={() => labelOf("agent", agent())} />
        </Row>
        <Row field="model">
          <Choice field="model" value={() => labelOf("model", model())} />
        </Row>
        <Row field="minutes">
          <input width={8} value={minutes()} focused={!picker.isOpen() && field() === "minutes"} onInput={(v: string) => setMinutes(v)} {...inputColors()} />
        </Row>
        <Row field="enabled">
          <Static field="enabled" value={() => shown(enabled())} />
        </Row>
        <Row field="prompt">
          <textarea
            ref={(el: any) => (prompt = el)}
            width={fieldWidth()}
            height={promptHeight()}
            initialValue={job?.prompt ?? ""}
            placeholder="What should the agent do?"
            focused={!picker.isOpen() && field() === "prompt"}
            keyBindings={[...bindings, { name: "return", action: "submit" }]}
            onSubmit={() => move(1)}
            {...inputColors()}
          />
        </Row>
        <Row field="cron">
          <input width={fieldWidth()} value={cron()} placeholder="0 9 * * 1-5" focused={!picker.isOpen() && field() === "cron"} onInput={(v: string) => setCron(v)} {...inputColors()} />
        </Row>
        <box marginLeft={LABEL_WIDTH + 1} flexDirection="column" flexShrink={0}>
          <Show
            when={"runs" in preview() ? (preview() as { runs: string[] }).runs : undefined}
            fallback={<text fg={c().error as any}>{(preview() as { error: string }).error}</text>}
          >
            {(runs) => (
              <>
                <text fg={c().muted as any}>Next runs</text>
                <For each={runs()}>{(run) => <text fg={c().text as any}>{run}</text>}</For>
              </>
            )}
          </Show>
        </box>
      </box>
      <Show when={error()}>
        <text fg={c().error as any} wrapMode="word">{error()}</text>
      </Show>
      <picker.Overlay />
      <text fg={c().muted as any} flexShrink={0} wrapMode="none">↑/↓ or tab/shift+tab fields · enter opens a picker · ctrl+s save · esc cancel · prompt: configured newline key adds a line</text>
    </box>
  );
}
