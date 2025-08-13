import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { usePasteToMarkdown } from "../hooks/usePasteToMarkdown";
import type { Heading } from "../hooks/useOutline";

type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  onReady?: (view: EditorView) => void;
  /** Called whenever CM recomputes the outline from the current doc */
  onOutlineChange: (outline: Heading[]) => void;
  /** Called when CM detects the active heading (via caret/selection) */
  onActiveHeadingChange: (id: string | null, source: 'caret') => void;
  /** Exposes scroll-spy suppression for clean navigation */
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[#`*_\[\](){}/\\<>:"'.,!?~^$|+-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function computeOutlineFromDoc(doc: string): Heading[] {
  const out: Heading[] = [];
  let offset = 0;
  const lines = doc.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ATX style: #..###### Heading [optional trailing #...]
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      const level = m[1].length;
      const raw = m[2].replace(/\s*#+\s*$/, "").trim();
      const id = `${slugify(raw) || "heading"}@${offset}`;
      out.push({ id, level, text: raw, offset });
    }
    // Advance offset past this line + newline
    offset += line.length + 1;
  }
  return out;
}

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
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, onReady, onOutlineChange, onActiveHeadingChange, onScrollSpyReady },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange);
  const onOutlineChangeRef = useRef(onOutlineChange);
  const onScrollSpyReadyRef = useRef(onScrollSpyReady);
  const outlineRef = useRef<Heading[]>([]);
  const suppressUntilRef = useRef(0);

  useEffect(() => { onChangeRef.current = setMarkdown; }, [setMarkdown]);
  useEffect(() => { onCaretRef.current = onCaretChange; }, [onCaretChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onActiveHeadingChangeRef.current = onActiveHeadingChange; }, [onActiveHeadingChange]);
  useEffect(() => { onOutlineChangeRef.current = onOutlineChange; }, [onOutlineChange]);
  useEffect(() => { onScrollSpyReadyRef.current = onScrollSpyReady; }, [onScrollSpyReady]);
  useEffect(() => { outlineRef.current = computeOutlineFromDoc(markdown); onOutlineChangeRef.current(outlineRef.current); }, [markdown]);

  const { htmlToMarkdown } = usePasteToMarkdown();
  const htmlToMdRef = useRef(htmlToMarkdown);
  useEffect(() => { htmlToMdRef.current = htmlToMarkdown; }, [htmlToMarkdown]);

  useEffect(() => {

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
          },
          /* Dark grey active line + selection */
          ".cm-activeLine": {
            backgroundColor: "#374151", /* Dark grey highlight */
            color: "#ffffff" /* White text on dark background */
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
            backgroundColor: "rgba(55, 65, 81, 0.24) !important"
          },
          ".cm-cursor": {
            borderLeftColor: "#374151"
          },
          /* Transparent scrollbar on right side */
          ".cm-scroller::-webkit-scrollbar": {
            width: "8px",
            backgroundColor: "transparent"
          },
          ".cm-scroller::-webkit-scrollbar-track": {
            backgroundColor: "transparent"
          },
          ".cm-scroller::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            borderRadius: "4px",
            border: "none"
          },
          ".cm-scroller::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.2)"
          },
          /* Firefox */
          ".cm-scroller": {
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0, 0, 0, 0.1) transparent"
          }
        }),
        EditorView.updateListener.of((u) => {
          // Keep upstream state in sync
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          if (u.selectionSet) onCaretRef.current(u.state.selection.main.head);

          // Recompute outline on doc changes (single source of truth)
          if (u.docChanged) {
            const next = computeOutlineFromDoc(u.state.doc.toString());
            // Shallow compare (length + last id/offset) to avoid noisy updates
            const prev = outlineRef.current;
            const changed =
              prev.length !== next.length ||
              (prev.length && next.length &&
               (prev[prev.length - 1].offset !== next[next.length - 1].offset ||
                prev[prev.length - 1].id !== next[next.length - 1].id));
            if (changed) {
              outlineRef.current = next;
              onOutlineChangeRef.current(next);
            }
          }

          // CARET-wins: derive active heading from caret against CM's current outline  
          if ((u.selectionSet || u.docChanged) && performance.now() > suppressUntilRef.current) {
            const pos = u.state.selection.main.head;
            const match = findHeadingForPos(outlineRef.current, pos);
            if (match) {
              const lineAtHeading = u.state.doc.lineAt(match.h.offset);
              const caretLine = u.state.doc.lineAt(pos);
              const caretOnHeadingLine = caretLine.from === lineAtHeading.from;
              if (caretOnHeadingLine && pos >= match.h.offset && pos < match.nextOffset) {
                onActiveHeadingChangeRef.current(match.h.id, "caret");
              }
            } else {
              onActiveHeadingChangeRef.current(null, "caret");
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
        })
      ]
    });

    const parent = hostRef.current;
    if (!parent) return;
    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onReadyRef.current?.(view);
    
    // Expose suppress function for navigation coordination
    const suppress = (ms: number = 900) => {
      suppressUntilRef.current = performance.now() + ms;
    };
    onScrollSpyReadyRef.current?.(suppress);

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