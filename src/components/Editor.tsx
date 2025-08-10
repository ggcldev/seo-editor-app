type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onPasteMarkdown: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

import { useCallback, useEffect, useRef, useState } from 'react';

const EDITOR_STYLES = {
  main: { padding: 0, background: '#f6f6f6', height: '100vh' },
  container: { height: '100%', padding: 24, boxSizing: 'border-box' as const, display: 'flex', justifyContent: 'center' },
  wrapper: (narrow: boolean) => ({ position: 'relative' as const, width: '100%', maxWidth: narrow ? 760 : '100%', overflow: 'hidden' }),
  button: {
    position: 'absolute' as const, top: 8, right: 8, zIndex: 1, fontSize: 12, padding: '6px 10px',
    borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', cursor: 'pointer'
  },
  textarea: {
    width: '100%', height: 'calc(100vh - 48px)', resize: 'none' as const, border: 'none', padding: 0, paddingTop: 32, outline: 'none',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 14, lineHeight: 1.8, fontWeight: 500, color: '#111827', background: '#f6f6f6',
    boxSizing: 'border-box' as const, scrollBehavior: 'smooth' as const, scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const
  },
  scrollbar: {
    track: {
      position: 'fixed' as const, top: 32, right: 8, width: 8, height: 'calc(100vh - 80px)', borderRadius: 4,
      background: 'rgba(203, 213, 225, 0.3)', pointerEvents: 'none' as const, zIndex: 1000, transition: 'opacity 0.3s ease'
    },
    thumb: (position: number, size: number) => ({
      position: 'absolute' as const, top: `${position}%`, width: '100%', height: `${size}%`,
      background: '#cbd5e1', borderRadius: 4, transition: 'all 0.1s ease',
      transform: `translateY(-${position * (size / 100)}%)`
    })
  }
} as const;

export function Editor({ markdown, setMarkdown, onPasteMarkdown, onScroll, onCaretChange, narrow, toggleNarrow, textareaRef }: Props) {
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollThumbSize, setScrollThumbSize] = useState(20);
  const hideTimeoutRef = useRef<number | undefined>(undefined);

  const showScrollbars = useCallback(() => {
    setShowScrollbar(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = window.setTimeout(() => setShowScrollbar(false), 900);
  }, []);

  const hideScrollbars = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setShowScrollbar(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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

  const reportCaret = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    onCaretChange(el.selectionStart ?? 0);
  }, [onCaretChange]);

  return (
    <main style={EDITOR_STYLES.main}>
      <div style={EDITOR_STYLES.container}>
        <div 
          style={EDITOR_STYLES.wrapper(narrow)}
          onMouseEnter={showScrollbars}
          onMouseLeave={hideScrollbars}
          onMouseMove={showScrollbars}
        >
          <button
            type="button"
            onClick={toggleNarrow}
            style={EDITOR_STYLES.button}
            aria-label={narrow ? 'Switch to full width' : 'Switch to narrow width'}
          >
            {narrow ? 'Full width' : 'Squeeze'}
          </button>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => { setMarkdown(e.target.value); onCaretChange(e.currentTarget.selectionStart ?? 0); }}
            onPaste={onPasteMarkdown}
            onScroll={handleScroll}
            onKeyUp={reportCaret}
            onClick={reportCaret}
            style={EDITOR_STYLES.textarea}
          />
          {showScrollbar && (
            <div style={EDITOR_STYLES.scrollbar.track}>
              <div style={EDITOR_STYLES.scrollbar.thumb(scrollPosition, scrollThumbSize)} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}