/** At or below this many columns the modal gets small margins and drops the preview pane. */
export const SMALL_WIDTH = 100;
const MIN_WIDTH = 20;
const MIN_HEIGHT = 8;

export interface ModalLayout {
  small: boolean;
  margin: number;
  width: number;
  height: number;
}

/** The modal fills the terminal minus a margin on each side: 4 normally, 2 on small terminals. */
export function modalLayout(columns: number, rows: number): ModalLayout {
  const small = columns <= SMALL_WIDTH;
  const margin = small ? 2 : 4;
  return {
    small,
    margin,
    width: Math.max(MIN_WIDTH, columns - 2 * margin),
    height: Math.max(MIN_HEIGHT, rows - 2 * margin),
  };
}
