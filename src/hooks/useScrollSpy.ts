import { useCallback, useEffect, useState } from 'react';
import { Heading } from './useOutline';

export function useScrollSpy(_: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    const scrollPercent = event.currentTarget.scrollTop / (event.currentTarget.scrollHeight - event.currentTarget.clientHeight);
    const index = Math.min(Math.max(Math.floor(scrollPercent * outline.length), 0), outline.length - 1);
    if (outline[index]) setActiveHeadingId(outline[index].id);
  }, [outline]);

  useEffect(() => {
    if (outline.length > 0) setActiveHeadingId(outline[0].id);
  }, [outline]);

  return { activeHeadingId, handleScroll };
}