import React, { useEffect, useRef, useState } from 'react';
import { useOutline } from './hooks/useOutline';
import { usePasteToMarkdown } from './hooks/usePasteToMarkdown';
import { OutlinePane } from './components/OutlinePane';
import { Editor } from './components/Editor';

export default function App() {
  const [markdown, setMarkdown] = useState<string>('');
  const [narrow, setNarrow] = useState<boolean>(false);
  const [outlineWidth, setOutlineWidth] = useState<number>(260);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const OUTLINE_MIN_PX = 160;
  const OUTLINE_MAX_PX = 480;
  const { htmlToMarkdown } = usePasteToMarkdown();

  const outline = useOutline(markdown);

  // Editor updates markdown directly via setMarkdown prop

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return; // let default plaintext paste occur

    e.preventDefault();
    const md = htmlToMarkdown(html);

    const el = textareaRef.current;
    if (!el) {
      setMarkdown((prev) => (prev ? `${prev}\n${md}` : md));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = `${before}${md}${after}`;
    setMarkdown(next);

    // Restore caret after React updates value
    requestAnimationFrame(() => {
      const pos = (before + md).length;
      el.selectionStart = el.selectionEnd = pos;
    });
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const x = e.clientX - rect.left; // distance from container left
      const next = Math.min(Math.max(x, OUTLINE_MIN_PX), OUTLINE_MAX_PX);
      setOutlineWidth(next);
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp as any);
    };
  }, [isResizing]);

  return (
    <div
      ref={shellRef}
      style={{ display: 'grid', gridTemplateColumns: `${outlineWidth}px 1fr`, height: '100vh' }}
    >
      <OutlinePane outline={outline} onStartResize={() => setIsResizing(true)} />

      <Editor
        markdown={markdown}
        setMarkdown={setMarkdown}
        onPasteMarkdown={handlePaste}
        narrow={narrow}
        toggleNarrow={() => setNarrow((v) => !v)}
      />
    </div>
  );
}

// id utility moved to utils/ids.ts for reuse

