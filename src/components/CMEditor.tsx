import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { usePasteToMarkdown } from "../hooks/usePasteToMarkdown";

type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onScroll: (e?: unknown) => void;           // keep prop for parity
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  onReady?: (view: EditorView) => void; // NEW
};

export type CMHandle = {
  setSelectionAt(pos: number): void;
  scrollToOffsetExact(pos: number, bias?: "top" | "center" | "third"): void;
  getView(): EditorView | null;
};

const STYLES = {
  main: { padding: 0, background: "#f6f6f6", height: "100vh" },
  container: { height: "100%", padding: 24, boxSizing: "border-box" as const, display: "flex", justifyContent: "center" },
  wrapper: (narrow: boolean) => ({ position: "relative" as const, width: "100%", maxWidth: narrow ? 760 : "100%", overflow: "hidden" }),
  button: {
    position: "absolute" as const, top: 8, right: 8, zIndex: 1, fontSize: 12, padding: "6px 10px",
    borderRadius: 8, border: "1px solid #e5e7eb", background: "#ffffff", color: "#374151", cursor: "pointer"
  },
  editorHost: { 
    height: "calc(100vh - 48px)", 
    paddingTop: 32, 
    background: "#f6f6f6",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
    fontSize: "14px",
    lineHeight: "1.5"
  },
  scrollbarTrack: {
    position: "absolute" as const, top: 32, right: 8, bottom: 16, width: 8, borderRadius: 4,
    background: "rgba(203, 213, 225, 0.3)", pointerEvents: "none" as const, zIndex: 1, transition: "opacity 0.3s ease"
  },
  scrollbarThumb: (topPx: number, heightPct: number) => ({
    position: "absolute" as const, top: `${Math.round(topPx)}px`, width: "100%",
    height: `${heightPct}%`, background: "#cbd5e1", borderRadius: 4, transition: "transform 0.1s ease"
  })
} as const;

export const CMEditor = React.forwardRef<CMHandle, Props>(function CMEditor(
  { markdown, setMarkdown, onScroll, onCaretChange, narrow, toggleNarrow, onReady }, ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // custom scrollbar state (matches your previous overlay)
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [thumbTopPx, setThumbTopPx] = useState(0);
  const [thumbSizePct, setThumbSizePct] = useState(20);
  const hideTimeoutRef = useRef<number | undefined>(undefined);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const showScrollbars = useMemo(() => {
    return () => {
      setShowScrollbar(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = window.setTimeout(() => setShowScrollbar(false), 900);
    };
  }, []);
  useEffect(() => () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }, []);

  const { htmlToMarkdown } = usePasteToMarkdown();

  // init view
  useEffect(() => {
    if (viewRef.current) return;
    const state = EditorState.create({
      doc: markdown,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        mdLang(),
        EditorView.lineWrapping,
        highlightActiveLine(),
        // Basic theme to match your editor style
        EditorView.theme({
          "&": {
            fontSize: "14px",
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
          },
          ".cm-content": {
            padding: "16px",
            minHeight: "100%",
            backgroundColor: "#f6f6f6"
          },
          ".cm-editor": {
            height: "100%",
            backgroundColor: "#f6f6f6"
          },
          ".cm-scroller": {
            fontFamily: "inherit"
          },
          ".cm-focused": {
            outline: "none"
          }
        }),
        // sync to React
        EditorView.updateListener.of((u) => {
          if (u.docChanged) setMarkdown(u.state.doc.toString());
          if (u.selectionSet) onCaretChange(u.state.selection.main.head);
          if (u.viewportChanged) onScroll?.();
        }),
        // HTML→Markdown paste (like your textarea handler)
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const html = (event as ClipboardEvent).clipboardData?.getData("text/html");
            if (!html) return false;
            event.preventDefault();
            const md = htmlToMarkdown(html);
            const sel = view.state.selection.main;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: md },
              selection: { anchor: sel.from + md.length }
            });
            return true;
          },
          scroll: () => onScroll?.(),
          mousemove: () => showScrollbars(),
          mouseenter: () => showScrollbars()
        })
      ]
    });
    const view = new EditorView({ state, parent: hostRef.current! });
    viewRef.current = view;
    // notify parent so hooks can use the live view instance
    onReady?.(view);
    return () => view.destroy();
  }, [markdown, setMarkdown, onCaretChange, onScroll, htmlToMarkdown, showScrollbars]);

  // external value updates (rare—kept for parity)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur !== markdown) {
      const tr = view.state.update({ changes: { from: 0, to: cur.length, insert: markdown } });
      view.dispatch(tr);
    }
  }, [markdown]);

  // custom thumb: read from scrollDOM (rAF not needed unless you want)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const sc = view.scrollDOM;
    const onScroll = () => {
      showScrollbars();
      const { scrollTop, scrollHeight, clientHeight } = sc;
      if (scrollHeight > clientHeight) {
        const posPct = (scrollTop / (scrollHeight - clientHeight)) * 100;
        const sizePct = Math.max(20, (clientHeight / scrollHeight) * 100);
        const trackH = trackRef.current?.getBoundingClientRect().height ?? 1;
        const topPx = (posPct / 100) * (trackH - (sizePct / 100) * trackH);
        setThumbTopPx(topPx);
        setThumbSizePct(sizePct);
      }
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => sc.removeEventListener("scroll", onScroll);
  }, [showScrollbars]);

  useImperativeHandle(ref, () => ({
    setSelectionAt(pos: number) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    },
    scrollToOffsetExact(pos: number, bias: "top" | "center" | "third" = "third") {
      const y = bias === "top" ? "start" : "center";
      viewRef.current?.dispatch({ effects: EditorView.scrollIntoView(pos, { y }) });
    },
    getView() {
      return viewRef.current;
    }
  }), []);

  const wrapperStyle = useMemo(() => STYLES.wrapper(narrow), [narrow]);

  return (
    <main style={STYLES.main}>
      <div style={STYLES.container}>
        <div
          style={wrapperStyle}
          onMouseEnter={showScrollbars}
          onMouseMove={showScrollbars}
        >
          <button
            type="button"
            onClick={toggleNarrow}
            style={STYLES.button}
            aria-label={narrow ? 'Switch to full width' : 'Switch to narrow width'}
          >
            {narrow ? 'Full width' : 'Squeeze'}
          </button>

          <div ref={hostRef} style={STYLES.editorHost} />

          {showScrollbar && (
            <div ref={trackRef} style={STYLES.scrollbarTrack}>
              <div className="custom-scrollbar-thumb" style={STYLES.scrollbarThumb(thumbTopPx, thumbSizePct)} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
});