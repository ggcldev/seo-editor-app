import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from '@/core/outlineParser';
import { OutlineItem } from '@/components/OutlineItem';
import { useBus } from '@/core/BusContext';
import { VirtualList, type VirtualListHandle } from '@/components/VirtualList';
import { OUTLINE_ROW_HEIGHT_PX, OUTLINE_INDENT_PX, OUTLINE_VIRTUAL_THRESHOLD } from '@/core/constants';


const OUTLINE_STYLES = {
  aside: { border: 'none', background: '#fff', overflowY: 'auto' as const, position: 'relative' as const },
  resizer: { position: 'absolute' as const, top: 0, right: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 },
  container: { padding: 12, display: 'flex', flexDirection: 'column' as const, height: '100%' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 12, color: '#6b7280', fontWeight: 600 },
  list: { display: 'grid', gap: 4 },
  foldBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28, height: 28,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#4b5563',
    borderRadius: 6
  } as const,
} as const;

type OutlinePaneProps = {
  onStartResize: () => void;
  onBumpWidth: (delta: number) => void;
};

function hasChildren(outline: Heading[], i: number): boolean {
  const me = outline[i], next = outline[i + 1];
  return !!next && next.level > me.level;
}

function computeVisible(outline: Heading[], collapsed: Set<string>): Heading[] {
  if (!outline.length || !collapsed.size) return outline;
  const visible: Heading[] = [];
  const stack: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const h = outline[i];
    while (stack.length && h.level <= stack[stack.length - 1]) stack.pop();
    if (stack.length && h.level > stack[stack.length - 1]) continue;
    visible.push(h);
    if (collapsed.has(h.id)) stack.push(h.level);
  }
  return visible;
}

function isActiveVisible(outline: Heading[], activeId: string | null, collapsed: Set<string>): boolean {
  if (!activeId || !collapsed.size) return true;
  const idx = outline.findIndex(h => h.id === activeId);
  if (idx < 0) return true;
  let level = outline[idx].level;
  for (let i = idx - 1; i >= 0; i--) {
    const anc = outline[i];
    if (anc.level < level) {
      if (collapsed.has(anc.id)) return false;
      level = anc.level;
      if (level === 1) break;
    }
  }
  return true;
}

function nearestCollapsedAncestorId(outline: Heading[], activeId: string, collapsed: Set<string>): string | null {
  const idx = outline.findIndex(h => h.id === activeId);
  if (idx < 0) return null;
  let level = outline[idx].level;
  for (let i = idx - 1; i >= 0; i--) {
    const anc = outline[i];
    if (anc.level < level) {
      if (collapsed.has(anc.id)) return anc.id;
      level = anc.level;
      if (level === 1) break;
    }
  }
  return null;
}


