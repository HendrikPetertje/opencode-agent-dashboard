import { useTerminalDimensions } from "@opentui/solid";
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";

const MIN_PROMPT_ROW = 16;
const MEASURE_INTERVAL_MS = 1000;

/**
 * An invisible marker for the `session.composer.top` slot that reports its screen row, so the modal (drawn from the
 * `app` slot, since anything inside the session pane is painted under the sidebar) can end one cell above the prompt.
 */
export function createPromptAnchor() {
  const [promptTop, setPromptTop] = createSignal<number | undefined>();

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

  return { promptTop, Anchor };
}
