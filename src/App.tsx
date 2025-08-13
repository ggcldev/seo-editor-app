import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
import { useOutline } from './hooks/useOutline';
import { OutlinePane } from './components/OutlinePane';
import { CMEditor, type CMHandle } from './components/CMEditor';
import type { EditorView } from '@codemirror/view';
import { MetricsBar } from './components/MetricsBar';
import { normalizeEOL } from './utils/eol';
import './styles/globals.css';

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

  const [narrow, setNarrow] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState(OUTLINE_CONFIG.DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<CMHandle>(null);
  const [, setCmView] = useState<EditorView | null>(null);
  const resizeRaf = useRef<number | null>(null);

  // IMPORTANT: compute fresh outline; only use deferred one for rendering
  const outline = useOutline(markdown);
  const deferredOutline = useDeferredValue(outline);

  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const getOutline = useCallback(() => deferredOutline, [deferredOutline]);

  // Exposed by CM scroll‑spy
  const suppressScrollSpyRef = useRef<((ms?: number) => void) | null>(null);

  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

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

  /**
   * Jump to a heading. Uses the FRESHEST outline (not deferred) and,
   * when provided, resolves by (id, expectedOffset) to avoid duplicates.
   */
  const onSelectHeading = useCallback((id: string, expectedOffset?: number) => {
    // 1) Resolve in fresh outline first
    let h = expectedOffset != null
      ? outline.find(o => o.id === id && o.offset === expectedOffset)
      : undefined;
    if (!h) h = outline.find(o => o.id === id);

    // 2) Fallback to deferred if needed (very rare)
    if (!h && expectedOffset != null) {
      h = deferredOutline.find(o => o.id === id && o.offset === expectedOffset);
    }
    if (!h) h = deferredOutline.find(o => o.id === id);
    if (!h) return;

    // Keep spy quiet during programmatic scroll (and release early once settled)
    suppressScrollSpyRef.current?.(1400);

    const pos = caretAtHeadingEnd(markdown, h);
    cmRef.current?.setSelectionAt(pos);

    const view = cmRef.current?.getView();
    if (view) {
      smoothScrollTo(view, pos, 24, 0.34);

      // Early suppression termination when scrolling stabilizes
      const sc = view.scrollDOM;
      let last = sc.scrollTop;
      let still = 0;
      const tick = () => {
        const now = sc.scrollTop;
        if (Math.abs(now - last) < 0.5) {
          if (++still >= 4) { suppressScrollSpyRef.current?.(0); return; }
        } else {
          still = 0; last = now;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    setActiveHeadingId(h.id); // optimistic; spy confirms next frame
  }, [outline, deferredOutline, markdown]);

  // Cleanup
  useEffect(() => () => { document.body.classList.remove('noselect'); }, []);

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
        outline={deferredOutline}            // render-friendly
        activeHeadingId={activeHeadingId}
        onStartResize={onStartResize}
        onSelectHeading={onSelectHeading}    // (id, expectedOffset?) supported
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
          onReady={setCmView}
          getOutline={() => deferredOutline}
          onActiveHeadingChange={setActiveHeadingId}
          onScrollSpyReady={(suppress) => { suppressScrollSpyRef.current = suppress; }}
        />
      </div>
    </div>
  );
}