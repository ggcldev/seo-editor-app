import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
import type { Heading } from './hooks/useOutline';
import { OutlinePane } from './components/OutlinePane';
import { CMEditor, type CMHandle } from './components/CMEditor';
import { EditorView } from '@codemirror/view';
import { MetricsBar } from './components/MetricsBar';
import { normalizeEOL } from './eol';
import './globals.css';

const OUTLINE_CONFIG = {
  DEFAULT_WIDTH: 260,
  MIN_WIDTH: 160,
  MAX_WIDTH: 480
};

export default function App() {
  const [markdown, _setMarkdown] = useState(`# First Heading

This is some content under the first heading.

## Second Heading

More content here.

### Third Heading

Even more content.

## Fourth Heading

Final content.

# Another Section

More content to make it scrollable...

## Subsection

Even more text here to create a longer document that will actually need scrolling.

### Deep subsection

Final deep content.`);
  const setMarkdown = useCallback((v: string) => {
    _setMarkdown(prev => {
      const nv = normalizeEOL(v);
      return nv === prev ? prev : nv;
    });
  }, []);

  const [narrow, setNarrow] = useState(true);
  // Editor highlight (active-line band) — default OFF, persisted
  const [highlightOn, setHighlightOn] = useState<boolean>(() => {
    const saved = localStorage.getItem('highlightOn');
    return saved === null ? false : saved === 'true';
  });
  useEffect(() => { localStorage.setItem('highlightOn', String(highlightOn)); }, [highlightOn]);
  
  const [outlineWidth, setOutlineWidth] = useState(OUTLINE_CONFIG.DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<CMHandle>(null);
  const [, setCmView] = useState<EditorView | null>(null);
  const resizeRaf = useRef<number | null>(null);

  // Outline now comes from CM6 (single source of truth)
  const [outline, setOutline] = useState<Heading[]>([]);
  const deferredOutline = useDeferredValue(outline);

  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  
  // Scroll-spy suppression for clean navigation
  const suppressScrollSpyRef = useRef<((ms?: number) => void) | null>(null);

  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);
  const toggleHighlight = useCallback(() => setHighlightOn(v => !v), []);

  // Caret just after visible heading text
  function caretAtHeadingEnd(md: string, h: { offset: number }) {
    const nl = md.indexOf('\n', h.offset);
    const lineEnd = nl === -1 ? md.length : nl;
    const trimmedLine = md
      .slice(h.offset, lineEnd)
      .replace(/\s*#+\s*$/, '')
      .replace(/\s+$/, '');
    return Math.min(md.length, h.offset + trimmedLine.length);
  }

  // Smooth scroll to pos with a slightly lower bias (keeps current heading dominant)
  function smoothScrollTo(view: EditorView, pos: number, margin = 24, bias = 0.34) {
    const rect = view.coordsAtPos(pos);
    if (!rect) return;
    const sc = view.scrollDOM;
    const scRect = sc.getBoundingClientRect();
    const anchorDelta = sc.clientHeight * bias;
    const targetTop = (rect.top - scRect.top) + sc.scrollTop - anchorDelta - margin;
    sc.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }

  // CM drives active heading; clicks will set it optimistically too
  const handleActiveHeadingChange = useCallback((id: string | null) => {
    setActiveHeadingId(id);
  }, []);

  /** Jump to a heading by exact offset (bulletproof CM6 native) */
  const onSelectHeading = useCallback((offset: number) => {
    const h = outline.find(o => o.offset === offset);
    if (!h) return;

    // Optimistic UI highlight
    handleActiveHeadingChange(h.id);

    const pos = caretAtHeadingEnd(markdown, h);

    // 1. Place the caret exactly at end-of-heading (cursor, not range) and focus
    cmRef.current?.setSelectionAt(pos);

    // 2. Use CM6 native scrollIntoView (already exposed by the editor handle)
    cmRef.current?.scrollToOffsetExact(pos, "center");
    // Briefly pause scroll-spy so it doesn't immediately override the optimistic highlight
    suppressScrollSpyRef.current?.(600);
  }, [outline, markdown, handleActiveHeadingChange]);

  // Cleanup
  useEffect(() => () => { document.body.classList.remove('noselect'); }, []);

  // No user scroll bookkeeping needed anymore

  // Mouse + touch resize (kept from your earlier version)
  useEffect(() => {
    if (!isResizing) return;

    const move = (clientX: number) => {
      if (resizeRaf.current) return;
      resizeRaf.current = requestAnimationFrame(() => {
        resizeRaf.current = null;
        const shell = shellRef.current;
        if (!shell) return;
        const x = clientX - shell.getBoundingClientRect().left;
        const next = Math.min(Math.max(x, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH);
        setOutlineWidth(next);
      });
    };

    const onMouseMove = (e: MouseEvent) => move(e.clientX);
    const onTouchMove = (e: TouchEvent) => move(e.touches[0]?.clientX ?? 0);

    const end = () => {
      setIsResizing(false);
      document.body.classList.remove('noselect');
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', end, { once: true });
    window.addEventListener('touchend', end, { once: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
    };
  }, [isResizing]);

  return (
    <div
      ref={shellRef}
      className="editor-shell"
      style={{
        display: 'grid',
        gridTemplateColumns: `${outlineWidth}px 1fr`,
        gridTemplateRows: '1fr auto',
        height: '100vh'
      }}
    >
      <OutlinePane
        outline={deferredOutline}
        activeHeadingId={activeHeadingId}
        onStartResize={onStartResize}
        onSelectHeading={onSelectHeading}    // offset only
        onBumpWidth={(d) => {
          setOutlineWidth(prev => Math.min(Math.max(prev + d, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH));
        }}
      />

      <div style={{ position: 'relative' }}>
        <MetricsBar markdown={markdown} />
        <CMEditor
          ref={cmRef}
          markdown={markdown}
          setMarkdown={setMarkdown}
          onCaretChange={() => {}}
          narrow={narrow}
          toggleNarrow={toggleNarrow}
          highlightOn={highlightOn}
          toggleHighlight={toggleHighlight}
          onReady={setCmView}
          onOutlineChange={setOutline}
          onActiveHeadingChange={(id) => handleActiveHeadingChange(id)}
          onScrollSpyReady={(suppress) => { suppressScrollSpyRef.current = suppress; }}
        />
      </div>
    </div>
  );
}