import { useCallback, useEffect, useRef, useState } from 'react';
import type { Heading } from './useOutline';

export function useScrollSpy(markdown: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const activeHeadingIdRef = useRef<string | null>(null);
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
    // Respect lock: don't override the locked id
    if (lockRef.current.id && Date.now() < lockRef.current.until) return;

    const idx = findByCaret(pos);
    const nextId = idx >= 0 ? outline[idx].id : null;
    if (nextId && nextId !== activeHeadingIdRef.current) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setActiveHeadingId(nextId));
    }
  }, [findByCaret, outline]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!outline.length) return;

    // Respect suppression or lock during programmatic animations
    const now = Date.now();
    if (now < suppressUntil.current) return;
    if (lockRef.current.id && now < lockRef.current.until) return;

    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const ratio = el.scrollTop / max;
    const approxPos = Math.floor(ratio * Math.max(0, markdown.length - 1));

    const idx = findByCaret(approxPos);
    const nextId = idx >= 0 ? outline[idx].id : null;
    if (nextId && nextId !== activeHeadingIdRef.current) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setActiveHeadingId(nextId));
    }
  }, [findByCaret, markdown.length, outline]);

  // Preserve active on outline changes, based on last caret position
  useEffect(() => {
    if (!outline.length) { 
      setActiveHeadingId(null); 
      return; 
    }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0]?.id ?? null);
  }, [outline, findByCaret]);

  const suppressScrollSpy = useCallback((ms = 600) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  // NEW: lock the active id during programmatic jumps
  const lockRef = useRef<{ id: string | null; until: number }>({ id: null, until: 0 });
  const lockActiveTo = useCallback((id: string, ms = 700) => {
    lockRef.current = { id, until: Date.now() + ms };
    if (activeHeadingIdRef.current !== id) setActiveHeadingId(id);
  }, []);
  const clearLock = useCallback(() => { lockRef.current = { id: null, until: 0 }; }, []);

  // Keep ref in sync with state
  useEffect(() => {
    activeHeadingIdRef.current = activeHeadingId;
  }, [activeHeadingId]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return {
    activeHeadingId,
    handleScroll,
    handleCaretChange,
    suppressScrollSpy,
    lockActiveTo,     // NEW
    clearLock,        // NEW
  };
}

