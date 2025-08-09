import React from 'react';
import type { Heading } from '../hooks/useOutline';
import { OutlineItem } from './OutlineItem';

type Props = {
  outline: Heading[];
  onStartResize: () => void;
};

export function OutlinePane({ outline, onStartResize }: Props) {
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
            <OutlineItem key={`${h.id}-${i}`} item={h} />
          ))}
        </div>
      </div>
    </aside>
  );
}


