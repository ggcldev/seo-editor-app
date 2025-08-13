import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { usePasteToMarkdown } from "../hooks/usePasteToMarkdown";
import { scrollSpyPlugin } from "../cmScrollSpy";
import type { Heading } from "../hooks/useOutline";

type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  onReady?: (view: EditorView) => void;
  getOutline: () => Heading[];
  onActiveHeadingChange: (id: string | null, source: 'scrollspy' | 'caret') => void;
  onScrollSpyReady?: (suppress: (ms?: number) => void) => void;
};

export type CMHandle = {
  setSelectionAt(pos: number): void;
  scrollToOffsetExact(pos: number, bias?: "top" | "center" | "third"): void;
  getView(): EditorView | null;
};

const STYLES = {
  main: { padding: 0, background: "#f6f6f6", height: "100vh" },
  container: { height: "100%", padding: 24, boxSizing: "border-box" as const, display: "flex", justifyContent: "center" },
  wrapper: (narrow: boolean) =>
    ({ position: "relative", width: "100%", maxWidth: narrow ? 760 : "100%", overflow: "hidden" } as const),
  button: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    zIndex: 1,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#374151",
    cursor: "pointer"
  },
  editorHost: { height: "calc(100vh - 48px)", width: "100%", paddingTop: 32, background: "#f6f6f6" }
} as const;

// ---- helpers ---------------------------------------------------------------

function findHeadingForPos(outline: Heading[], pos: number): { h: Heading; nextOffset: number } | null {
  if (!outline.length) return null;
  // Find last heading with offset <= pos
  let idx = -1;
  for (let i = 0; i < outline.length; i++) {
    if (outline[i].offset <= pos) idx = i; else break;
  }
  if (idx < 0) return null;
  const h = outline[idx];
  const nextOffset = outline[idx + 1]?.offset ?? Number.POSITIVE_INFINITY;
  return { h, nextOffset };
}

export const CMEditor = React.forwardRef<CMHandle, Props>(function CMEditor(
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, onReady, getOutline, onActiveHeadingChange, onScrollSpyReady },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);
  const getOutlineRef = useRef(getOutline);
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange);

  useEffect(() => { onChangeRef.current = setMarkdown; }, [setMarkdown]);
  useEffect(() => { onCaretRef.current = onCaretChange; }, [onCaretChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { getOutlineRef.current = getOutline; }, [getOutline]);
  useEffect(() => { onActiveHeadingChangeRef.current = onActiveHeadingChange; }, [onActiveHeadingChange]);

  const { htmlToMarkdown } = usePasteToMarkdown();
  const htmlToMdRef = useRef(htmlToMarkdown);
  useEffect(() => { htmlToMdRef.current = htmlToMarkdown; }, [htmlToMarkdown]);

  useEffect(() => {
    // Prefer a lower anchor so spy naturally favors the current section
    const scrollSpy = scrollSpyPlugin(
      () => getOutlineRef.current(),
      (id, source) => onActiveHeadingChangeRef.current(id, source),
      "third"
    );

    const state = EditorState.create({
      doc: markdown,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        mdLang(),
        EditorView.lineWrapping,
        highlightActiveLine(),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto", height: "100%", WebkitOverflowScrolling: "touch" as any },
          ".cm-content": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "14px",
            lineHeight: "1.8"
          }
        }),
        EditorView.updateListener.of((u) => {
          // Keep upstream state in sync
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          if (u.selectionSet) onCaretRef.current(u.state.selection.main.head);

          // 👇 CARET-WINS rule: if caret is on a heading line, force that heading active.
          // This prevents the outline highlight from jumping to the previous header while you edit.
          if (u.selectionSet || u.docChanged) {
            const pos = u.state.selection.main.head;
            const outline = getOutlineRef.current();
            const match = findHeadingForPos(outline, pos);
            if (match) {
              const lineAtHeading = u.state.doc.lineAt(match.h.offset);
              const caretLine = u.state.doc.lineAt(pos);
              const caretOnHeadingLine = caretLine.from === lineAtHeading.from; // caret is on the heading line itself
              // Also ensure caret is still within this heading's section range
              if (caretOnHeadingLine && pos >= match.h.offset && pos < match.nextOffset) {
                onActiveHeadingChangeRef.current(match.h.id, 'caret');
              }
            }
          }
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const html = (event as ClipboardEvent).clipboardData?.getData("text/html");
            if (!html) return false;
            event.preventDefault();
            const md = htmlToMdRef.current(html);
            const sel = view.state.selection.main;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: md },
              selection: EditorSelection.cursor(sel.from + md.length)
            });
            return true;
          }
        }),
        scrollSpy.plugin,
      ]
    });

    const parent = hostRef.current;
    if (!parent) return;
    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onReadyRef.current?.(view);
    onScrollSpyReady?.(scrollSpy.suppress);

    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  // Prop → editor sync (preserve full selection range)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur !== markdown) {
      const sel = view.state.selection.main;
      const a = Math.min(markdown.length, sel.anchor);
      const h = Math.min(markdown.length, sel.head);
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: markdown },
        selection: EditorSelection.range(a, h)
      });
    }
  }, [markdown]);

  useImperativeHandle(
    ref,
    () => ({
      setSelectionAt(pos: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: EditorSelection.cursor(pos) });
        view.focus();
      },
      scrollToOffsetExact(pos: number, bias: "top" | "center" | "third" = "third") {
        const y = bias === "top" ? "start" : "center";
        viewRef.current?.dispatch({ effects: EditorView.scrollIntoView(pos, { y }) });
      },
      getView() { return viewRef.current; }
    }),
    []
  );

  const wrapperStyle = useMemo(() => STYLES.wrapper(narrow), [narrow]);

  return (
    <main style={STYLES.main}>
      <div style={STYLES.container}>
        <div style={wrapperStyle}>
          <button
            type="button"
            onClick={toggleNarrow}
            style={STYLES.button}
            aria-label={narrow ? "Switch to full width" : "Switch to narrow width"}
            aria-pressed={narrow}
          >
            {narrow ? "Full width" : "Narrow width"}
          </button>
          <div ref={hostRef} style={STYLES.editorHost} />
        </div>
      </div>
    </main>
  );
});