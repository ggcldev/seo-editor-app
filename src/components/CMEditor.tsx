import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorState, EditorSelection, Compartment } from "@codemirror/state";
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
  highlightOn: boolean;
  toggleHighlight: () => void;
  onReady?: (view: EditorView) => void;
  /** Called whenever CM recomputes the outline from the current doc */
  onOutlineChange: (outline: Heading[]) => void;
  /** Called when CM detects the active heading (via caret/selection or scroll) */
  onActiveHeadingChange: (id: string | null, source?: "caret" | "scroll") => void;
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
    // ATX style with up to 3 leading spaces: ^\s{0,3}#{1,6}\s+Heading [optional trailing #...]
    const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const raw = m[2].trim();
      const id = `${slugify(raw) || "heading"}@${offset}`;
      out.push({ id, level, text: raw, offset });
    }
    offset += line.length + 1; // + newline
  }
  return out;
}

function updateOutlineIncremental(
  prev: Heading[],
  changes: import("@codemirror/state").ChangeDesc
): Heading[] {
  if (!prev.length) return prev;
  let changed = false;
  const next = new Array<Heading>(prev.length);
  for (let i = 0; i < prev.length; i++) {
    const h = prev[i];
    const mapped = changes.mapPos(h.offset, 1);
    if (mapped !== h.offset) changed = true;
    next[i] = mapped === h.offset ? h : { ...h, offset: mapped };
  }
  return changed ? next : prev;
}

