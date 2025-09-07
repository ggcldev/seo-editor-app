import React from 'react';
import type { Heading } from '@/core/outlineParser';

type OutlineItemProps = { 
  item: Heading;
  isActive?: boolean;
};

function OutlineItemBase({ item, isActive = false }: OutlineItemProps) {
  const indentPx = item.level <= 3 ? (item.level - 1) * 10 : 20 + (item.level - 3) * 8;
  const fontSize = item.level <= 3 ? 13 : 12;
  const accentOpacity = item.level <= 3 ? 1 : 0.7;

  return (
    <div
      style={{
        padding: '4px 6px',
        borderRadius: 8,
        marginLeft: indentPx,
        color: isActive ? '#374151' : '#374151',
        fontSize,
        background: 'transparent',
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        minWidth: 0,
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.2s ease',
      }}
      title={item.text}
    >
      <span style={{ color: `rgba(37, 99, 235, ${accentOpacity})`, fontSize: 11, fontWeight: 700 }}>
        H{item.level}
      </span>
      <span 
        style={{ 
          fontWeight: 500, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flex: '1 1 auto',
          minWidth: 0
        }}
      >
        {item.text}
      </span>
    </div>
  );
}

export const OutlineItem = React.memo(OutlineItemBase, (prev, next) => {
  return prev.isActive === next.isActive && prev.item.id === next.item.id && prev.item.text === next.item.text && prev.item.level === next.item.level;
});