import { useCallback, useEffect, useRef, useState } from 'react';
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
  const { htmlToMarkdown } = usePasteToMarkdown();

  const outline = useOutline(markdown);
  const { activeHeadingId, handleScroll, handleCaretChange } = useScrollSpy(markdown, outline);

  // Extract callbacks for stable references
  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);

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
      />

      <Editor
        markdown={markdown}
        setMarkdown={setMarkdown}
        onPasteMarkdown={handlePaste}
        onScroll={handleScroll}
        onCaretChange={handleCaretChange}
        narrow={narrow}
        toggleNarrow={toggleNarrow}
      />
    </div>
  );
}
