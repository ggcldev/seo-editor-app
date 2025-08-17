import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';
import { useBus } from '../core/BusContext';
import { OutlineIndex } from '../core/outlineCore';
import { VirtualList, VirtualListHandle } from './VirtualList';

const ROW_H = 32; // good tap target
const INDENT_PX = 12; // px per heading level
const VIRTUAL_THRESHOLD = 250; // turn on virtualization only for big docs


const OUTLINE_STYLES = {
  aside: { borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto' as const, position: 'relative' as const },
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
  outline: Heading[];
  activeHeadingId: string | null;
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

const Row = React.memo(function Row({
  h, isActive, canFold, isFolded, onToggle, onClick
}: {
  h: Heading; isActive: boolean; canFold: boolean; isFolded: boolean;
  onToggle: () => void; onClick: () => void;
}) {
  const label = isFolded ? 'Expand section' : 'Collapse section';
  return (
    <div
      onClick={(e) => { e.preventDefault(); onClick(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        if (e.key === 'ArrowLeft' && canFold && !isFolded) { e.preventDefault(); onToggle(); }
        if (e.key === 'ArrowRight' && canFold && isFolded) { e.preventDefault(); onToggle(); }
      }}
      role="treeitem"
      aria-level={h.level}
      aria-expanded={canFold ? !isFolded : undefined}
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      title={h.text}
    >
      {canFold ? (
        <button
          type="button"
          aria-label={label}
          aria-expanded={!isFolded}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={OUTLINE_STYLES.foldBtn}
          title={label}
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
});

export const OutlinePane = React.memo(function OutlinePane({
  outline, activeHeadingId, onStartResize, onBumpWidth
}: OutlinePaneProps) {
  const bus = useBus();
  const scrollRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  // Virtualization
  const listRef = useRef<VirtualListHandle>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  // Create OutlineIndex for O(1) lookups
  const outlineIndex = useMemo(() => new OutlineIndex(outline), [outline]);

  // Which headings have children?
  const hasChild = useMemo(() => {
    const m = new Map<string, boolean>();
    for (let i = 0; i < outline.length; i++) m.set(outline[i].id, hasChildren(outline, i));
    return m;
  }, [outline]);

  const visible = useMemo(() => computeVisible(outline, collapsed), [outline, collapsed]);
  const useVirtual = visible.length >= VIRTUAL_THRESHOLD;
  
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

  // Soft follow for active heading changes
  useEffect(() => {
    const off = bus.on('outline:active', ({ id, source }) => {
      const i = id ? (idToIdx.get(id) ?? 0) : 0;
      setFocusIdx(i);
      // Only call ensureVisible for virtual mode
      if (useVirtual) {
        // Soft follow for scroll; full ensure for keyboard/click
        const bandRows = source === 'scroll' ? 3 : 0; // 0 = nearest behavior
        listRef.current?.ensureVisible(i, { bandRows });
      }
    });
    return off;
  }, [bus, idToIdx, useVirtual]);
  
  // Polite auto-scroll for non-virtual mode
  const userScrollUntil = useRef(0);
  const markUserScroll = useCallback(() => { userScrollUntil.current = Date.now() + 300; }, []);
  const isUserScrolling = () => Date.now() < userScrollUntil.current;

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

  // Listen for bus events (outline:computed, outline:active)
  useEffect(() => {
    const unsubscribeComputed = bus.on('outline:computed', ({ headings }) => {
      // Bus event received, but we're already getting this via props
      // Keep both for now during transition
    });

    const unsubscribeActive = bus.on('outline:active', ({ id }) => {
      // Bus event received, but we're already getting this via props
      // Keep both for now during transition
    });

    return () => {
      unsubscribeComputed();
      unsubscribeActive();
    };
  }, [bus]);

  // Keyboard navigation
  const onRowKeyDown = useCallback((e: React.KeyboardEvent, i: number, h: Heading, canFold: boolean, isFolded: boolean) => {
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
  }, [visible.length, bus, toggleFold, useVirtual]);

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
            rowHeight={ROW_H}
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
                    paddingLeft: (h.level - 1) * INDENT_PX + 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--row-active-bg, #e5e7eb)" : "transparent",
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
                  tabIndex={isFocusable ? 0 : -1}
                  onKeyDown={(e) => onRowKeyDown(e, i, h, canFold, isFolded)}
                  onFocus={() => setFocusIdx(i)}
                  onClick={() => { 
                    setFocusIdx(i); 
                    bus.emit("nav:jump", { offset: h.offset, source: "outline" }); 
                  }}
                  className="outline-row"
                  style={{
                    height: ROW_H, 
                    lineHeight: `${ROW_H}px`,
                    paddingLeft: (h.level - 1) * INDENT_PX + 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--row-active-bg, #e5e7eb)" : "transparent",
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