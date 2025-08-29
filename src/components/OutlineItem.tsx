import React, { useRef, useState, useLayoutEffect } from 'react';
import type { Heading } from '../hooks/useOutline';

type OutlineItemProps = { 
  item: Heading;
  isActive?: boolean;
};

function OutlineItemBase({ item, isActive = false }: OutlineItemProps) {
  // Deeper levels indent a bit more tightly after H3
  const indentPx = item.level <= 3 ? (item.level - 1) * 10 : 20 + (item.level - 3) * 8;
  // Make H4–H6 a tad smaller so the hierarchy reads well
  const fontSize = item.level <= 3 ? 13 : 12;
  const accentOpacity = item.level <= 3 ? 1 : 0.7;

  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => {
      const truncated = el.scrollWidth > el.clientWidth;
      console.log(`${item.text}: scrollWidth=${el.scrollWidth}, clientWidth=${el.clientWidth}, truncated=${truncated}`);
      setIsTruncated(truncated);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item.text]);

  return (
    <div
      style={{
        padding: '4px 6px',
        borderRadius: 8,
        marginLeft: indentPx,
        color: isActive ? '#ffffff' : '#374151',
        fontSize,
        background: isActive ? '#374151' : 'transparent',
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        minWidth: 0, // Allow container to shrink below content width
        fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? '3px solid #6b7280' : '3px solid transparent',
        transition: 'all 0.2s ease',
      }}
      title={item.text}
    >
      <span style={{ color: `rgba(37, 99, 235, ${accentOpacity})`, fontSize: 11, fontWeight: 700 }}>
        H{item.level}
      </span>
      <span 
        ref={textRef}
        style={{ 
          fontWeight: 500, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flex: '1 1 auto',
          minWidth: 0,
          // Apply fade only when truncated
          ...(isTruncated && {
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)',
            maskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)',
          })
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
