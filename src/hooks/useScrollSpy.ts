import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from './useOutline';
import { measureOffsetTop, measureHeadingTopsBatch } from '../utils/scrollUtils';

// Debounce helper for performance during rapid typing
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 80) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

export function useScrollSpy(markdown: string, outline: Heading[], textareaRef: React.RefObject<HTMLTextAreaElement | null>, revealMode: 'top' | 'center' | 'third' = 'third') {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const activeHeadingIdRef = useRef<string | null>(null);
  const caretRef = useRef(0);
  const raf = useRef<number | null>(null);
  const scrollRaf = useRef<number | null>(null);
  const suppressUntil = useRef(0);
  const lastProgRef = useRef(0); // NEW: recent programmatic guard
  const headingTopsRef = useRef<number[]>([]);

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

  const recomputeHeadingTops = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !outline.length) { 
      headingTopsRef.current = []; 
      return; 
    }

    let tops = measureHeadingTopsBatch(el, outline);

    // Safety: if measurement looks wrong (non-increasing or zeros), fall back
    const bad =
      tops.length !== outline.length ||
      tops.some((v, i) => (i > 0 && v < tops[i - 1])) ||
      tops.every(v => v === 0);

    if (bad) {
      tops = outline.map(h => measureOffsetTop(el, h.offset));
    }

    headingTopsRef.current = tops;
  }, [outline, textareaRef]);

  // Idle scheduler (requestIdleCallback with fallback)
  type IdleHandle = number;
  const ric = (cb: () => void, timeout = 250): IdleHandle =>
    'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(cb, { timeout })
      : window.setTimeout(cb, timeout);
  const cic = (id: IdleHandle) =>
    'cancelIdleCallback' in window
      ? (window as any).cancelIdleCallback(id)
      : clearTimeout(id as any);

  const idleJob = useRef<IdleHandle | null>(null);

  const scheduleRecomputeHeadingTops = useCallback(() => {
    if (idleJob.current) cic(idleJob.current);
    idleJob.current = ric(() => {
      idleJob.current = null;
      recomputeHeadingTops();
    }, 200);
  }, [recomputeHeadingTops]);

  // helper: same bias rule used by scrollToOffsetExact
  function revealBias(mode: 'top' | 'center' | 'third') {
    return mode === 'top' ? 0 : mode === 'center' ? 0.5 : 0.33; // 'third' default
  }

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const now = Date.now();
    if (now < suppressUntil.current) return;
    if (lockRef.current.id && now < lockRef.current.until) return;
    if (now - lastProgRef.current < 400) return; // short ignore window after programmatic jumps

    const el = e.currentTarget;
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const tops = headingTopsRef.current;
      if (!tops.length) return;

      // 1) Anchor inside the viewport that matches how we scroll TO headings
      const bias = revealBias(revealMode);
      const anchorY = el.scrollTop + bias * el.clientHeight;

      // 2) Hysteresis with midpoints: we switch only after passing the middle
      // Build a midpoints array between successive headings.
      // mid[i] = midpoint between heading i and i+1 (length = tops.length - 1)
      // Find first mid > anchorY; index is that position.
      let lo = 0, hi = tops.length - 2, cut = tops.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const midY = (tops[mid] + tops[mid + 1]) / 2;
        if (anchorY < midY) { cut = mid; hi = mid - 1; } else { lo = mid + 1; }
      }
      const idx = Math.max(0, cut); // active heading index

      const nextId = outline[idx]?.id ?? outline[0]?.id ?? null;
      if (nextId && nextId !== activeHeadingIdRef.current) {
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => setActiveHeadingId(nextId));
      }
    });
  }, [outline, revealMode]);

  // Recompute heading tops when outline or markdown changes
  useEffect(() => {
    recomputeHeadingTops();
  }, [recomputeHeadingTops]);

  // Preserve active on outline changes, based on last caret position
  useEffect(() => {
    if (!outline.length) { 
      setActiveHeadingId(null); 
      return; 
    }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0]?.id ?? null);
  }, [outline, findByCaret]);

  // Recompute on window resize and textarea element resize
  useEffect(() => {
    const handleResize = () => recomputeHeadingTops();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recomputeHeadingTops]);

  // Add ResizeObserver for textarea element size changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recomputeHeadingTops());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recomputeHeadingTops]);

  const suppressScrollSpy = useCallback((ms = 1000) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  // NEW: lock the active id during programmatic jumps
  const lockRef = useRef<{ id: string | null; until: number }>({ id: null, until: 0 });
  const lockActiveTo = useCallback((id: string, ms = 1000) => {
    lockRef.current = { id, until: Date.now() + ms };
    lastProgRef.current = Date.now(); // NEW: Mark recent programmatic action
    if (activeHeadingIdRef.current !== id) setActiveHeadingId(id);
  }, []);
  const clearLock = useCallback(() => { lockRef.current = { id: null, until: 0 }; }, []);

  // Keep ref in sync with state
  useEffect(() => {
    activeHeadingIdRef.current = activeHeadingId;
  }, [activeHeadingId]);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
  }, []);

  // cleanup idle job on unmount
  useEffect(() => () => { if (idleJob.current) cic(idleJob.current); }, []);

  return {
    activeHeadingId,
    handleScroll,
    handleCaretChange,
    suppressScrollSpy,
    lockActiveTo,
    clearLock,
    recomputeHeadingTops,          // keep for immediate calls
    scheduleRecomputeHeadingTops,  // ✅ new idle scheduler
  } as const;
}

