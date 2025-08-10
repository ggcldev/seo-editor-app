import { useCallback, useEffect, useRef, useState } from 'react';
import type { Heading } from './useOutline';

export function useScrollSpy(markdown: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const caretRef = useRef(0); // last known caret position
  const raf = useRef<number | null>(null);

  // Build a map of heading line numbers once per markdown change
  const headingLines = useRef<number[]>([]);
  useEffect(() => {
    const lines = markdown.split(/\r?\n/);
    const out: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const atx = line.match(/^(#{1,3})\s+(.+)$/);
      const next = lines[i + 1] || '';
      const isSetext1 = /^=+\s*$/.test(next);
      const isSetext2 = /^-+\s*$/.test(next);

      if (atx || isSetext1 || isSetext2) out.push(i);
    }
    headingLines.current = out;
    setActiveHeadingId(outline[0]?.id ?? null);
  }, [markdown, outline]);

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

  const handleScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    if (!outline.length) return;
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const denom = Math.max(1, max); // avoid division by zero
    const percent = el.scrollTop / denom;

    // Map scroll to an approximate line number
    const totalLines = Math.max(1, markdown.split(/\r?\n/).length);
    const approxLine = Math.floor(percent * (totalLines - 1));

    // Find the nearest heading at or before approxLine
    const idx = binarySearchFloor(headingLines.current, approxLine);
    if (idx >= 0 && outline[idx]) {
      // requestAnimationFrame to prevent setState storms
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        setActiveHeadingId(outline[idx].id);
      });
    }
  }, [outline, markdown]);

  // Preserve active on outline changes, based on last caret position
  useEffect(() => {
    if (!outline.length) { 
      setActiveHeadingId(null); 
      return; 
    }
    const idx = findByCaret(caretRef.current);
    setActiveHeadingId(outline[Math.max(0, idx)]?.id ?? outline[0].id);
  }, [outline, findByCaret]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return { activeHeadingId, handleScroll, handleCaretChange };
}

function binarySearchFloor(arr: number[], target: number) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) { 
      ans = mid; 
      lo = mid + 1; 
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}