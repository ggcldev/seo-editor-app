import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';

const OUTLINE_STYLES = {
  aside: { borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto' as const, position: 'relative' as const },
  resizer: { position: 'absolute' as const, top: 0, right: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 },
  container: { padding: 12 },
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
  onSelectHeading: (id: string, expectedOffset?: number) => void;
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
  outline, activeHeadingId, onStartResize, onSelectHeading, onBumpWidth
}: OutlinePaneProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Which headings have children?
  const hasChild = useMemo(() => {
    const m = new Map<string, boolean>();
    for (let i = 0; i < outline.length; i++) m.set(outline[i].id, hasChildren(outline, i));
    return m;
  }, [outline]);

  const visible = useMemo(() => computeVisible(outline, collapsed), [outline, collapsed]);

  const displayActiveId = useMemo(() => {
    if (!activeHeadingId) return null;
    if (isActiveVisible(outline, activeHeadingId, collapsed)) return activeHeadingId;
    return nearestCollapsedAncestorId(outline, activeHeadingId, collapsed) ?? activeHeadingId;
  }, [outline, activeHeadingId, collapsed]);

  // Polite auto-scroll to the active row
  const userScrollUntil = useRef(0);
  const markUserScroll = useCallback(() => { userScrollUntil.current = Date.now() + 300; }, []);
  const isUserScrolling = () => Date.now() < userScrollUntil.current;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const opts = { passive: true } as AddEventListenerOptions;
    el.addEventListener('wheel', markUserScroll, opts);
    el.addEventListener('touchstart', markUserScroll, opts);
    return () => {
      el.removeEventListener('wheel', markUserScroll, opts);
      el.removeEventListener('touchstart', markUserScroll, opts);
    };
  }, [markUserScroll]);

  useEffect(() => {
    if (isUserScrolling()) return;
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
  }, [displayActiveId, visible]);

  const toggleFold = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <aside
      ref={scrollRef as any}
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

        <div style={OUTLINE_STYLES.list}>
          {visible.map((h) => {
            const isActive = h.id === displayActiveId;
            const canFold = !!hasChild.get(h.id);
            const isFolded = collapsed.has(h.id);
            return (
              <div key={`${h.id}@${h.offset}`} ref={isActive ? activeItemRef : null}>
                <Row
                  h={h}
                  isActive={isActive}
                  canFold={canFold}
                  isFolded={isFolded}
                  onToggle={() => toggleFold(h.id)}
                  // Pass both id and offset so App resolves precisely AND uses the fresh outline
                  onClick={() => onSelectHeading(h.id, h.offset)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
});