export const OutlinePane = React.memo(function OutlinePane({
  onStartResize, onBumpWidth
}: OutlinePaneProps) {
  const bus = useBus();
  const scrollRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  // EventBus state
  const [outline, setOutline] = useState<Heading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  
  useEffect(() => {
    const off1 = bus.on("outline:computed", ({ headings }) => setOutline(headings));
    const off2 = bus.on("outline:active", ({ id }) => setActiveHeadingId(id));
    bus.emit("outline:request", {});
    return () => { off1(); off2(); };
  }, [bus]);
  
  // Virtualization
  const listRef = useRef<VirtualListHandle>(null);
  const [focusIdx, setFocusIdx] = useState(0);


  // Which headings have children?
  const hasChild = useMemo(() => {
    const m = new Map<string, boolean>();
    for (let i = 0; i < outline.length; i++) m.set(outline[i].id, hasChildren(outline, i));
    return m;
  }, [outline]);

  const visible = useMemo(() => computeVisible(outline, collapsed), [outline, collapsed]);
  const useVirtual = visible.length >= OUTLINE_VIRTUAL_THRESHOLD;
  
  const idToIdx = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((h, i) => m.set(h.id, i));
    return m;
  }, [visible]);

  const displayActiveId = useMemo(() => {
    if (!activeHeadingId) return null;
    if (isActiveVisible(outline, activeHeadingId, collapsed)) return activeHeadingId;
    return nearestCollapsedAncestorId(outline, activeHeadingId, collapsed) ?? activeHeadingId;
  }, [outline, activeHeadingId, collapsed]);

  // Soft follow for active heading changes with balanced scrolling
  useEffect(() => {
    let scrollTimeout: number | undefined;
    
    const off = bus.on('outline:active', ({ id, source }) => {
      const i = id ? (idToIdx.get(id) ?? 0) : 0;
      setFocusIdx(i);
      
      // Clear any pending scroll operations to prevent jumping
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = undefined;
      }
      
      // Differentiate between scroll events and user interactions
      const isUserAction = source === 'click' || source === 'keyboard';
      const isScrollEvent = source === 'scroll';
      
      // Handle scrolling for all modes and sources
      if (useVirtual) {
        if (isUserAction) {
          // For user actions: ensure full visibility
          listRef.current?.ensureVisible(i, { bandRows: 0 });
        } else if (isScrollEvent) {
          // For scroll events: gentle following with larger band
          listRef.current?.ensureVisible(i, { bandRows: 2 });
        }
      } else {
        // Non-virtual mode: different strategies for different event types
        const delay = isUserAction ? 50 : 200; // Longer delay for scroll events
        
        scrollTimeout = window.setTimeout(() => {
          // Find the correct scrollable container - the inner .outline-scroll div
          const outerContainer = scrollRef.current;
          const container = outerContainer?.querySelector('.outline-scroll') as HTMLElement || outerContainer;
          const targetElement = document.getElementById(`toc-${id}`);
          if (container && targetElement) {
            const itemTop = targetElement.offsetTop;
            const itemBottom = itemTop + targetElement.offsetHeight;
            const viewTop = container.scrollTop;
            const viewBottom = viewTop + container.clientHeight;
            
            if (isUserAction) {
              // For user clicks: ensure visibility with reasonable margin
              const margin = 24;
              if (itemTop < viewTop + margin || itemBottom > viewBottom - margin) {
                const scrollTop = Math.max(0, itemTop - margin);
                container.scrollTo({ top: scrollTop, behavior: 'smooth' });
              }
            } else if (isScrollEvent) {
              // For scroll events: only scroll if item is completely out of view
              const margin = 64; // Much larger margin to be very conservative
              if (itemTop < viewTop || itemBottom > viewBottom) {
                const scrollTop = Math.max(0, itemTop - margin);
                container.scrollTo({ top: scrollTop, behavior: 'smooth' });
              }
            }
          }
          scrollTimeout = undefined;
        }, delay);
      }
    });
    
    return () => {
      off();
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [bus, idToIdx, useVirtual]);
  
  // Polite auto-scroll for non-virtual mode
  const userScrollUntil = useRef(0);
  const markUserScroll = useCallback(() => { userScrollUntil.current = Date.now() + 300; }, []);
  const isUserScrolling = useCallback(() => Date.now() < userScrollUntil.current, []);

  useEffect(() => {
    if (useVirtual) return; // Skip for virtual mode
    const el = scrollRef.current;
    if (!el) return;

    const passiveCaptureFalse: AddEventListenerOptions = { passive: true, capture: false };

    el.addEventListener('wheel', markUserScroll, passiveCaptureFalse);
    el.addEventListener('touchstart', markUserScroll, passiveCaptureFalse);
    el.addEventListener('scroll', markUserScroll, passiveCaptureFalse);

    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)) markUserScroll();
    };
    el.addEventListener('keydown', onKey, false);

    return () => {
      el.removeEventListener('wheel', markUserScroll, false);
      el.removeEventListener('touchstart', markUserScroll, false);
      el.removeEventListener('scroll', markUserScroll, false);
      el.removeEventListener('keydown', onKey, false);
    };
  }, [markUserScroll, useVirtual]);

  // Non-virtual auto-scroll (legacy)
  useEffect(() => {
    if (useVirtual || isUserScrolling()) return;
    const item = activeItemRef.current;
    const container = scrollRef.current;
    if (!item || !container) return;

    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const margin = 16;

    if (itemTop < viewTop + margin) {
      container.scrollTo({ top: Math.max(0, itemTop - margin), behavior: 'smooth' });
    } else if (itemBottom > viewBottom - margin) {
      container.scrollTo({ top: itemBottom - container.clientHeight + margin, behavior: 'smooth' });
    }
  }, [displayActiveId, visible, useVirtual, isUserScrolling]);

  const toggleFold = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);


  // Keyboard navigation
  const onRowKeyDown = useCallback((e: React.KeyboardEvent, _i: number, h: Heading, canFold: boolean, isFolded: boolean) => {
    switch (e.key) {
      case "ArrowDown": 
        e.preventDefault(); 
        setFocusIdx(v => { 
          const n = Math.min(v + 1, visible.length - 1); 
          listRef.current?.ensureVisible(n, { bandRows: 0 }); 
          return n; 
        }); 
        break;
      case "ArrowUp":   
        e.preventDefault(); 
        setFocusIdx(v => { 
          const n = Math.max(v - 1, 0); 
          listRef.current?.ensureVisible(n, { bandRows: 0 }); 
          return n; 
        }); 
        break;
      case "PageDown":  
        e.preventDefault(); 
        setFocusIdx(v => { 
          const step = Math.max(1, Math.floor(8)); 
          const n = Math.min(v + step, visible.length - 1); 
          listRef.current?.ensureVisible(n, { bandRows: 0 }); 
          return n; 
        }); 
        break;
      case "PageUp":    
        e.preventDefault(); 
        setFocusIdx(v => { 
          const step = Math.max(1, Math.floor(8)); 
          const n = Math.max(v - step, 0); 
          listRef.current?.ensureVisible(n, { bandRows: 0 }); 
          return n; 
        }); 
        break;
      case "Home":      
        e.preventDefault(); 
        setFocusIdx(0); 
        listRef.current?.ensureVisible(0, { bandRows: 0 }); 
        break;
      case "End":       
        e.preventDefault(); 
        setFocusIdx(visible.length - 1); 
        listRef.current?.ensureVisible(visible.length - 1, { bandRows: 0 }); 
        break;
      case "Enter":
      case " ":         
        e.preventDefault(); 
        bus.emit("nav:jump", { offset: h.offset, source: "outline" }); 
        break;
      case "ArrowLeft": 
        if (canFold && !isFolded) { e.preventDefault(); toggleFold(h.id); } 
        break;
      case "ArrowRight":
        if (canFold &&  isFolded) { e.preventDefault(); toggleFold(h.id); } 
        break;
    }
  }, [visible.length, bus, toggleFold]);

  return (
    <aside
      ref={scrollRef}
      className="outline-pane"
      style={OUTLINE_STYLES.aside}
      role="tree"
      aria-label="Document outline"
    >
      <div
        className="outline-resizer"
        onMouseDown={(e) => { e.preventDefault(); onStartResize(); }}
        onTouchStart={(e) => { e.preventDefault(); onStartResize(); }}
        style={OUTLINE_STYLES.resizer}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onBumpWidth(-16); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onBumpWidth(+16); }
        }}
        aria-label="Resize outline"
        title="Drag or use Left/Right arrows to resize"
      />
      <div style={OUTLINE_STYLES.container}>
        <div style={OUTLINE_STYLES.titleRow}>
          <div style={OUTLINE_STYLES.title}>Outline</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="outline-muted-btn" onClick={() => setCollapsed(new Set())} title="Expand all">
              Expand all
            </button>
            <button
              type="button"
              className="outline-muted-btn"
              onClick={() => setCollapsed(new Set(outline.filter((_, i) => hasChildren(outline, i)).map(h => h.id)))}
              title="Collapse all"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* Render with/without VirtualList using same child renderer */}
        {useVirtual ? (
          <VirtualList
            ref={listRef}
            count={visible.length}
            rowHeight={OUTLINE_ROW_HEIGHT_PX}
            overscan={24}                           // base overscan
            // adaptiveOverscan={{ base: 24, max: 48, factor: 20 }} // temporarily disabled
            className="outline-scroll"
            style={{ height: "100%" }}
          >
            {(i, itemStyle) => {
              const h = visible[i];
              const isActive = h.id === displayActiveId;
              const canFold = !!hasChild.get(h.id);
              const isFolded = collapsed.has(h.id);
              const isFocusable = i === focusIdx;

              return (
                <div
                  key={`${h.id}@${h.offset}`}
                  id={`toc-${h.id}`}
                  role="treeitem"
                  aria-level={h.level}
                  aria-selected={isActive}
                  aria-expanded={canFold ? !isFolded : undefined}
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={isFocusable ? 0 : -1}
                  onKeyDown={(e) => onRowKeyDown(e, i, h, canFold, isFolded)}
                  onFocus={() => setFocusIdx(i)}
                  onClick={() => { 
                    setFocusIdx(i); 
                    bus.emit("nav:jump", { offset: h.offset, source: "outline" }); 
                  }}
                  className="outline-row"
                  style={{
                    ...itemStyle,
                    paddingLeft: (h.level - 1) * OUTLINE_INDENT_PX + 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--row-active-bg, #d1d5db)" : "transparent",
                    color: isActive ? "var(--row-active-fg, inherit)" : "inherit",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title={h.text}
                >
                  {canFold ? (
                    <button
                      type="button"
                      aria-label={isFolded ? 'Expand section' : 'Collapse section'}
                      aria-expanded={!isFolded}
                      onClick={(e) => { e.stopPropagation(); toggleFold(h.id); }}
                      style={OUTLINE_STYLES.foldBtn}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: isFolded ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.12s ease' }} aria-hidden="true">
                        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ) : (
                    <span style={{ width: 28 }} />
                  )}
                  <OutlineItem item={h} isActive={isActive} />
                </div>
              );
            }}
          </VirtualList>
        ) : (
          <div role="tree" aria-label="Document outline" className="outline-scroll" style={{ overflow: "auto", height: "100%", contain: "content", overflowAnchor: "none" }}>
            {visible.map((h, i) => {
              const isActive = h.id === displayActiveId;
              const canFold = !!hasChild.get(h.id);
              const isFolded = collapsed.has(h.id);
              const isFocusable = i === focusIdx;
              
              return (
                <div
                  key={`${h.id}@${h.offset}`}
                  id={`toc-${h.id}`}
                  ref={isActive ? activeItemRef : null}
                  role="treeitem"
                  aria-level={h.level}
                  aria-selected={isActive}
                  aria-expanded={canFold ? !isFolded : undefined}
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={isFocusable ? 0 : -1}
                  onKeyDown={(e) => onRowKeyDown(e, i, h, canFold, isFolded)}
                  onFocus={() => setFocusIdx(i)}
                  onClick={() => { 
                    setFocusIdx(i); 
                    bus.emit("nav:jump", { offset: h.offset, source: "outline" }); 
                  }}
                  className="outline-row"
                  style={{
                    height: OUTLINE_ROW_HEIGHT_PX, 
                    lineHeight: `${OUTLINE_ROW_HEIGHT_PX}px`,
                    paddingLeft: (h.level - 1) * OUTLINE_INDENT_PX + 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--row-active-bg, #d1d5db)" : "transparent",
                    color: isActive ? "var(--row-active-fg, inherit)" : "inherit",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title={h.text}
                >
                  {canFold ? (
                    <button
                      type="button"
                      aria-label={isFolded ? 'Expand section' : 'Collapse section'}
                      aria-expanded={!isFolded}
                      onClick={(e) => { e.stopPropagation(); toggleFold(h.id); }}
                      style={OUTLINE_STYLES.foldBtn}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: isFolded ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.12s ease' }} aria-hidden="true">
                        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ) : (
                    <span style={{ width: 28 }} />
                  )}
                  <OutlineItem item={h} isActive={isActive} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
});