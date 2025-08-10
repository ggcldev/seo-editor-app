import { useEffect, useRef } from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';

const OUTLINE_STYLES = {
  aside: { borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto' as const, position: 'relative' as const },
  resizer: { position: 'absolute' as const, top: 0, right: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 },
  container: { padding: 12 },
  title: { fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 },
  list: { display: 'grid', gap: 4 }
} as const;

type Props = {
  outline: Heading[];
  activeHeadingId: string | null;
  onStartResize: () => void;
};

export function OutlinePane({ outline, activeHeadingId, onStartResize }: Props) {
  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeHeadingId]);
  return (
    <aside style={OUTLINE_STYLES.aside}>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          onStartResize();
        }}
        style={OUTLINE_STYLES.resizer}
        aria-label="Resize outline"
      />
      <div style={OUTLINE_STYLES.container}>
        <div style={OUTLINE_STYLES.title}>Outline</div>
        <div style={OUTLINE_STYLES.list}>
          {outline.map((h, i) => (
            <div 
              key={`${h.id}-${i}`}
              ref={h.id === activeHeadingId ? activeItemRef : null}
            >
              <OutlineItem 
                item={h} 
                isActive={h.id === activeHeadingId}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
