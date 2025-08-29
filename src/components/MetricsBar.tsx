import { memo, useState, useEffect, useCallback } from 'react';
import { calculateMetricsThrottled, getLastMetrics, cancelMetricsThrottle, type TextMetrics } from '../metrics';

interface MetricsBarProps {
  markdown: string;
}

// Memoized component to prevent unnecessary re-renders
export const MetricsBar = memo(function MetricsBar({ markdown }: MetricsBarProps) {
  const [metrics, setMetrics] = useState<TextMetrics>(getLastMetrics());

  const updateMetrics = useCallback((newMetrics: TextMetrics) => {
    setMetrics(newMetrics);
  }, []);

  useEffect(() => {
    calculateMetricsThrottled(markdown, updateMetrics, {});
  }, [markdown, updateMetrics]);

  // Ensure any pending throttle is cleared on unmount (route changes, etc.)
  useEffect(() => {
    return () => { cancelMetricsThrottle(); };
  }, []);

  // Optimized number formatting - avoid toLocaleString for small numbers
  const formatNumber = useCallback((num: number) => {
    return num < 1000 ? num.toString() : num.toLocaleString();
  }, []);


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
        gap: '24px',
        contain: 'paint size',
        pointerEvents: 'none'
      }}
    >
      <span>Words: {formatNumber(metrics.words)}</span>
      <span>Characters: {formatNumber(metrics.characters)}</span>
      <span>Paragraphs: {formatNumber(metrics.paragraphs)}</span>
    </div>
  );
});