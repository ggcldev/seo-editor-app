import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { usePasteToMarkdown } from "../hooks/usePasteToMarkdown";
import { scrollSpyPlugin } from "../cmScrollSpy";
import type { Heading } from "../hooks/useOutline";


type Props = {
  markdown: string;                              // current doc text
  setMarkdown: (v: string) => void;              // propagate changes up
  onCaretChange: (pos: number) => void;           // selection head
  narrow: boolean;
  toggleNarrow: () => void;
  onReady?: (view: EditorView) => void;           // informs parent about the live EditorView
  // NEW:
  getOutline: () => Heading[];
  onActiveHeadingChange: (id: string | null) => void;
};

export type CMHandle = {
  setSelectionAt(pos: number): void;
  scrollToOffsetExact(pos: number, bias?: "top" | "center" | "third"): void;
  getView(): EditorView | null;
};

const STYLES = {
  main: { padding: 0, background: "#f6f6f6", height: "100vh" },
  container: {
    height: "100%",
    padding: 24,
    boxSizing: "border-box" as const,
    display: "flex",
    justifyContent: "center"
  },
  wrapper: (narrow: boolean) =>
    ({
      position: "relative",
      width: "100%",
      maxWidth: narrow ? 760 : "100%",
      overflow: "hidden"
    } as const),
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
  editorHost: {
    height: "calc(100vh - 48px)",
    width: "100%",
    paddingTop: 32,
    background: "#f6f6f6"
  }
} as const;

export const CMEditor = React.forwardRef<CMHandle, Props>(function CMEditor(
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, onReady, getOutline, onActiveHeadingChange },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Keep latest callbacks in refs so the editor init effect can be [] (init once)
  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);
  const getOutlineRef = useRef(getOutline);
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange);

  useEffect(() => {
    onChangeRef.current = setMarkdown;
  }, [setMarkdown]);
  useEffect(() => {
    onCaretRef.current = onCaretChange;
  }, [onCaretChange]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    getOutlineRef.current = getOutline;
  }, [getOutline]);
  useEffect(() => {
    onActiveHeadingChangeRef.current = onActiveHeadingChange;
  }, [onActiveHeadingChange]);

  // HTML→Markdown paste converter (from your hook)
  const { htmlToMarkdown } = usePasteToMarkdown();
  const htmlToMdRef = useRef(htmlToMarkdown);
  useEffect(() => {
    htmlToMdRef.current = htmlToMarkdown;
  }, [htmlToMarkdown]);

  // Initialize CodeMirror ONCE (Strict-Mode safe with proper cleanup)
  useEffect(() => {
    const state = EditorState.create({
      doc: markdown,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        mdLang(),
        EditorView.lineWrapping,
        highlightActiveLine(),
        // Layout/theme to ensure scrolling is enabled and smooth
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": {
            overflow: "auto",
            height: "100%",
            WebkitOverflowScrolling: "touch" as any
          },
          ".cm-content": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "14px",
            lineHeight: "1.8"
          }
        }),
        // Sync CM → React
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          if (u.selectionSet) onCaretRef.current(u.state.selection.main.head);
        }),
        // DOM event plumbing: HTML→MD paste only
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const html = (event as ClipboardEvent).clipboardData?.getData("text/html");
            if (!html) return false;
            event.preventDefault();
            const md = htmlToMdRef.current(html);
            const sel = view.state.selection.main;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: md },
              selection: { anchor: sel.from + md.length }
            });
            return true;
          }
        }),
        // 🔥 Native CM6 scroll-spy
        scrollSpyPlugin(
          () => getOutlineRef.current(),
          (id) => onActiveHeadingChangeRef.current(id),
          "center"
        ),
      ]
    });

    const parent = hostRef.current;
    if (!parent) return;
    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onReadyRef.current?.(view);

    return () => {
      view.destroy();
      viewRef.current = null; // important for Strict Mode remounts
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  // External prop → editor doc sync (preserve selection)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur !== markdown) {
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: markdown },
        selection: { anchor: Math.min(markdown.length, sel.anchor) }
      });
    }
  }, [markdown]);

  // Expose helpers to parent
  useImperativeHandle(
    ref,
    () => ({
      setSelectionAt(pos: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: { anchor: pos } });
        view.focus();
      },
      scrollToOffsetExact(pos: number, bias: "top" | "center" | "third" = "third") {
        const y = bias === "top" ? "start" : "center"; // 'third' behaves like center in CM
        viewRef.current?.dispatch({ effects: EditorView.scrollIntoView(pos, { y }) });
      },
      getView() {
        return viewRef.current;
      }
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
          >
            {narrow ? "Full width" : "Squeeze"}
          </button>

          <div ref={hostRef} style={STYLES.editorHost} />
        </div>
      </div>
    </main>
  );
});