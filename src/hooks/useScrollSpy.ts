// hooks/useScrollSpy.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from './useOutline';
import type { EditorView } from '@codemirror/view';

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

  const bias = useMemo(() => revealMode === 'top' ? 0 : revealMode === 'center' ? 0.5 : 0.33, [revealMode]);

  const computeActiveFromCM = useCallback(() => {
    const view = cmView;
    if (!view || !outline.length) return;
    const now = Date.now();
    if (now < suppressUntil.current) return;
    if (lockRef.current.id && now < lockRef.current.until) return;
    if (now - lastProgRef.current < 120) return;

    const sc = view.scrollDOM;
    const rect = sc.getBoundingClientRect();
    const seamBias = 8;
    const anchorY = rect.top + bias * sc.clientHeight + seamBias;
    const anchorX = rect.left + 8;

    const info = view.posAtCoords({ x: anchorX, y: anchorY });
    const pos = info?.pos ?? 0;

    // binary search over outline offsets
    let lo = 0, hi = outline.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (outline[mid].offset <= pos) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    const nextId = ans >= 0 ? outline[ans].id : outline[0]?.id ?? null;
    if (nextId && nextId !== activeHeadingIdRef.current) setActiveHeadingId(nextId);
  }, [cmView, outline, bias]);

  // expose this so the editor can tell us "viewport moved"
  const handleViewportChange = useCallback(() => {
    computeActiveFromCM();
  }, [computeActiveFromCM]);

  const handleCaretChange = useCallback((pos: number) => {
    caretRef.current = pos;
    if (lockRef.current.id && Date.now() < lockRef.current.until) return;
    const idx = outline.findIndex(h => h.offset <= pos && (h === outline.at(-1) || outline[outline.indexOf(h)+1]?.offset > pos));
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