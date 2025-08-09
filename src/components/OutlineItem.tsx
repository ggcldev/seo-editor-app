import type { Heading } from '../hooks/useOutline';

type Props = { 
  item: Heading;
  isActive?: boolean;
};

export function OutlineItem({ item, isActive = false }: Props) {
  return (
    <div
      style={{
        padding: '4px 6px',
        borderRadius: 8,
        marginLeft: (item.level - 1) * 10,
        color: isActive ? '#ffffff' : '#374151',
        fontSize: 13,
        background: isActive ? '#374151' : 'transparent',
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? '3px solid #6b7280' : '3px solid transparent',
        transition: 'all 0.2s ease',
      }}
      title={`H${item.level}`}
    >
      <span style={{ color: '#2563eb', fontSize: 11, fontWeight: 700 }}>H{item.level}</span>
      <span style={{ fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.text}</span>
    </div>
  );
}