function findHeadingForPos(outline: Heading[], pos: number): { h: Heading; nextOffset: number } | null {
  if (!outline.length) return null;
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
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, highlightOn, toggleHighlight, onReady, onOutlineChange, onActiveHeadingChange, onScrollSpyReady },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Toggleable compartments
  const activeLineComp = useRef(new Compartment()).current;
  const themeComp = useRef(new Compartment()).current;

  // callback refs
  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange);
  const onOutlineChangeRef = useRef(onOutlineChange);
  const onScrollSpyReadyRef = useRef(onScrollSpyReady);

  // data refs
  const outlineRef = useRef<Heading[]>([]);
  const prevDocRef = useRef<string>(markdown);
  const suppressUntilRef = useRef(0);
  const lastActiveIdRef = useRef<string | null>(null);


  useEffect(() => { onChangeRef.current = setMarkdown; }, [setMarkdown]);
  useEffect(() => { onCaretRef.current = onCaretChange; }, [onCaretChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onActiveHeadingChangeRef.current = onActiveHeadingChange; }, [onActiveHeadingChange]);
  useEffect(() => { onOutlineChangeRef.current = onOutlineChange; }, [onOutlineChange]);
  useEffect(() => { onScrollSpyReadyRef.current = onScrollSpyReady; }, [onScrollSpyReady]);
  useEffect(() => {
    outlineRef.current = computeOutlineFromDoc(markdown);
    onOutlineChangeRef.current(outlineRef.current);
  }, [markdown]);

  const { htmlToMarkdown } = usePasteToMarkdown();
  const htmlToMdRef = useRef(htmlToMarkdown);
  useEffect(() => { htmlToMdRef.current = htmlToMarkdown; }, [htmlToMarkdown]);

  // --- viewport-based active heading ---------------------------------------
  function updateActiveFromViewport(view: EditorView) {
    // ignore while programmatic scroll is running
    if (performance.now() <= suppressUntilRef.current) return;

    const sc = view.scrollDOM;
    const rect = sc.getBoundingClientRect();
    if (rect.height <= 0) return;

    // Anchor near the top of the viewport to avoid skipping short sections
    const anchorY = rect.top + 8;
    const anchorX = rect.left + 8;
    const at = view.posAtCoords({ x: anchorX, y: anchorY });
    if (!at) return;

    const match = findHeadingForPos(outlineRef.current, at);
    const nextId = match?.h.id ?? null;
    if (nextId !== lastActiveIdRef.current) {
      lastActiveIdRef.current = nextId;
      onActiveHeadingChangeRef.current(nextId, "scroll");
      
      // Move caret to the detected heading to keep editor and outline in sync
      if (match) {
        view.dispatch({ 
          selection: EditorSelection.cursor(match.h.offset),
          scrollIntoView: false // Don't scroll, we're already at the right position
        });
      }
    }
  }

  useEffect(() => {
    const state = EditorState.create({
      doc: markdown,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        mdLang(),
        EditorView.lineWrapping,
        // Keep ~72px breathing room when we scroll a position into view.
        EditorView.scrollMargins.of(() => ({ top: 72, bottom: 24 })),
        // Active-line goes through a Compartment (ON/OFF)
        activeLineComp.of(highlightOn ? highlightActiveLine() : []),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto", height: "100%", WebkitOverflowScrolling: "touch" as any },
          ".cm-content": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "14px",
            lineHeight: "1.8"
          },
          ".cm-cursor": {
            borderLeftWidth: "2px",
            borderLeftColor: "#374151"
          }
        }),
        themeComp.of(EditorView.theme({
          ".cm-cursor": { borderLeftWidth: "2px", borderLeftColor: "#374151" },
          ".cm-activeLine": { backgroundColor: highlightOn ? "rgba(55,65,81,0.14)" : "transparent" },
          ".cm-activeLineGutter": { backgroundColor: highlightOn ? "rgba(55,65,81,0.10)" : "transparent" },
          ...(highlightOn ? {
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
              backgroundColor: "rgba(55,65,81,0.24) !important"
            }
          } : {})
        })),
        EditorView.updateListener.of((u) => {
          // Keep upstream state in sync
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          if (u.selectionSet) onCaretRef.current(u.state.selection.main.head);

          // Recompute outline on doc changes (single source of truth)
          if (u.docChanged) {
            const nextDoc = u.state.doc.toString();
            const prevDoc = prevDocRef.current;
            prevDocRef.current = nextDoc;

            let next = updateOutlineIncremental(outlineRef.current, u.changes);
            let touchedFrom = u.state.doc.length;
            let touchedTo = 0;
            u.changes.iterChanges((_, __, tFrom, tTo) => {
              touchedFrom = Math.min(touchedFrom, tFrom);
              touchedTo = Math.max(touchedTo, tTo);
            });
            // If any touched line was or is a heading, reparse fully
            const prevLines = prevDoc.slice(
              Math.max(0, prevDoc.lastIndexOf("\n", touchedFrom) + 1),
              Math.min(prevDoc.length, prevDoc.indexOf("\n", touchedTo) === -1 ? prevDoc.length : prevDoc.indexOf("\n", touchedTo))
            );
            const nextLines = nextDoc.slice(
              Math.max(0, nextDoc.lastIndexOf("\n", touchedFrom) + 1),
              Math.min(nextDoc.length, nextDoc.indexOf("\n", touchedTo) === -1 ? nextDoc.length : nextDoc.indexOf("\n", touchedTo))
            );
            const headingLine = /(^|\n)\s*#{1,6}\s/;
            if (headingLine.test(prevLines) || headingLine.test(nextLines)) {
              next = computeOutlineFromDoc(nextDoc);
            }
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

          // CARET-wins: derive active heading from caret when caret is on a heading line
          if ((u.selectionSet || u.docChanged) && performance.now() > suppressUntilRef.current) {
            const pos = u.state.selection.main.head;
            const match = findHeadingForPos(outlineRef.current, pos);
            if (match) {
              const lineAtHeading = u.state.doc.lineAt(match.h.offset);
              const caretLine = u.state.doc.lineAt(pos);
              const caretOnHeadingLine = caretLine.from === lineAtHeading.from;
              if (caretOnHeadingLine && pos >= match.h.offset && pos < match.nextOffset) {
                lastActiveIdRef.current = match.h.id;
                onActiveHeadingChangeRef.current(match.h.id, "caret");
              }
            } else {
              lastActiveIdRef.current = null;
              onActiveHeadingChangeRef.current(null, "caret");
            }
          }

          // Viewport-based sync (CM6-visible-range changed due to scroll/resize)
          if (u.viewportChanged && performance.now() > suppressUntilRef.current) {
            updateActiveFromViewport(u.view);
          }
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const cb = (event as ClipboardEvent).clipboardData;
            if (!cb) return false;
            const html = cb.getData("text/html");
            if (!html) return false;
            event.preventDefault();
            const md = htmlToMdRef.current(html);
            const sel = view.state.selection.main;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: md },
              selection: EditorSelection.cursor(sel.from + md.length),
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

    // expose suppression for navigation clicks
    const suppress = (ms: number = 900) => {
      suppressUntilRef.current = performance.now() + ms;
    };
    onScrollSpyReadyRef.current?.(suppress);

    // Smooth-scroll tracking: call updateActiveFromViewport on every scroll,
    // but coalesce to one call per animation frame.
    let ticking = false;
    const onScroll = () => {
      if (performance.now() <= suppressUntilRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateActiveFromViewport(view);
      });
    };
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  // Reconfigure highlight ON/OFF without rebuilding the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        activeLineComp.reconfigure(highlightActiveLine()),
        themeComp.reconfigure(EditorView.theme({
          ".cm-cursor": { borderLeftWidth: "2px", borderLeftColor: "#374151" },
          ".cm-activeLine": { backgroundColor: highlightOn ? "rgba(55,65,81,0.14)" : "transparent" },
          ".cm-activeLineGutter": { backgroundColor: highlightOn ? "rgba(55,65,81,0.10)" : "transparent" },
          ...(highlightOn ? {
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
              backgroundColor: "rgba(55,65,81,0.24) !important"
            }
          } : {})
        }))
      ]
    });
  }, [highlightOn, activeLineComp, themeComp]);

  // Hotkey: Ctrl/⌘ + Alt + H to toggle
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const handler = (e: KeyboardEvent) => {
      const isMac = /mac/i.test(navigator.platform);
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (cmd && e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        toggleHighlight();
      }
    };
    view.dom.addEventListener("keydown", handler);
    return () => view.dom.removeEventListener("keydown", handler);
  }, [toggleHighlight]);

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
          <button
            type="button"
            onClick={toggleHighlight}
            style={{ ...STYLES.button, right: 120 }}
            aria-label={`Toggle active-line highlight (${highlightOn ? "on" : "off"})`}
            aria-pressed={highlightOn}
            title="Toggle editor highlight (Ctrl/⌘+Alt+H)"
          >
            Highlight: {highlightOn ? "On" : "Off"}
          </button>
          <div ref={hostRef} style={STYLES.editorHost} />
        </div>
      </div>
    </main>
  );
});