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

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

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

  const outline = useOutline(markdown);
  const deferredOutline = useDeferredValue(outline); // <- render later if typing

  // Active heading driven by CM scroll‑spy
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const getOutline = useCallback(() => deferredOutline, [deferredOutline]);

  // Exposed by CM: call to temporarily suppress scroll‑spy
  const suppressScrollSpyRef = useRef<((ms?: number) => void) | null>(null);


  // ---- UI handlers ---------------------------------------------------------

  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const onBumpWidth = useCallback((delta: number) => {
    setOutlineWidth(prev => {
      const next = Math.min(Math.max(prev + delta, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH);
      return next;
    });
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

  // Compute caret position at the end of a heading line
  function caretAtHeadingEnd(md: string, h: { offset: number }) {
    const nl = md.indexOf('\n', h.offset);
    const lineEnd = nl === -1 ? md.length : nl;
    const line = md.slice(h.offset, lineEnd);
    const trimmed = line.replace(/\s*#+\s*$/, '').replace(/\s+$/, '');
    return h.offset + trimmed.length;
  }

  // Centered smooth scroll with margin
  function smoothScrollToCenter(view: EditorView, pos: number, margin = 24, bias = 0.5) {
    const rect = view.coordsAtPos(pos);
    if (!rect) return;

    const sc = view.scrollDOM;
    const scRect = sc.getBoundingClientRect();
    const anchorDelta = sc.clientHeight * bias;

    const targetTop =
      (rect.top - scRect.top) +
      sc.scrollTop -
      anchorDelta -
      margin;

    sc.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }

  // Jump to heading from outline (suppress spy during programmatic scroll)
  const onSelectHeading = useCallback((id: string) => {
    const h = deferredOutline.find(o => o.id === id);
    if (!h) return;

    // Heuristic: 700–900ms covers typical smooth scrolls; keep your 1200ms if you prefer.
    suppressScrollSpyRef.current?.(900);

    const pos = caretAtHeadingEnd(markdown, h);
    cmRef.current?.setSelectionAt(pos);

    const view = cmRef.current?.getView();
    if (view) smoothScrollToCenter(view, h.offset, 24, 0.5);

    setActiveHeadingId(id); // optimistic; plugin will confirm next tick
  }, [deferredOutline, markdown]);


  // Body class leak guard - ensure 'noselect' is cleaned up on unmount
  useEffect(() => () => { document.body.classList.remove('noselect'); }, []);

  // Mouse + touch resize with rAF throttling
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
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX);
    };

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
        onSelectHeading={onSelectHeading}
        // NEW: keyboard bump (a11y)
        onBumpWidth={onBumpWidth}
      />

      <div style={{ position: 'relative' }}>
        <MetricsBar markdown={markdown} />
        <CMEditor
          ref={cmRef}
          markdown={markdown}
          setMarkdown={setMarkdown}
          onCaretChange={() => { /* keep for caret-driven behaviors */ }}
          narrow={narrow}
          toggleNarrow={toggleNarrow}
          onReady={setCmView}
          getOutline={getOutline}
          onActiveHeadingChange={setActiveHeadingId}
          onScrollSpyReady={(suppress) => { suppressScrollSpyRef.current = suppress; }}
        />
      </div>
    </div>
  );
}
