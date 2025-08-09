import React from 'react';
import type { Heading } from '../hooks/useOutline';

type Props = { item: Heading };

export function OutlineItem({ item }: Props) {
  return (
    <div
      style={{
        padding: '4px 6px',
        borderRadius: 8,
        marginLeft: (item.level - 1) * 10,
        color: '#374151',
        fontSize: 13,
        background: 'transparent',
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
      }}
      title={`H${item.level}`}
    >
      <span style={{ color: '#2563eb', fontSize: 11, fontWeight: 700 }}>H{item.level}</span>
      <span style={{ fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.text}</span>
    </div>
  );
}


