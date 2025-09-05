import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorState, EditorSelection, Compartment, Annotation } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { usePasteToMarkdown } from "../hooks/usePasteToMarkdown";
import type { Heading } from "../core/outlineParser";
import { parseOutline } from "../core/outlineParser";
import { scrollSpyPlugin } from "../cmScrollSpy";
import { useBus } from "../core/BusContext";
import { ScrollSync } from "../core/scrollSync";
import { OutlineIndex } from "../core/outlineCore";


type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  highlightOn: boolean;
  toggleHighlight: () => void;
  onReady?: (view: EditorView) => void;
};

// Tag programmatic selections (e.g., outline clicks) so selection observers can ignore them
const ProgrammaticSelect = Annotation.define<boolean>();

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

// compute outline via shared parser
const computeOutlineFromDoc = parseOutline;

function isHeadingLine(doc: string, lineFrom: number): boolean {
  // Examine the line starting at `lineFrom` — matches ATX headings (# ...).
  const nl = doc.indexOf('\n', lineFrom);
  const lineEnd = nl === -1 ? doc.length : nl;
  const line = doc.slice(lineFrom, lineEnd);
  return /^\s{0,3}#{1,6}\s+/.test(line);
}

function findHeadingAtPos(outline: Heading[], pos: number): Heading | null {
  // Outline headings are sorted by offset; find the last heading whose offset <= pos
  let lo = 0, hi = outline.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (outline[mid].offset <= pos) { ans = mid; lo = mid + 1; } else { hi = mid - 1; } }
  if (ans < 0) return null;
  const h = outline[ans];
  // Ensure the caret is still on the *same line* as the heading (prevents selecting a paragraph under it)
  return h;
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


