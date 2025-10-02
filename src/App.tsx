import { useCallback, useEffect, useRef, useState } from 'react';
import { OutlinePane } from '@/components/OutlinePane';
import { CMEditor } from '@/components/CMEditor';
import { MetricsBar } from '@/components/MetricsBar';
import { MetricsErrorBoundary } from '@/components/MetricsErrorBoundary';
import { OutlineErrorBoundary } from '@/components/OutlineErrorBoundary';
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { DocumentIO } from '@/components/DocumentIO';
import { QuickJump } from '@/components/QuickJump';
import { normalizeEOL } from '@/utils/eol';
import { safeGet, safeSet, safeRemove } from '@/utils/storage';
import { BusProvider } from '@/core/BusContext';
import { AIStateBridge } from '@/components/AIStateBridge';
import { AIDebugListener } from '@/components/AIDebugListener';
import { AIPromptModal } from '@/components/AIPromptModal';
import { AIServiceBridge } from '@/components/AIServiceBridge';
import { aiRegistry } from '@/services/aiProviders';
import { AIConfigStorage, installConsoleHelpers } from '@/services/aiConfig';
import '@/styles/globals.css';

const OUTLINE_CONFIG = {
  DEFAULT_WIDTH: 260,
  MIN_WIDTH: 160,
  MAX_WIDTH: 480
};

export default function App() {
  
  // replace initial markdown state with persisted hydrate
  const [markdown, _setMarkdown] = useState(() => {
    const saved = safeGet('markdown');
    return saved ?? `# First Heading

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

Final deep content.`;
  });
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
  const resizeRaf = useRef<number | null>(null);


  const onStartResize = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('noselect');
  }, []);

  const toggleNarrow = useCallback(() => setNarrow(v => !v), []);
  const toggleHighlight = useCallback(() => setHighlightOn(v => !v), []);

  // persist on change (throttled by React batching + normalizeEOL in setMarkdown)
  useEffect(() => {
    safeSet('markdown', markdown);
  }, [markdown]);

  // reset action
  const onResetDoc = useCallback(() => {
    if (confirm('Reset the current document? This cannot be undone.')) {
      safeRemove('markdown');
      _setMarkdown('');
    }
  }, []);

  // Load saved AI configurations on mount
  useEffect(() => {
    const configs = AIConfigStorage.load();
    if (configs.length > 0) {
      aiRegistry.loadFromConfigs(configs);
      // Set the first enabled provider as default
      const enabledProvider = configs.find(c => c.enabled);
      if (enabledProvider) {
        aiRegistry.setDefault(enabledProvider.id);
      }
    }
    // Install console helpers for easy configuration
    installConsoleHelpers();
  }, []);

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

  /*
   * Error Boundary Architecture:
   * 
   * AppErrorBoundary - Catches catastrophic errors that crash the entire app
   *   └── BusProvider - Event bus for component communication
   *       ├── OutlineErrorBoundary - Isolates outline panel errors
   *       │   └── OutlinePane - Document outline and navigation
   *       └── Editor Container
   *           ├── MetricsErrorBoundary - Isolates metrics calculation errors
   *           │   └── MetricsBar - Word count, reading time, etc.
   *           └── EditorErrorBoundary - Isolates main editor errors
   *               └── CMEditor - CodeMirror-based markdown editor
   *
   * Each boundary provides graceful degradation:
   * - Metrics failure: Shows warning, editor remains functional
   * - Outline failure: Shows error message, editor remains functional  
   * - Editor failure: Shows editor unavailable, offers reload
   * - App failure: Shows full-screen error with recovery options
   *
   * Global error handling (via errorReporting.ts) also captures:
   * - Unhandled promise rejections
   * - Chunk loading failures (code-splitting errors)
   * - Synchronous JavaScript errors
   */
  return (
    <AppErrorBoundary>
      <BusProvider>
      <AIStateBridge />
      <AIServiceBridge />
      <AIDebugListener />
      <QuickJump />
      <div
        ref={shellRef}
        className="editor-shell editor-shell--grid"
        style={{ '--outline-width': `${outlineWidth}px` } as React.CSSProperties}
      >
      <OutlineErrorBoundary>
        <OutlinePane
          onStartResize={onStartResize}
          onBumpWidth={(d) => {
            setOutlineWidth(prev => Math.min(Math.max(prev + d, OUTLINE_CONFIG.MIN_WIDTH), OUTLINE_CONFIG.MAX_WIDTH));
          }}
        />
      </OutlineErrorBoundary>

      <div style={{ position: 'relative' }}>
        <DocumentIO markdown={markdown} setMarkdown={setMarkdown} onReset={onResetDoc} />
        <MetricsErrorBoundary>
          <MetricsBar markdown={markdown} />
        </MetricsErrorBoundary>
        <EditorErrorBoundary>
          <CMEditor
            markdown={markdown}
            setMarkdown={setMarkdown}
            onCaretChange={() => {}}
            narrow={narrow}
            toggleNarrow={toggleNarrow}
            highlightOn={highlightOn}
            toggleHighlight={toggleHighlight}
            onReady={() => {}}
          />
        </EditorErrorBoundary>
      </div>
      </div>
      <AIPromptModal />
      </BusProvider>
    </AppErrorBoundary>
  );
}