import type { Heading } from '../hooks/useOutline';

type Props = { 
  item: Heading;
  isActive?: boolean;
};

export function OutlineItem({ item, isActive = false }: Props) {
  // Deeper levels indent a bit more tightly after H3
  const indentPx = item.level <= 3 ? (item.level - 1) * 10 : 20 + (item.level - 3) * 8;
  // Make H4–H6 a tad smaller so the hierarchy reads well
  const fontSize = item.level <= 3 ? 13 : 12;
  const accentOpacity = item.level <= 3 ? 1 : 0.7;

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
        fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? '3px solid #6b7280' : '3px solid transparent',
        transition: 'all 0.2s ease',
      }}
      title={item.text}
    >
      <span style={{ color: `rgba(37, 99, 235, ${accentOpacity})`, fontSize: 11, fontWeight: 700 }}>
        H{item.level}
      </span>
      <span style={{ fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.text}</span>
    </div>
  );
}
