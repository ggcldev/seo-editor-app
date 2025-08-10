import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutline } from './hooks/useOutline';
import { usePasteToMarkdown } from './hooks/usePasteToMarkdown';
import { useScrollSpy } from './hooks/useScrollSpy';
import { OutlinePane } from './components/OutlinePane';
import { Editor } from './components/Editor';

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
  const { htmlToMarkdown } = usePasteToMarkdown();

  const outline = useOutline(markdown);
  const { activeHeadingId, handleScroll, handleCaretChange, suppressScrollSpy } = useScrollSpy(markdown, outline);

  // Performance optimizations: precompute lookups
  const idToIndex = useMemo(() => new Map(outline.map((h, i) => [h.id, i])), [outline]);

  // Extract callbacks for stable references
  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

  // Smooth scrolling helper
  const smoothScrollTo = useCallback((el: HTMLTextAreaElement, target: number) => {
    const start = el.scrollTop;
    const delta = target - start;
    if (Math.abs(delta) < 1) { 
      el.scrollTop = target; 
      return; 
    }

    const dur = 180; // ms — snappy
    const t0 = performance.now();
    const ease = (t: number) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOutQuad

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      el.scrollTop = start + delta * ease(p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const targetScrollTopForOffset = useCallback((el: HTMLTextAreaElement, offset: number, total: number) => {
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    const ratio = total ? offset / total : 0;
    return Math.round(max * ratio);
  }, []);

  // Handle heading selection with smooth navigation (O(1) lookup)
  const onSelectHeading = useCallback((id: string) => {
    const idx = idToIndex.get(id);
    const el = textareaRef.current;
    if (idx == null || !el) return;
    
    const h = outline[idx];

    // 1) Focus and place caret at heading start (this alone often scrolls into view)
    el.focus();
    const safeOffset = Math.max(0, Math.min(h.offset, markdown.length));
    el.setSelectionRange(safeOffset, safeOffset);
    handleCaretChange(safeOffset);

    // 2) Suppress scroll spy during programmatic navigation to prevent race conditions
    suppressScrollSpy(300);

    // 3) Smooth scroll to the heading position
    const targetScroll = targetScrollTopForOffset(el, safeOffset, markdown.length);
    smoothScrollTo(el, targetScroll);
  }, [idToIndex, outline, markdown.length, smoothScrollTo, targetScrollTopForOffset, handleCaretChange, suppressScrollSpy]);

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
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

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
