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

  // NEW: active heading controlled purely by CM plugin
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const getOutline = useCallback(() => deferredOutline, [deferredOutline]);


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

  // Heading click (jump) still uses scrollIntoView
  const onSelectHeading = useCallback((id: string) => {
    const h = deferredOutline.find(o => o.id === id);
    if (!h) return;
    // caret at end of heading line (same helper you had)
    const pos = caretAtHeadingEnd(markdown, h);
    cmRef.current?.setSelectionAt(pos);
    cmRef.current?.scrollToOffsetExact(h.offset, "center");
    // Optimistically set active (plugin will confirm next frame)
    setActiveHeadingId(id);
  }, [deferredOutline, markdown]);


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
      });
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
      if (resizeRaf.current) {
        cancelAnimationFrame(resizeRaf.current);
      }
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
      />

      <div style={{ position: 'relative' }}>
        <MetricsBar markdown={markdown} />
        <CMEditor
          ref={cmRef}
          markdown={markdown}
          setMarkdown={setMarkdown}
          onCaretChange={() => { /* keep if you want caret-driven behaviors */ }}
          narrow={narrow}
          toggleNarrow={toggleNarrow}
          onReady={setCmView}
          // NEW:
          getOutline={getOutline}
          onActiveHeadingChange={setActiveHeadingId}
        />
      </div>
    </div>
  );
}
