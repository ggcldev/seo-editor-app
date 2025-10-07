import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, EditorSelection, Compartment, Annotation } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import type { Heading } from "@/core/outlineParser";
import { parseOutline } from "@/core/outlineParser";
import { scrollSpyPlugin } from "@/cmScrollSpy";
import { useBus } from "@/core/BusContext";
import { ScrollSync } from "@/core/scrollSync";
import { OutlineIndex } from "@/core/outlineCore";


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


const STYLES = {
  main: { padding: 0, background: "#f6f6f6", height: "100vh" },
  container: { height: "100%", padding: 24, boxSizing: "border-box" as const, display: "flex", justifyContent: "center" },
  wrapper: (narrow: boolean) =>
    ({ position: "relative", width: "100%", maxWidth: narrow ? 680 : "100%", overflow: "hidden" } as const),
  button: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    zIndex: 1,
    fontSize: 12,
    padding: "6px 12px",
    borderRadius: 6,
    border: "0",
    outline: "none",
    background: "rgba(255, 255, 255, 0.9)",
    color: "#374151",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    transition: "all 0.2s ease",
    fontWeight: 500,
    boxSizing: "border-box" as const,
    WebkitFontSmoothing: "antialiased" as const,
    MozOsxFontSmoothing: "grayscale" as const
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

/**
 * Incrementally updates heading offsets after document changes for optimal performance.
 * 
 * Uses CodeMirror's ChangeDesc.mapPos() to efficiently track how document edits affect
 * heading positions without reparsing the entire document. Returns the same array reference
 * if no headings were affected, enabling React optimization via referential equality.
 * 
 * @param prev - Previous heading array with potentially stale offsets
 * @param changes - CodeMirror ChangeDesc tracking all document modifications
 * @returns Updated heading array with correct offsets, or same reference if unchanged
 * 
 * @example
 * ```typescript
 * // After user types at position 100, heading at position 150 moves to 155
 * const updated = updateOutlineIncremental(outline, changeDesc);
 * // Returns new array with updated offsets, or same reference if no headings affected
 * ```
 */
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


export const CMEditor = function CMEditor(
  { markdown, setMarkdown, onCaretChange, narrow, toggleNarrow, highlightOn, toggleHighlight, onReady }: Props
) {
  const bus = useBus();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const scrollSyncRef = useRef<ScrollSync | null>(null);

  // (Deprecated prop plumbing removed in B3—EventBus is the source of truth)

  // Toggleable compartments
  const activeLineComp = useRef(new Compartment()).current;
  const themeComp = useRef(new Compartment()).current;
  const autocompleteComp = useRef(new Compartment()).current;

  // callback refs
  const onChangeRef = useRef(setMarkdown);
  const onCaretRef = useRef(onCaretChange);
  const onReadyRef = useRef(onReady);

  // data refs
  const outlineRef = useRef<Heading[]>([]);
  const prevDocRef = useRef<string>(markdown);
  const scrollSpyRef = useRef<{ suppress: (ms?: number) => void } | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  const indexCacheRef = useRef<{ outline: Heading[]; index: OutlineIndex } | null>(null);
  const outlineWorkerRef = useRef<Worker | null>(null);
  
  const aiStreamRef = useRef<{ id: string; from: number; to: number } | null>(null);

  // Selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{ top: number; left: number; text: string; from: number; to: number } | null>(null);
  const [showAIDropdown, setShowAIDropdown] = useState(false);

  function getOutlineIndex(): OutlineIndex {
    const outline = outlineRef.current;
    const cached = indexCacheRef.current;
    if (cached && cached.outline === outline) return cached.index;
    const idx = new OutlineIndex(outline);
    indexCacheRef.current = { outline, index: idx };
    return idx;
  }
  
  // Create scroll spy plugin instance once
  const scrollSpy = useMemo(() => scrollSpyPlugin(
    () => outlineRef.current,
    (id, source) => {
      // EventBus: emit active heading with source
      const heading = outlineRef.current.find(h => h.id === id);
      lastActiveIdRef.current = id; // keep in sync with plugin
      bus.emit('outline:active', { id, offset: heading?.offset ?? null, source: source ?? 'scroll' });
    },
    "third"
  ), [bus]);

  // Slash command completions - only heading shortcuts
  const slashCommands = useMemo<Completion[]>(() => [
    {
      label: '/h1',
      type: 'keyword',
      detail: 'Insert H1',
      apply(v,_c,f,t){ v.dispatch({ changes:{ from:f,to:t,insert:'# ' } }); }
    },
    {
      label: '/h2',
      type: 'keyword',
      detail: 'Insert H2',
      apply(v,_c,f,t){ v.dispatch({ changes:{ from:f,to:t,insert:'## ' } }); }
    },
    {
      label: '/h3',
      type: 'keyword',
      detail: 'Insert H3',
      apply(v,_c,f,t){ v.dispatch({ changes:{ from:f,to:t,insert:'### ' } }); }
    },
  ], []);

  // Completion source for slash commands
  const slashCommandSource = useMemo(() => {
    return (context: CompletionContext) => {
      const word = context.matchBefore(/\/[a-z-]*$/i);
      if (!word) return null;
      if (word.from === word.to && context.explicit === false) return null;
      const q = word.text.toLowerCase();
      const options = slashCommands.filter(c => c.label.toLowerCase().startsWith(q));
      return { 
        from: word.from, 
        to: word.to, 
        options: options.length ? options : slashCommands, 
        validFor: /\/[a-z-]*$/i 
      };
    };
  }, [slashCommands]);

  useEffect(() => { onChangeRef.current = setMarkdown; }, [setMarkdown]);
  useEffect(() => { onCaretRef.current = onCaretChange; }, [onCaretChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  // Apply incoming stream chunks to the editor
  useEffect(() => {
    let isFirstChunk = true;

    const offStart = bus.on('ai:stream:start', () => {
      isFirstChunk = true; // Reset for each new stream
    });

    const offChunk = bus.on('ai:stream:chunk', ({ id, text }) => {
      const s = aiStreamRef.current;
      const view = viewRef.current;
      if (!s || s.id !== id || !view || !text) return;

      if (isFirstChunk) {
        // First chunk: replace the original text range
        view.dispatch({ changes: { from: s.from, to: s.to, insert: text } });
        aiStreamRef.current = { ...s, from: s.from, to: s.from + text.length };
        isFirstChunk = false;
      } else {
        // Subsequent chunks: append at the end
        const insertAt = s.to;
        view.dispatch({ changes: { from: insertAt, to: insertAt, insert: text } });
        aiStreamRef.current = { ...s, to: insertAt + text.length };
      }
    });

    const finish = () => {
      aiStreamRef.current = null;
      isFirstChunk = true;
    };
    const offDone = bus.on('ai:stream:done', ({ id }) => { if (aiStreamRef.current?.id === id) finish(); });
    const offErr = bus.on('ai:stream:error', ({ id }) => { if (aiStreamRef.current?.id === id) finish(); });

    return () => { offStart(); offChunk(); offDone(); offErr(); };
  }, [bus]);
  
  useEffect(() => {
    const md = markdown;
    const bigDoc = md.length >= 50000; // threshold; tune as needed

    // Lazy-create the worker only when needed
    if (bigDoc && !outlineWorkerRef.current) {
      try {
        outlineWorkerRef.current = new Worker(new URL('../workers/outlineWorker.ts', import.meta.url), { type: 'module' });
      } catch (error) {
        console.warn('Worker creation failed, falling back to main thread:', error);
      }
    }

    const worker = outlineWorkerRef.current;

    if (!bigDoc || !worker) {
      const outline = computeOutlineFromDoc(md);
      outlineRef.current = outline;
      indexCacheRef.current = null;
      bus.emit('outline:computed', { headings: outline, version: Date.now() });
      return;
    }

    const onMessage = (e: MessageEvent<Heading[]>) => {
      outlineRef.current = e.data ?? [];
      indexCacheRef.current = null;
      bus.emit('outline:computed', { headings: outlineRef.current, version: Date.now() });
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };

    const onError = (error: ErrorEvent) => {
      console.warn('Worker failed, falling back to main thread:', error);
      // Fallback to main thread computation
      const outline = computeOutlineFromDoc(md);
      outlineRef.current = outline;
      indexCacheRef.current = null;
      bus.emit('outline:computed', { headings: outline, version: Date.now() });
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      // Mark worker as failed to avoid future attempts
      outlineWorkerRef.current = null;
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(md);

    return () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
  }, [markdown, bus]);



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
        // Slash-command autocomplete
        autocompleteComp.of(autocompletion({
          override: [slashCommandSource],
          defaultKeymap: true,
          icons: false
        })),
        // Scroll spy plugin
        scrollSpy.plugin,
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto", height: "100%", WebkitOverflowScrolling: "touch" },
          ".cm-content": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "14px",
            lineHeight: "1.6"
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
          // Keep AI stream insertion range in sync with document changes
          if (aiStreamRef.current && u.docChanged) {
            aiStreamRef.current = {
              id: aiStreamRef.current.id,
              from: u.changes.mapPos(aiStreamRef.current.from, 1),
              to: u.changes.mapPos(aiStreamRef.current.to, 1),
            };
          }

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
              scrollSpyRef.current?.suppress(300); // Suppress for 300ms to avoid conflicting events
              
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
              indexCacheRef.current = null; // Invalidate cache when outline changes
              // EventBus: emit updated outline
              bus.emit('outline:computed', { headings: next, version: Date.now() });
            }
          }

          // After changes or cursor moves, update active heading from caret when user-driven
          if ((u.docChanged || u.selectionSet) && !isProgrammaticSelect) {
            const caret = u.state.selection.main.head;
            // Use a stable "at or before" lookup to avoid jumping between headings while typing
            const index = getOutlineIndex();
            const nextId = index.idAtOrBefore(caret);
            if (nextId && nextId !== lastActiveIdRef.current) {
              lastActiveIdRef.current = nextId;
              const heading = outlineRef.current.find(h => h.id === nextId);
              bus.emit('outline:active', { id: nextId, offset: heading?.offset ?? null, source: 'scroll' });
            }
          }

          // Show selection popup when text is selected
          if (u.selectionSet && !isProgrammaticSelect) {
            const selection = u.state.selection.main;
            if (selection.from !== selection.to) {
              const selectedText = u.state.doc.sliceString(selection.from, selection.to);
              if (selectedText.trim().length > 0) {
                // Get coordinates for the popup
                const coords = u.view.coordsAtPos(selection.to);
                if (coords) {
                  const hostRect = hostRef.current?.getBoundingClientRect();
                  if (hostRect) {
                    setSelectionPopup({
                      top: coords.bottom - hostRect.top + 8,
                      left: coords.left - hostRect.left,
                      text: selectedText,
                      from: selection.from,
                      to: selection.to
                    });
                  }
                }
              }
            } else {
              setSelectionPopup(null);
              setShowAIDropdown(false);
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

            (async () => {
              try {
                const { default: TurndownService } = await import('turndown');
                const td = new TurndownService({ headingStyle: 'atx' });

                td.addRule('fontSizeHeadingsPxPt', {
                  filter: (node: Node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    if (node.nodeName !== 'P') return false;
                    const style = (node as HTMLElement).getAttribute('style') || '';
                    return /font-size\s*:\s*\d+(?:\.\d+)?(px|pt)/i.test(style);
                  },
                  replacement: (content: string, node: Node) => {
                    const style = (node as HTMLElement).getAttribute('style') || '';
                    const m = style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt)/i);
                    const value = m ? parseFloat(m[1]) : 0;
                    const unit = m ? m[2].toLowerCase() : 'px';
                    const px = unit === 'pt' ? value * (96 / 72) : value;
                    let hashes = '';
                    if (px >= 28) hashes = '#';
                    else if (px >= 20) hashes = '##';
                    else if (px >= 16) hashes = '###';
                    if (hashes) return `\n${hashes} ${content.trim()}\n\n`;
                    return `\n\n${content}\n\n`;
                  },
                });
                td.addRule('dropStrong', {
                  filter: (node: Node) => node && (node.nodeName === 'STRONG' || node.nodeName === 'B'),
                  replacement: (content: string) => content,
                });
                td.addRule('dropEmphasis', {
                  filter: (node: Node) => node && (node.nodeName === 'EM' || node.nodeName === 'I'),
                  replacement: (content: string) => content,
                });
                td.addRule('dropBoldStyleSpans', {
                  filter: (node: Node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    const style = (node as HTMLElement).getAttribute('style') || '';
                    return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
                  },
                  replacement: (content: string) => content,
                });

                const md = td
                  .turndown(html)
                  .replace(/^\*\*(.+)\*\*$/gm, '$1')
                  .replace(/^\*(.+)\*$/gm, '$1');

                const sel = view.state.selection.main;
                view.dispatch({
                  changes: { from: sel.from, to: sel.to, insert: md },
                  selection: EditorSelection.cursor(sel.from + md.length),
                });
              } catch (error) {
                console.error('Failed to load Turndown:', error);
                // Fallback: insert plain text
                const text = cb.getData("text/plain") || html;
                const sel = view.state.selection.main;
                view.dispatch({
                  changes: { from: sel.from, to: sel.to, insert: text },
                  selection: EditorSelection.cursor(sel.from + text.length),
                });
              }
            })();

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

    // Expose per-view suppression to React via a stable handle
    scrollSpyRef.current = { suppress: (ms?: number) => scrollSpy.suppress(view, ms ?? 900) };

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

  // Worker cleanup on unmount
  useEffect(() => {
    return () => { outlineWorkerRef.current?.terminate(); outlineWorkerRef.current = null; };
  }, []);

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

  const wrapperStyle = useMemo(() => STYLES.wrapper(narrow), [narrow]);

  // AI action handlers
  const handleMakeLonger = () => {
    if (!selectionPopup) return;
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    aiStreamRef.current = { id, from: selectionPopup.from, to: selectionPopup.to };
    const prompt = `Rewrite the following text to be longer and more detailed. Return ONLY the rewritten text without any explanations or comments:\n\n${selectionPopup.text}`;
    bus.emit('ai:stream:request', { id, prompt });
    setSelectionPopup(null);
    setShowAIDropdown(false);
  };

  const handleMakeShorter = () => {
    if (!selectionPopup) return;
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    aiStreamRef.current = { id, from: selectionPopup.from, to: selectionPopup.to };
    const prompt = `Rewrite the following text to be shorter and more concise. Return ONLY the rewritten text without any explanations or comments:\n\n${selectionPopup.text}`;
    bus.emit('ai:stream:request', { id, prompt });
    setSelectionPopup(null);
    setShowAIDropdown(false);
  };

  const handleCheckGrammar = () => {
    if (!selectionPopup) return;
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    aiStreamRef.current = { id, from: selectionPopup.from, to: selectionPopup.to };
    const prompt = `Fix ONLY grammatical errors in the text below. DO NOT change the meaning, content, or add new information.

RULES:
1. Fix verb forms: "was go" → "went", "was close" → "was closed", "lefted" → "left"
2. Fix subject-verb agreement: "he don't" → "he doesn't"
3. Add missing articles/prepositions: "like go" → "like to go"
4. Fix spelling and punctuation
5. DO NOT change names, pronouns, or any specific content
6. DO NOT rephrase or rewrite - only fix grammatical mistakes
7. Keep the exact same meaning and structure

Return ONLY the corrected text:

${selectionPopup.text}`;
    bus.emit('ai:stream:request', { id, prompt });
    setSelectionPopup(null);
    setShowAIDropdown(false);
  };

  return (
    <main style={STYLES.main}>
      <div style={STYLES.container}>
        <div style={wrapperStyle}>
          <button
            type="button"
            onClick={toggleNarrow}
            className={`editor-action-btn ${narrow ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}
            aria-label={narrow ? "Switch to full width" : "Switch to narrow width"}
            aria-pressed={narrow}
            title={narrow ? "Switch to full width" : "Switch to narrow width"}
          >
            {narrow ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M21 9v6M3 9v6"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={toggleHighlight}
            className={`editor-action-btn editor-action-btn--secondary ${highlightOn ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}
            aria-label={`Toggle active-line highlight (${highlightOn ? "on" : "off"})`}
            aria-pressed={highlightOn}
            title={`Toggle editor highlight (${highlightOn ? "on" : "off"}) - Ctrl/⌘+Alt+H`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 11-6 6v3h3l6-6"/>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
            </svg>
          </button>
          {selectionPopup && (
            <div
              style={{
                position: 'absolute',
                top: selectionPopup.top,
                left: selectionPopup.left,
                zIndex: 100,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                onClick={() => setShowAIDropdown(!showAIDropdown)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                title="AI actions"
              >
                Help AI
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {showAIDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    minWidth: '180px'
                  }}
                >
                  <button
                    onClick={handleMakeLonger}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      color: '#374151',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 400,
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    Make it longer
                  </button>
                  <button
                    onClick={handleMakeShorter}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      color: '#374151',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 400,
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    Make it shorter
                  </button>
                  <button
                    onClick={handleCheckGrammar}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      color: '#374151',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 400,
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    Check grammar
                  </button>
                </div>
              )}
            </div>
          )}
          <div ref={hostRef} style={STYLES.editorHost} />
        </div>
      </div>
    </main>
  );
};