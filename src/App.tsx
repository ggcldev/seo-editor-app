import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutline } from './hooks/useOutline';
import { usePasteToMarkdown } from './hooks/usePasteToMarkdown';
import { useScrollSpy } from './hooks/useScrollSpy';
import { OutlinePane } from './components/OutlinePane';
import { Editor } from './components/Editor';
import { scrollToOffsetExact, measureOffsetTop, type RevealMode } from './utils/scrollUtils';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [revealMode] = useState<RevealMode>('third'); // 'top' | 'center' | 'third'
  const { htmlToMarkdown } = usePasteToMarkdown();

  const outline = useOutline(markdown);
  const { activeHeadingId, handleScroll, handleCaretChange, suppressScrollSpy, lockActiveTo, clearLock, recomputeHeadingTops } = useScrollSpy(markdown, outline, textareaRef);


  // Extract callbacks for stable references
  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

  // Handle heading selection with exact pixel positioning and lock mechanism
  const onSelectHeading = useCallback((id: string) => {
    const h = outline.find(o => o.id === id);
    const el = textareaRef.current;
    if (!h || !el) return;

    // Calculate dynamic lock duration based on jump distance
    const targetY = measureOffsetTop(el, h.offset);
    const distance = Math.abs(el.scrollTop - targetY);
    const ms = Math.min(1200, Math.max(500, Math.round(distance / 2))); // 500-1200ms

    // Lock the highlight to this heading and suppress scrollspy during animation
    lockActiveTo(h.id, ms);
    suppressScrollSpy(ms);

    // Move caret (source of truth) & update highlight immediately
    el.focus();
    el.setSelectionRange(h.offset, h.offset);
    handleCaretChange(h.offset);

    // Smoothly reveal the section; unlock at the end
    scrollToOffsetExact(el, h.offset, revealMode, () => {
      clearLock();              // release the lock
      handleCaretChange(h.offset); // reassert, just in case
    });
  }, [outline, revealMode, lockActiveTo, suppressScrollSpy, handleCaretChange, clearLock]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return;

    e.preventDefault();
    const md = htmlToMarkdown(html);
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${md}${el.value.slice(end)}`;
    setMarkdown(next);

    requestAnimationFrame(() => {
      const pos = start + md.length;
      el.selectionStart = el.selectionEnd = pos;
      handleCaretChange(pos);
      recomputeHeadingTops();
    });
  }, [htmlToMarkdown]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      const x = e.clientX - shell.getBoundingClientRect().left;
      setOutlineWidth(Math.min(Math.max(x, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH));
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.classList.remove('noselect');
      // Recompute heading tops after resize is complete
      recomputeHeadingTops();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, recomputeHeadingTops]);

  return (
    <div
      ref={shellRef}
      style={{ display: 'grid', gridTemplateColumns: `${outlineWidth}px 1fr`, height: '100vh' }}
    >
      <OutlinePane 
        outline={outline} 
        activeHeadingId={activeHeadingId}
        onStartResize={onStartResize}
        onSelectHeading={onSelectHeading}
      />

      <Editor
        markdown={markdown}
        setMarkdown={setMarkdown}
        onPasteMarkdown={handlePaste}
        onScroll={handleScroll}
        onCaretChange={handleCaretChange}
        narrow={narrow}
        toggleNarrow={toggleNarrow}
        textareaRef={textareaRef}
      />
    </div>
  );
}
