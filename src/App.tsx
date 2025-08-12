import { useCallback, useEffect, useRef, useState, useDeferredValue, startTransition } from 'react';
import { useOutline } from './hooks/useOutline';
import { usePasteToMarkdown } from './hooks/usePasteToMarkdown';
import { useScrollSpy } from './hooks/useScrollSpy';
import { OutlinePane } from './components/OutlinePane';
import { CMEditor, type CMHandle } from './components/CMEditor';
import type { EditorView } from '@codemirror/view';
import { MetricsBar } from './components/MetricsBar';
import { type RevealMode } from './hooks/useScrollSpy';
import './styles/globals.css';

const OUTLINE_CONFIG = {
  DEFAULT_WIDTH: 260,
  MIN_WIDTH: 160,
  MAX_WIDTH: 480
};

export default function App() {
  const [markdown, setMarkdown] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState(OUTLINE_CONFIG.DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<CMHandle>(null);
  const [cmView, setCmView] = useState<EditorView | null>(null);
  const resizeRaf = useRef<number | null>(null);
  const [revealMode] = useState<RevealMode>('third'); // 'top' | 'center' | 'third'
  const { htmlToMarkdown } = usePasteToMarkdown();


  const outline = useOutline(markdown);
  const deferredOutline = useDeferredValue(outline); // <- render later if typing
  const {
    activeHeadingId, handleViewportChange, handleCaretChange,
    suppressScrollSpy, lockActiveTo, clearLock,
    recomputeHeadingTops, scheduleRecomputeHeadingTops
  } = useScrollSpy(markdown, deferredOutline, { current: null } as any, revealMode, cmView);


  // Extract callbacks for stable references
  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

  // Helper to compute caret position at the end of a heading line
  function caretAtHeadingEnd(markdown: string, h: { offset: number }) {
    // Find end of the line that contains the heading
    const nl = markdown.indexOf('\n', h.offset);
    const lineEnd = nl === -1 ? markdown.length : nl;

    // Slice the heading line text
    const line = markdown.slice(h.offset, lineEnd);

    // Trim any trailing " ###" and trailing spaces (ATX style like "## Title ###")
    const trimmed = line.replace(/\s*#+\s*$/, '').replace(/\s+$/, '');

    // Caret should sit right after the visible heading text
    return h.offset + trimmed.length;
  }

  // Handle heading selection with exact pixel positioning and lock mechanism
  const onSelectHeading = useCallback((id: string) => {
    const h = deferredOutline.find(o => o.id === id);
    const view = cmRef.current?.getView();
    if (!h || !view) return;

    // lock + suppress scroll spy while animating
    lockActiveTo(h.id, 1000);
    suppressScrollSpy(1000);

    // place caret at end of heading
    const pos = caretAtHeadingEnd(markdown, h);
    cmRef.current?.setSelectionAt(pos);
    handleCaretChange(pos);

    // ⬅️ recompute tops immediately for accurate tracking
    recomputeHeadingTops();

    // ✅ wait one paint, then animate scroll reliably
    requestAnimationFrame(() => {
      cmRef.current?.scrollToOffsetExact(h.offset, revealMode);
      // keep your lock lifecycle the same
      requestAnimationFrame(() => {
        clearLock();
        handleCaretChange(pos);
        recomputeHeadingTops();
      });
    });
  }, [deferredOutline, markdown, revealMode, lockActiveTo, suppressScrollSpy, handleCaretChange, clearLock, recomputeHeadingTops]);


  // Schedule recompute on markdown changes (idle, non-blocking)
  useEffect(() => {
    scheduleRecomputeHeadingTops();
  }, [scheduleRecomputeHeadingTops, markdown]);

  // Schedule recompute on window resize (idle, non-blocking)
  useEffect(() => {
    const onResize = () => scheduleRecomputeHeadingTops();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scheduleRecomputeHeadingTops]);

  // Body class leak guard - ensure 'noselect' is cleaned up on unmount
  useEffect(() => () => { document.body.classList.remove('noselect'); }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (resizeRaf.current) return;
      resizeRaf.current = requestAnimationFrame(() => {
        resizeRaf.current = null;
        const shell = shellRef.current;
        if (!shell) return;
        const x = e.clientX - shell.getBoundingClientRect().left;
        const next = Math.min(Math.max(x, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH);
        setOutlineWidth(next);
        scheduleRecomputeHeadingTops();
      });
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.classList.remove('noselect');
      // Recompute heading tops after resize is complete
      scheduleRecomputeHeadingTops();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (resizeRaf.current) {
        cancelAnimationFrame(resizeRaf.current);
      }
    };
  }, [isResizing, scheduleRecomputeHeadingTops]);

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
      />

      <div style={{ position: 'relative' }}>
        <MetricsBar markdown={markdown} />
        <CMEditor
          ref={cmRef}
          markdown={markdown}
          setMarkdown={setMarkdown}
          onCaretChange={handleCaretChange}
          narrow={narrow}
          toggleNarrow={toggleNarrow}
          onReady={setCmView}
          onViewportChange={handleViewportChange}
        />
      </div>
    </div>
  );
}
