import { EditorView } from "@codemirror/view";

export function measureHeadingTopsBatchCM(view: EditorView, outline: { offset: number }[]): number[] {
  const baseTop = view.scrollDOM.getBoundingClientRect().top;
  return outline.map(h => {
    const c = view.coordsAtPos(h.offset);
    return ((c?.top ?? baseTop) - baseTop);
  });
}