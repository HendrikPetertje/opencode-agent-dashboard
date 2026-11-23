import { createEffect, createMemo, createSignal, For, on, onCleanup } from "solid-js";
import { previewMessages, type PreviewLine } from "./messages.ts";

const DEBOUNCE_MS = 100;

export interface PreviewColors {
  text: unknown;
  muted: unknown;
  accent: unknown;
  bar: unknown;
  surface: unknown;
}

/** The last messages of a session, loaded when the session changes (debounced, so scrolling a list stays cheap). */
export function createMessagePreview(ctx: any, sessionID: () => string | undefined): () => PreviewLine[] {
  const [loaded, setLoaded] = createSignal(0);
  createEffect(
    on(sessionID, (id) => {
      if (!id) return;
      const timer = setTimeout(() => void ctx.data.session.message.sync(id).then(() => setLoaded((n) => n + 1)), DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    }),
  );
  return createMemo(() => {
    loaded();
    const id = sessionID();
    return id ? previewMessages(ctx.data.session.message.list(id) as any) : [];
  });
}

/** Assistant messages as plain text on the dark pane, user messages in a lighter box with a vertical line. */
export function MessagePreview(props: { lines: () => PreviewLine[]; empty: () => string; colors: () => PreviewColors }) {
  return (
    <box flexDirection="column" flexGrow={1} flexBasis={0} minHeight={0} backgroundColor={props.colors().bar as any}>
      <scrollbox flexGrow={1} flexBasis={0} minHeight={0} stickyScroll stickyStart="bottom" paddingTop={1} paddingLeft={1} paddingRight={1}>
        <For each={props.lines()} fallback={<text fg={props.colors().muted as any}>{props.empty()}</text>}>
          {(line) =>
            line.role === "user" ? (
              <box
                flexShrink={0}
                marginBottom={1}
                border={["left"]}
                borderStyle="heavy"
                borderColor={props.colors().accent as any}
                backgroundColor={props.colors().surface as any}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
              >
                <text fg={props.colors().text as any} wrapMode="word">{line.text}</text>
              </box>
            ) : (
              <box flexShrink={0} marginBottom={1} paddingLeft={2}>
                <text fg={props.colors().text as any} wrapMode="word">{line.text}</text>
              </box>
            )
          }
        </For>
      </scrollbox>
    </box>
  );
}
