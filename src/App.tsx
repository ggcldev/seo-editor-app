import { useCallback, useEffect, useRef, useState } from 'react';
import { OutlinePane } from '@/components/OutlinePane';
import { CMEditor, type CMHandle } from '@/components/CMEditor';
import { MetricsBar } from '@/components/MetricsBar';
import { normalizeEOL } from '@/utils/eol';
import { BusProvider } from '@/core/BusContext';
import '@/styles/globals.css';

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
  const resizeRaf = useRef<number | null>(null);


  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);
  const toggleHighlight = useCallback(() => setHighlightOn(v => !v), []);

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
    <BusProvider>
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
        onStartResize={onStartResize}
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
          onReady={() => {}}
        />
      </div>
      </div>
    </BusProvider>
  );
}