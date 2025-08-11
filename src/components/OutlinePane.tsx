import React, { useEffect, useRef, useCallback } from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';

const OUTLINE_STYLES = {
  aside: { borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto' as const, position: 'relative' as const },
  resizer: { position: 'absolute' as const, top: 0, right: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 },
  container: { padding: 12 },
  title: { fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 },
  list: { display: 'grid', gap: 4 }
} as const;

type OutlinePaneProps = {
  outline: Heading[];
  activeHeadingId: string | null;
  onStartResize: () => void;
  onSelectHeading: (id: string) => void;
};

const Row = React.memo(function Row({
  h, isActive, onClick
}: { h: Heading; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-current={isActive ? "true" : undefined}
      aria-pressed={isActive ? true : undefined}
      style={{ cursor: "pointer" }}
    >
      <OutlineItem item={h} isActive={isActive} />
    </div>
  );
});

export function OutlinePane({ outline, activeHeadingId, onStartResize, onSelectHeading }: OutlinePaneProps) {
  const activeItemRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  // suppress auto-centering while the user is actively scrolling the outline
  const userScrollUntil = useRef(0);
  const markUserScroll = useCallback(() => { userScrollUntil.current = Date.now() + 300; }, []);
  const isUserScrolling = () => Date.now() < userScrollUntil.current;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('wheel', markUserScroll, { passive: true });
    el.addEventListener('touchstart', markUserScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', markUserScroll);
      el.removeEventListener('touchstart', markUserScroll);
    };
  }, [markUserScroll]);

  useEffect(() => {
    if (isUserScrolling()) return; // don't fight the user

    const item = activeItemRef.current;
    const container = scrollRef.current;
    if (!item || !container) return;

    // Prefer offset math inside the scroll container (stable across small screens)
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    const margin = 16; // give a little breathing room
    if (itemTop < viewTop + margin) {
      container.scrollTo({ top: Math.max(0, itemTop - margin), behavior: 'smooth' });
    } else if (itemBottom > viewBottom - margin) {
      container.scrollTo({ top: itemBottom - container.clientHeight + margin, behavior: 'smooth' });
    }
  }, [activeHeadingId]);

  return (
    <aside ref={scrollRef} style={OUTLINE_STYLES.aside}>
      <div
        className="outline-resizer"
        onMouseDown={(e) => { e.preventDefault(); onStartResize(); }}
        style={OUTLINE_STYLES.resizer}
        aria-label="Resize outline"
      />
      <div style={OUTLINE_STYLES.container}>
        <div style={OUTLINE_STYLES.title}>Outline</div>
        <div style={OUTLINE_STYLES.list}>
          {outline.map((h) => {
            const isActive = h.id === activeHeadingId;
            return (
              <div key={h.id} ref={isActive ? activeItemRef : null}>
                <Row h={h} isActive={isActive} onClick={() => onSelectHeading(h.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
