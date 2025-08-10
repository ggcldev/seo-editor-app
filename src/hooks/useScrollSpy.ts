import { useCallback, useEffect, useRef, useState } from 'react';
import type { Heading } from './useOutline';

export function useScrollSpy(markdown: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const caretRef = useRef(0); // last known caret position

  const findByCaret = useCallback((pos: number) => {
    if (!outline.length) return -1;
    // Binary search: find the last heading with offset <= pos
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= pos) { 
        ans = mid; 
        lo = mid + 1; 
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }, [outline]);

  const handleCaretChange = useCallback((pos: number) => {
    caretRef.current = pos;
    const idx = findByCaret(pos);
    if (idx >= 0) setActiveHeadingId(outline[idx].id);
  }, [findByCaret, outline]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    // Fallback: when user scrolls manually, estimate active by scroll %
    if (!outline.length) return;
    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const percent = el.scrollTop / max;
    const approxPos = Math.floor(percent * Math.max(0, markdown.length - 1));
    const idx = findByCaret(approxPos);
    if (idx >= 0) setActiveHeadingId(outline[idx].id);
  }, [outline, markdown.length, findByCaret]);

  // Preserve active on outline changes, based on last caret position
  useEffect(() => {
    if (!outline.length) { 
      setActiveHeadingId(null); 
      return; 
    }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0].id);
  }, [outline, findByCaret]);

  return { activeHeadingId, handleScroll, handleCaretChange };
}