import { useCallback, useEffect, useState } from 'react';
import { Heading } from './useOutline';

export function useScrollSpy(_: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    const scrollPercent = event.currentTarget.scrollTop / (event.currentTarget.scrollHeight - event.currentTarget.clientHeight);
    const index = Math.floor(scrollPercent * outline.length);
    const clampedIndex = Math.min(Math.max(index, 0), outline.length - 1);
    
    if (outline[clampedIndex]) {
      setActiveHeadingId(outline[clampedIndex].id);
    }
  }, [outline]);

  useEffect(() => {
    if (outline.length > 0) {
      setActiveHeadingId(outline[0].id);
    }
  }, [outline]);

  return { activeHeadingId, handleScroll };
}