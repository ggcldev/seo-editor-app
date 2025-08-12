type EditorProps = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onPasteMarkdown: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  onCaretChange: (pos: number) => void;
  narrow: boolean;
  toggleNarrow: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

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
    boxSizing: 'border-box' as const, scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const
  },
  scrollbar: {
    track: {
      position: 'absolute' as const, top: 32, right: 8, bottom: 16, width: 8, borderRadius: 4,
      background: 'rgba(203, 213, 225, 0.3)', pointerEvents: 'none' as const, zIndex: 1, transition: 'opacity 0.3s ease'
    },
    thumb: (position: number, size: number, trackHeight: number) => ({
      position: 'absolute' as const, 
      top: `${Math.round(position * (trackHeight - size * trackHeight / 100) / 100)}px`,
      width: '100%', 
      height: `${size}%`,
      background: '#cbd5e1', 
      borderRadius: 4, 
      transition: 'all 0.1s ease'
    })
  }
} as const;

// memoize dynamic styles to avoid new objects per render
const useWrapperStyle = (narrow: boolean) => useMemo(() => EDITOR_STYLES.wrapper(narrow), [narrow]);
const useThumbStyle = (pos: number, size: number, trackHeight: number) => useMemo(() => EDITOR_STYLES.scrollbar.thumb(pos, size, trackHeight), [pos, size, trackHeight]);

export function Editor({ markdown, setMarkdown, onPasteMarkdown, onScroll, onCaretChange, narrow, toggleNarrow, textareaRef }: EditorProps) {
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollThumbSize, setScrollThumbSize] = useState(20);
  const [trackHeight, setTrackHeight] = useState(0);
  const hideTimeoutRef = useRef<number | undefined>(undefined);
  const scrollRaf = useRef<number | null>(null);
  const scrollStateRef = useRef({ pos: 0, size: 20 });
  const trackRef = useRef<HTMLDivElement | null>(null);
  

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
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
      }
    };
  }, []);


  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    showScrollbars();
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    if (scrollHeight > clientHeight) {
      const pos = (scrollTop / (scrollHeight - clientHeight)) * 100;
      const size = Math.max(20, (clientHeight / scrollHeight) * 100);
      scrollStateRef.current = { pos, size };
      if (scrollRaf.current == null) {
        scrollRaf.current = requestAnimationFrame(() => {
          scrollRaf.current = null;
          const { pos, size } = scrollStateRef.current;
          setScrollPosition(pos);
          setScrollThumbSize(size);
          // Calculate track height: total height minus top/bottom padding (32 + 16 = 48)
          setTrackHeight(clientHeight - 48);
        });
      }
    }
    onScroll(e);
  }, [onScroll, showScrollbars]);

  const reportCaret = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    onCaretChange(el.selectionStart ?? 0);
  }, [onCaretChange]);

  // Use memoized styles with safe track height
  const wrapperStyle = useWrapperStyle(narrow);
  const safeTrackHeight = Math.max(trackHeight, 1);
  const thumbStyle = useThumbStyle(scrollPosition, scrollThumbSize, safeTrackHeight);

  // Keep typing smooth - instant updates
  const onChangeFast = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setMarkdown(el.value);
    onCaretChange(el.selectionStart ?? 0);
  }, [setMarkdown, onCaretChange]);

  return (
    <main style={EDITOR_STYLES.main}>
      <div style={EDITOR_STYLES.container}>
        <div 
          style={wrapperStyle}
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
            onChange={onChangeFast}
            onSelect={reportCaret}
            onClick={(e) => onCaretChange(e.currentTarget.selectionStart ?? 0)}
            onPaste={onPasteMarkdown}
            onScroll={handleScroll}
            style={EDITOR_STYLES.textarea}
          />
          {showScrollbar && (
            <div ref={trackRef} style={EDITOR_STYLES.scrollbar.track}>
              <div className="custom-scrollbar-thumb" style={thumbStyle} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}