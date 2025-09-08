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
    <div className="metrics-bar">
      <span>Words: {formatNumber(metrics.words)}</span>
      <span>Characters: {formatNumber(metrics.characters)}</span>
      <span>Paragraphs: {formatNumber(metrics.paragraphs)}</span>
    </div>
  );
});