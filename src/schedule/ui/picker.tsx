import { TextAttributes } from "@opentui/core";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { fuzzyFilter } from "../../shared/fuzzy.ts";
import type { Palette } from "../../shared/theme.ts";

const PICKER_ROWS = 10;

export interface PickerOption {
  value: string;
  label: string;
}

export type PickerField = "agent" | "model";

export interface PickerArgs {
  colors: () => Palette;
  options: (field: PickerField) => PickerOption[];
  /** The picked option's value for the field. */
  onPick: (field: PickerField, value: string) => void;
  /** Position and width of the panel inside the editor's dialog. */
  left: number;
  top: number;
  width: () => number;
}

/**
 * A modal panel inside the editor's dialog (a dialog cannot be opened from inside another without replacing it): a
 * filter input that takes focus, the fuzzy-filtered options and a count. Its keys are returned as `commands`, enabled
 * only while the picker is open, so the editor adds them to its own key layer.
 */
export function createPicker(args: PickerArgs) {
  const c = () => args.colors();
  const [state, setState] = createSignal<{ field: PickerField; query: string; index: number } | undefined>();
  let list: any;

  const matches = createMemo(() => {
    const open = state();
    return open ? fuzzyFilter(args.options(open.field), open.query) : [];
  });
  // Keep the highlighted match in view while moving through the list.
  createEffect(() => {
    const open = state();
    if (open) list?.scrollTo?.(Math.max(0, open.index - Math.floor(PICKER_ROWS / 2)));
  });

  const isOpen = () => !!state();
  const open = (field: PickerField) => setState({ field, query: "", index: 0 });
  const close = () => setState(undefined);
  const choose = () => {
    const now = state();
    const choice = now && matches()[now.index];
    if (now && choice) args.onPick(now.field, choice.value);
    close();
  };
  const move = (step: number) => setState((now) => now && { ...now, index: Math.max(0, Math.min(matches().length - 1, now.index + step)) });

  const commands = [
    {
      bind: "escape",
      enabled: isOpen,
      run: (_input?: string, event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        close();
      },
    },
    { bind: "down", enabled: isOpen, run: () => move(1) },
    { bind: "ctrl+n", enabled: isOpen, run: () => move(1) },
    { bind: "up", enabled: isOpen, run: () => move(-1) },
    { bind: "ctrl+p", enabled: isOpen, run: () => move(-1) },
    { bind: "return", enabled: isOpen, run: choose },
  ];

  const Overlay = () => (
    <Show when={state()}>
      {(now) => (
        <box
          position="absolute"
          left={args.left}
          top={args.top}
          width={args.width()}
          zIndex={20}
          flexDirection="column"
          border
          borderStyle="rounded"
          borderColor={c().muted as any}
          backgroundColor={c().bar as any}
          paddingLeft={1}
          paddingRight={1}
        >
          <box flexDirection="row" flexShrink={0} gap={1}>
            <text fg={c().accent as any} attributes={TextAttributes.BOLD}>{now().field === "model" ? "Pick a model" : "Pick an agent"}</text>
            <text fg={c().muted as any}>{`${matches().length}/${args.options(now().field).length}`}</text>
          </box>
          <input
            focused
            value={now().query}
            placeholder="type to filter"
            onInput={(value: string) => setState((previous) => previous && { ...previous, query: value, index: 0 })}
            backgroundColor={c().surface as any}
            focusedBackgroundColor={c().surface as any}
            textColor={c().text as any}
            cursorColor={c().accent as any}
          />
          <box height={Math.max(1, Math.min(PICKER_ROWS, matches().length))} flexShrink={0}>
            <scrollbox ref={(el: any) => (list = el)} flexGrow={1} flexBasis={0} minHeight={0}>
              <For each={matches()} fallback={<text fg={c().muted as any}>No match</text>}>
                {(option, i) => (
                  <box
                    flexShrink={0}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={(i() === now().index ? c().surface : undefined) as any}
                    onMouseUp={() => (setState((previous) => previous && { ...previous, index: i() }), choose())}
                  >
                    <text fg={(i() === now().index ? c().accent : c().text) as any} attributes={i() === now().index ? TextAttributes.BOLD : 0} wrapMode="none">{option.label}</text>
                  </box>
                )}
              </For>
            </scrollbox>
          </box>
          <text fg={c().muted as any} flexShrink={0} wrapMode="none">↑/↓ move · enter pick · esc back</text>
        </box>
      )}
    </Show>
  );

  return { isOpen, open, close, commands, Overlay };
}
