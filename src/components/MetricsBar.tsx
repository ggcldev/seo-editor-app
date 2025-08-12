import { useMemo } from 'react';
import { calculateMetrics, type TextMetrics } from '../utils/metrics';

interface MetricsBarProps {
  markdown: string;
}

export function MetricsBar({ markdown }: MetricsBarProps) {
  const metrics: TextMetrics = useMemo(() => calculateMetrics(markdown), [markdown]);

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div 
      className="metrics-bar" 
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#374151',
        color: '#d1d5db',
        padding: '6px 16px',
        zIndex: 1000,
        fontSize: '11px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '24px'
      }}
    >
      <span>Words: {formatNumber(metrics.words)}</span>
      <span>Characters: {formatNumber(metrics.characters)}</span>
      <span>Paragraphs: {formatNumber(metrics.paragraphs)}</span>
    </div>
  );
}