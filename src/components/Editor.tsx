type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onPasteMarkdown: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  narrow: boolean;
  toggleNarrow: () => void;
};

import { useCallback, useEffect, useRef, useState } from 'react';

export function Editor({ markdown, setMarkdown, onPasteMarkdown, onScroll, narrow, toggleNarrow }: Props) {
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollThumbSize, setScrollThumbSize] = useState(20);
  const hideTimeoutRef = useRef<number>();

  const showScrollbars = useCallback(() => {
    setShowScrollbar(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = window.setTimeout(() => setShowScrollbar(false), 900);
  }, []);

  const hideScrollbars = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setShowScrollbar(false);
  }, []);

  useEffect(() => () => hideTimeoutRef.current && clearTimeout(hideTimeoutRef.current), []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    showScrollbars();
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    if (scrollHeight > clientHeight) {
      const scrollPercent = scrollTop / (scrollHeight - clientHeight);
      setScrollPosition(scrollPercent * 100);
      setScrollThumbSize(Math.max(20, (clientHeight / scrollHeight) * 100));
    }
    onScroll(e);
  }, [onScroll, showScrollbars]);

  return (
    <main style={{ padding: 0, background: '#f6f6f6', height: '100vh' }}>
      <div style={{ height: '100%', padding: 24, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
        <div 
          style={{ position: 'relative', width: '100%', maxWidth: narrow ? 760 : '100%', overflow: 'hidden' }}
          onMouseEnter={showScrollbars}
          onMouseLeave={hideScrollbars}
          onMouseMove={showScrollbars}
        >
          <button
            type="button"
            onClick={toggleNarrow}
            style={{
              position: 'absolute', top: 8, right: 8, zIndex: 1, fontSize: 12, padding: '6px 10px',
              borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', cursor: 'pointer',
            }}
            aria-label={narrow ? 'Switch to full width' : 'Switch to narrow width'}
          >
            {narrow ? 'Full width' : 'Squeeze'}
          </button>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            onPaste={onPasteMarkdown}
            onScroll={handleScroll}
            style={{
              width: '100%', height: 'calc(100vh - 48px)', resize: 'none', border: 'none', padding: 0, paddingTop: 32, outline: 'none',
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 14, lineHeight: 1.8, fontWeight: 500, color: '#111827', background: '#f6f6f6',
              boxSizing: 'border-box', scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}
          />
          {showScrollbar && (
            <div style={{
              position: 'fixed', top: 32, right: 8, width: 8, height: 'calc(100vh - 80px)', borderRadius: 4,
              background: 'rgba(203, 213, 225, 0.3)', pointerEvents: 'none', zIndex: 1000, transition: 'opacity 0.3s ease',
            }}>
              <div style={{
                position: 'absolute', top: `${scrollPosition}%`, width: '100%', height: `${scrollThumbSize}%`,
                background: '#cbd5e1', borderRadius: 4, transition: 'all 0.1s ease',
                transform: `translateY(-${scrollPosition * (scrollThumbSize / 100)}%)`,
              }} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}