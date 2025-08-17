import React, {
  CSSProperties, ReactNode, forwardRef, useEffect, useImperativeHandle,
  useMemo, useRef, useState
} from "react";

export type VirtualListHandle = { ensureVisible: (index: number) => void };

type Props = {
  count: number;
  rowHeight: number;           // fixed row height (px)
  overscan?: number;           // extra rows above/below
  className?: string;
  style?: CSSProperties;
  children: (index: number, itemStyle: CSSProperties) => ReactNode; // render global index
};

export const VirtualList = forwardRef<VirtualListHandle, Props>(function VirtualList(
  { count, rowHeight, overscan = 24, className, style, children }, ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [vh, setVh] = useState(0);
  const raf = useRef<number | null>(null);

  // rAF-throttled scroll listener + resize observer
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const onScroll = () => {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => { 
        raf.current = null; 
        setScrollTop(el.scrollTop); 
      });
    };
    
    const measure = () => setVh(el.clientHeight);
    measure(); // initial
    
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    
    return () => { 
      el.removeEventListener("scroll", onScroll); 
      ro.disconnect(); 
      if (raf.current) cancelAnimationFrame(raf.current); 
    };
  }, []);

  // window math
  const rowsInView = vh ? Math.ceil(vh / rowHeight) : 0;
  const start = Math.max(0, Math.min(count, Math.floor(scrollTop / rowHeight) - overscan));
  const end   = Math.max(0, Math.min(count, start + rowsInView + overscan * 2));
  const offY  = start * rowHeight;
  const total = count * rowHeight;

  // public: ensure a row is visible (geometry-based to avoid drift)
  useImperativeHandle(ref, () => ({
    ensureVisible: (i: number) => {
      const el = scrollRef.current;
      if (!el) return;
      
      const top = i * rowHeight, bottom = top + rowHeight;
      const vTop = el.scrollTop, vBot = vTop + el.clientHeight;
      if (top < vTop) {
        el.scrollTop = Math.max(0, top - overscan * rowHeight);
      } else if (bottom > vBot) {
        el.scrollTop = bottom - el.clientHeight + overscan * rowHeight;
      }
    }
  }), [rowHeight, overscan]);

  const slice = useMemo(() => Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k), [start, end]);

  return (
    <div ref={scrollRef} className={className} style={{ overflow: "auto", contain: "content", overflowAnchor: "none", ...style }}>
      <div style={{ height: total, position: "relative" }}>
        <div style={{ position: "absolute", inset: "0 0 auto 0", transform: `translateY(${offY}px)` }}>
          {slice.map(i => children(i, { height: rowHeight, lineHeight: `${rowHeight}px` }))}
        </div>
      </div>
    </div>
  );
});