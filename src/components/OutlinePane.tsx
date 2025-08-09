import { useEffect, useRef } from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';

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
    <aside style={{ borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto', position: 'relative' }}>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          onStartResize();
        }}
        style={{ position: 'absolute', top: 0, right: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 }}
        aria-label="Resize outline"
      />
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>Outline</div>
        <div style={{ display: 'grid', gap: 4 }}>
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
