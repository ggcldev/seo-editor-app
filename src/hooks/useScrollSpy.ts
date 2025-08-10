import { useCallback, useEffect, useRef, useState } from 'react';
import type { Heading } from './useOutline';

export function useScrollSpy(_markdown: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const caretRef = useRef(0);
  const raf = useRef<number | null>(null);
  const suppressUntil = useRef(0); // NEW: suppress scroll handling during programmatic scrolls

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
    if (idx >= 0 && outline[idx].id !== activeHeadingId) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setActiveHeadingId(outline[idx].id));
    }
  }, [findByCaret, outline, activeHeadingId]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (Date.now() < suppressUntil.current) return; // NEW: ignore programmatic scrolls briefly
    
    // Use the caret position instead of scroll percentage for accuracy
    const pos = e.currentTarget.selectionStart ?? caretRef.current;
    const idx = findByCaret(pos);
    if (idx >= 0 && outline[idx].id !== activeHeadingId) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setActiveHeadingId(outline[idx].id));
    }
  }, [findByCaret, outline, activeHeadingId]);

  // Preserve active on outline changes, based on last caret position
  useEffect(() => {
    if (!outline.length) { 
      setActiveHeadingId(null); 
      return; 
    }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0]?.id ?? null);
  }, [outline, findByCaret]);

  // NEW: expose helper to suppress scroll handling during programmatic navigation
  const suppressScrollSpy = useCallback((ms = 250) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return { activeHeadingId, handleScroll, handleCaretChange, suppressScrollSpy };
}

