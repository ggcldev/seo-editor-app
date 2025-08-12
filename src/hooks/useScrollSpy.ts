// hooks/useScrollSpy.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from './useOutline';
import { measureHeadingTopsBatch } from '../utils/scrollUtils';
import { measureHeadingTopsBatchCM } from '../utils/cmMeasure';
import type { EditorView } from '@codemirror/view';
import { idleCallback } from '../utils/idleCallback';

export type RevealMode = 'top' | 'center' | 'third';

export function useScrollSpy(
  _markdown: string,
  outline: Heading[],
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  revealMode: RevealMode = 'third',
  cmViewRef?: React.RefObject<EditorView | null>
) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const activeHeadingIdRef = useRef<string | null>(activeHeadingId);
  useEffect(() => { activeHeadingIdRef.current = activeHeadingId; }, [activeHeadingId]);

  const caretRef = useRef(0);
  const headingTopsRef = useRef<Float32Array | null>(null);
  const suppressUntil = useRef(0);
  const lastProgRef = useRef(0);
  const lockRef = useRef<{ id: string | null; until: number }>({ id: null, until: 0 });

  // rAF state
  const rafId = useRef<number | null>(null);
  const lastScrollTop = useRef<number>(-1);

  // bias
  const bias = useMemo(() => revealMode === 'top' ? 0 : revealMode === 'center' ? 0.5 : 0.33, [revealMode]);

  // recompute heading tops
  const recomputeHeadingTops = useCallback(() => {
    const view = cmViewRef?.current;
    if (view && outline.length) {
      const arr = measureHeadingTopsBatchCM(view, outline);
      const buf = new Float32Array(arr.length); for (let i=0;i<arr.length;i++) buf[i]=arr[i];
      headingTopsRef.current = buf; return;
    }
    const el = textareaRef.current;
    if (!el || !outline.length) { headingTopsRef.current = null; return; }
    const arr = measureHeadingTopsBatch(el, outline);
    const buf = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
    headingTopsRef.current = buf;
  }, [outline, textareaRef, cmViewRef]);

  // schedule recompute (idle-ish)
  const scheduleRecomputeHeadingTops = useCallback(() => {
    const run = () => recomputeHeadingTops();
    idleCallback(run, 200);
  }, [recomputeHeadingTops]);

  // caret → active via binary search on outline offsets (fast)
  const findByCaret = useCallback((pos: number) => {
    if (!outline.length) return -1;
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= pos) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }, [outline]);

  const handleCaretChange = useCallback((pos: number) => {
    caretRef.current = pos;
    if (lockRef.current.id && Date.now() < lockRef.current.until) return;
    const idx = findByCaret(pos);
    const nextId = idx >= 0 ? outline[idx].id : null;
    if (nextId && nextId !== activeHeadingIdRef.current) {
      setActiveHeadingId(nextId);
    }
  }, [findByCaret, outline]);

  const suppressScrollSpy = useCallback((ms = 1000) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  const lockActiveTo = useCallback((id: string, ms = 1000) => {
    lockRef.current = { id, until: Date.now() + ms };
    lastProgRef.current = Date.now();
    if (activeHeadingIdRef.current !== id) setActiveHeadingId(id);
  }, []);
  const clearLock = useCallback(() => { lockRef.current = { id: null, until: 0 }; }, []);

  // rAF loop for scroll spy
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const scrollEl = cmViewRef?.current?.scrollDOM ?? textareaRef.current;
      if (scrollEl && outline.length && headingTopsRef.current && now >= suppressUntil.current) {
        if (!(lockRef.current.id && now < lockRef.current.until) && now - lastProgRef.current >= 900) {
          const st = scrollEl.scrollTop;
          if (st !== lastScrollTop.current) {
            lastScrollTop.current = st;

            const tops = headingTopsRef.current!;
            // anchor Y = bias position
            const anchorY = st + bias * scrollEl.clientHeight;

            // hysteresis via midpoints
            let lo = 0, hi = tops.length - 2, cut = tops.length - 1;
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              const midY = (tops[mid] + tops[mid + 1]) * 0.5;
              if (anchorY < midY) { cut = mid; hi = mid - 1; } else lo = mid + 1;
            }
            const idx = Math.max(0, cut);
            const nextId = outline[idx]?.id ?? outline[0]?.id ?? null;
            if (nextId && nextId !== activeHeadingIdRef.current) {
              setActiveHeadingId(nextId);
            }
          }
        }
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [bias, outline, textareaRef, cmViewRef]);

  // recompute when outline/markdown changes
  useEffect(() => { recomputeHeadingTops(); }, [recomputeHeadingTops]);

  // keep active on outline changes (caret-based)
  useEffect(() => {
    if (!outline.length) { setActiveHeadingId(null); return; }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0]?.id ?? null);
  }, [outline, findByCaret]);

  // resize observers
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => scheduleRecomputeHeadingTops());
    ro.observe(el);
    const onWin = () => scheduleRecomputeHeadingTops();
    window.addEventListener('resize', onWin);
    return () => { ro.disconnect(); window.removeEventListener('resize', onWin); };
  }, [scheduleRecomputeHeadingTops, textareaRef]);

  // legacy: keep a noop handleScroll for Editor prop compatibility (and for show/hide custom bar in Editor)
  const handleScroll = useCallback(() => {
    // spy work is in rAF now; nothing needed here
  }, []);

  return {
    activeHeadingId,
    handleScroll,                 // keep signature the same
    handleCaretChange,
    suppressScrollSpy,
    lockActiveTo,
    clearLock,
    recomputeHeadingTops,
    scheduleRecomputeHeadingTops,
  } as const;
}