export const CMEditor = React.forwardRef<CMHandle, Props>(function CMEditor(
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, highlightOn, toggleHighlight, onReady },
  ref
) {
  const bus = useBus();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const scrollSyncRef = useRef<ScrollSync | null>(null);

  // (Deprecated prop plumbing removed in B3—EventBus is the source of truth)

  // Toggleable compartments
  const activeLineComp = useRef(new Compartment()).current;
  const themeComp = useRef(new Compartment()).current;

  // callback refs
  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);

  // data refs
  const outlineRef = useRef<Heading[]>([]);
  const prevDocRef = useRef<string>(markdown);
  const scrollSpyRef = useRef<{ suppress: (ms?: number) => void } | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  
  // Create scroll spy plugin instance once
  const scrollSpy = useMemo(() => scrollSpyPlugin(
    () => outlineRef.current,
    (id, source) => {
      // EventBus: emit active heading with source
      const heading = outlineRef.current.find(h => h.id === id);
      bus.emit('outline:active', { id, offset: heading?.offset ?? null, source: source ?? 'scroll' });
    },
    "third"
  ), [bus]);



  useEffect(() => { onChangeRef.current = setMarkdown; }, [setMarkdown]);
  useEffect(() => { onCaretRef.current = onCaretChange; }, [onCaretChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => {
    const outline = computeOutlineFromDoc(markdown);
    outlineRef.current = outline;
    // EventBus: publish outline snapshot
    bus.emit('outline:computed', { headings: outline, version: Date.now() });
  }, [markdown, bus]);

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
        // Keep ~72px breathing room when we scroll a position into view.
        EditorView.scrollMargins.of(() => ({ top: 72, bottom: 24 })),
        // Active-line goes through a Compartment (ON/OFF)
        activeLineComp.of(highlightOn ? highlightActiveLine() : []),
        // Scroll spy plugin
        scrollSpy.plugin,
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto", height: "100%", WebkitOverflowScrolling: "touch" },
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
          if (u.selectionSet) {
            const head = u.state.selection.main.head;
            onCaretRef.current(head);

            // If the user clicked/selected and the caret sits on a heading line,
            // emit outline:active so the OutlinePane selects the same heading.
            const userSelect = u.transactions.some(t => t.isUserEvent("select"));
            if (userSelect) {
              // Suppress the scroll spy plugin to prevent conflicts
              scrollSpy.suppress(300); // Suppress for 300ms to avoid conflicting events
              
              // Confirm caret is on a heading line
              const docStr = u.state.doc.toString();
              const line = u.state.doc.lineAt(head);
              if (isHeadingLine(docStr, line.from)) {
                // Map caret to the heading in our current outline snapshot
                const currentOutline = outlineRef.current;
                const h = findHeadingAtPos(currentOutline, line.from);
                
                if (h) {
                  // Let OutlinePane highlight/follow this row
                  bus.emit('outline:active', {
                    id: h.id,
                    offset: h.offset,
                    source: 'click'
                  });
                }
              }
            }
          }

          // Temporarily suppress scroll spy during typing to avoid interference
          const isTyping = u.transactions.some(t => t.isUserEvent("input") || t.isUserEvent("delete"));
          if (isTyping) {
            scrollSpyRef.current?.suppress(200); // Brief suppression while typing
            scrollSyncRef.current?.suppress(200); // Also suppress ScrollSync
          }

          // Ignore programmatic selection moves (e.g., from outline clicks)
          const isProgrammaticSelect = u.transactions.some(t => t.annotation(ProgrammaticSelect) === true);

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
            // updateOutlineIncremental: returns `prev` if nothing moved; new array otherwise.
            if (prev !== next) {
              outlineRef.current = next;
              // EventBus: emit updated outline
              bus.emit('outline:computed', { headings: next, version: Date.now() });
            }
          }

          // After changes or cursor moves, update active heading from caret when user-driven
          if ((u.docChanged || u.selectionSet) && !isProgrammaticSelect) {
            const caret = u.state.selection.main.head;
            const index = new OutlineIndex(outlineRef.current.map(h => ({ id: h.id, pos: h.offset })));
            const nextId = index.idAtOrBefore(caret);
            if (nextId && nextId !== lastActiveIdRef.current) {
              lastActiveIdRef.current = nextId;
              const heading = outlineRef.current.find(h => h.id === nextId);
              bus.emit('outline:active', { id: nextId, offset: heading?.offset ?? null, source: 'scroll' });
            }
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

    // Initialize ScrollSync
    scrollSyncRef.current = new ScrollSync(view);

    // Expose scroll spy suppression via EventBus only
    scrollSpyRef.current = scrollSpy;

    // Helper: Caret just after visible heading text (same logic as old App.tsx)
    function caretAtHeadingEnd(doc: string, heading: { offset: number }) {
      const nl = doc.indexOf('\n', heading.offset);
      const lineEnd = nl === -1 ? doc.length : nl;
      const trimmedLine = doc
        .slice(heading.offset, lineEnd)
        .replace(/\s*#+\s*$/, '')
        .replace(/\s+$/, '');
      return Math.min(doc.length, heading.offset + trimmedLine.length);
    }

    // Listen for outline requests and re-emit current outline
    const unsubscribeRequest = bus.on('outline:request', () => {
      const currentOutline = outlineRef.current;
      if (currentOutline.length > 0) {
        bus.emit('outline:computed', { headings: currentOutline, version: Date.now() });
      }
    });

    // Listen for navigation events from bus
    const unsubscribeNav = bus.on('nav:jump', ({ offset, source }) => {
      if (source === 'outline') {
        // Find the target heading for this offset
        const targetHeading = outlineRef.current.find(h => h.offset === offset);
        
        // Immediately emit outline:active for the target heading to update UI
        if (targetHeading) {
          bus.emit('outline:active', { id: targetHeading.id, offset: targetHeading.offset, source: 'outline' });
        }
        
        // Use ScrollSync for target-aware suppression
        scrollSyncRef.current?.suppressUntilTarget(offset);
        scrollSpyRef.current?.suppress(1000);
        
        // Calculate cursor position at end of heading text
        const doc = view.state.doc.toString();
        const cursorPos = targetHeading ? caretAtHeadingEnd(doc, targetHeading) : offset;
        
        // 1) Put the caret at the end of heading text for editing (tagged as programmatic)
        view.dispatch({ 
          selection: EditorSelection.cursor(cursorPos), 
          scrollIntoView: false,
          annotations: ProgrammaticSelect.of(true)
        });
        
        // 2) Center the heading offset (not cursor position)
        view.dispatch({ effects: EditorView.scrollIntoView(offset, { y: "center" }) });
        
        // 3) Focus the editor for immediate editing
        view.focus();
        
        // Optional rAF nudge for layout settle
        requestAnimationFrame(() => {
          view.dispatch({ effects: EditorView.scrollIntoView(offset, { y: "center" }) });
        });
      }
    });

    return () => {
      unsubscribeRequest();
      unsubscribeNav();
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus]); // init once + bus

  // Reconfigure highlight ON/OFF without rebuilding the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        activeLineComp.reconfigure(highlightOn ? highlightActiveLine() : []),
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
        view.dispatch({ 
          selection: EditorSelection.cursor(pos),
          annotations: ProgrammaticSelect.of(true)
        });
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