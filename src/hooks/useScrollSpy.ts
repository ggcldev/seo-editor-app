// hooks/useScrollSpy.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from './useOutline';
import type { EditorView } from '@codemirror/view';

const DEBUG = false; // ← performance: no more scroll logging

export type RevealMode = 'top' | 'center' | 'third';

export function useScrollSpy(
  _markdown: string,
  outline: Heading[],
  _textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  revealMode: RevealMode = 'third',
  cmView: EditorView | null
) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const activeHeadingIdRef = useRef<string | null>(activeHeadingId);
  useEffect(() => { activeHeadingIdRef.current = activeHeadingId; }, [activeHeadingId]);

  const caretRef = useRef(0);
  const suppressUntil = useRef(0);
  const lastProgRef = useRef(0);
  const lockRef = useRef<{ id: string | null; until: number }>({ id: null, until: 0 });
  const lastComputeRef = useRef(0);
  const activeIdxRef = useRef<number>(-1);
  const rafGate = useRef(false);

  const bias = useMemo(() => revealMode === 'top' ? 0 : revealMode === 'center' ? 0.5 : 0.33, [revealMode]);

  const log = (...args: any[]) => { if (DEBUG) console.log('[spy]', ...args); };

  const computeActiveFromCM = useCallback(() => {
    const view = cmView;
    if (!view || !outline.length) return;
    const now = Date.now();
    if (now < suppressUntil.current) return;           // ignore while preview is autoscrolling
    if (lockRef.current.id && now < lockRef.current.until) return;
    if (now - lastComputeRef.current < 80) return;     // hard rate limit (~12 fps)
    lastComputeRef.current = now;

    // 1) Try visibleRanges first
    const ranges = view.visibleRanges; // [{from,to}, ...]
    if (!ranges.length) {
      log('no visibleRanges');
      return;
    }

    // 2) Pick a bias point inside the visible ranges (top/center/third)
    const total = ranges.reduce((s, r) => s + (r.to - r.from), 0);
    const targetInVisible = Math.max(0, Math.min(0.9999, bias)) * total;
    let acc = 0;
    let anchorPos = ranges[0].from; // fallback
    for (const r of ranges) {
      const len = r.to - r.from;
      if (acc + len >= targetInVisible) {
        anchorPos = r.from + Math.floor(targetInVisible - acc);
        break;
      }
      acc += len;
    }

    // Fallback: if anchorPos looks off (e.g., 0 repeatedly), try posAtCoords
    if (anchorPos === 0) {
      const sc = view.scrollDOM;
      const rect = sc.getBoundingClientRect();
      const y = rect.top + bias * sc.clientHeight + 8;
      const x = rect.left + 8;
      const info = view.posAtCoords({ x, y });
      if (info?.pos != null) {
        log('fallback posAtCoords used', info.pos);
        anchorPos = info.pos;
      }
    }

    // 3) Find last heading with offset <= anchorPos
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= anchorPos) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }

    // ---- HYSTERESIS: don't switch headings at the exact boundary ----
    let idx = ans;
    const prev = activeIdxRef.current;
    if (prev >= 0 && idx >= 0 && idx !== prev) {
      // require we move 20% into the *next* section (max 600 chars) before flipping
      const nextStart = outline[idx].offset;
      const nextEnd = outline[idx + 1]?.offset ?? Number.POSITIVE_INFINITY;
      const hysteresis = Math.min(600, Math.floor((nextEnd - nextStart) * 0.2));

      if (idx > prev && anchorPos < nextStart + hysteresis) {
        idx = prev; // moving down but not far enough yet
      } else if (idx < prev) {
        const currStart = outline[prev].offset;
        const currEnd = outline[prev + 1]?.offset ?? Number.POSITIVE_INFINITY;
        const backHyst = Math.min(600, Math.floor((currEnd - currStart) * 0.2));
        if (anchorPos > currStart + backHyst) idx = prev; // moving up but still in current buffer
      }
    }

    const nextId = idx >= 0 ? outline[idx].id : outline[0]?.id ?? null;
    if (DEBUG) {
      const rngStr = ranges.map(r => `${r.from}-${r.to}`).join(',');
      log('ranges:', rngStr, 'bias:', bias, 'anchorPos:', anchorPos, '→ idx:', idx, 'prev:', prev, 'id:', nextId);
    }
    if (nextId && nextId !== activeHeadingIdRef.current) {
      setActiveHeadingId(nextId);
      activeIdxRef.current = idx;
      lastProgRef.current = now; // smooth hysteresis timing
    }
  }, [cmView, outline, bias]);

  // expose this so the editor can tell us "viewport moved"
  const handleViewportChange = useCallback(() => {
    if (rafGate.current) return;        // only one update per frame
    rafGate.current = true;
    requestAnimationFrame(() => {
      rafGate.current = false;
      computeActiveFromCM();            // your existing anchor/pos → activeId logic
    });
  }, [computeActiveFromCM]);

  const handleCaretChange = useCallback((pos: number) => {
    caretRef.current = pos;
    if (lockRef.current.id && Date.now() < lockRef.current.until) return;
    // binary search (faster + correct)
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const idx = ans;
    const nextId = idx >= 0 ? outline[idx].id : outline[0]?.id ?? null;
    if (nextId && nextId !== activeHeadingIdRef.current) setActiveHeadingId(nextId);
  }, [outline]);

  const suppressScrollSpy = useCallback((ms = 1000) => { suppressUntil.current = Date.now() + ms; }, []);
  const lockActiveTo = useCallback((id: string, ms = 1000) => {
    lockRef.current = { id, until: Date.now() + ms };
    lastProgRef.current = Date.now();
    if (activeHeadingIdRef.current !== id) setActiveHeadingId(id);
  }, []);
  const clearLock = useCallback(() => { lockRef.current = { id: null, until: 0 }; }, []);

  // keep active on outline changes using last caret
  useEffect(() => {
    if (DEBUG) log('outline len', outline.length);
    if (!outline.length) { setActiveHeadingId(null); return; }
    const caret = caretRef.current;
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= caret) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    setActiveHeadingId(ans >= 0 ? outline[ans].id : outline[0]?.id ?? null);
  }, [outline]);

  return {
    activeHeadingId,
    handleViewportChange,   // <— call this on CM scroll/resize
    handleCaretChange,
    suppressScrollSpy,
    lockActiveTo,
    clearLock,
    recomputeHeadingTops: computeActiveFromCM,          // stub for compatibility
    scheduleRecomputeHeadingTops: computeActiveFromCM,  // stub for compatibility
  } as const;
}