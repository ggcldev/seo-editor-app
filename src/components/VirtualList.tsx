import React, {
  CSSProperties, ReactNode, forwardRef, useImperativeHandle,
  useLayoutEffect, useMemo, useRef, useState
} from "react";

export type VirtualListHandle = {
  // Ensure index is visible; only move if outside a comfort band (rows)
  ensureVisible: (index: number, opts?: { bandRows?: number }) => void;
};

type Props = {
  count: number;
  rowHeight: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
  children: (index: number, itemStyle: CSSProperties) => ReactNode;
};

export const VirtualList = forwardRef<VirtualListHandle, Props>(function VirtualList(
  { count, rowHeight, overscan = 24, className, style, children }, ref
) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [vh, setVh] = useState(0);
  const raf = useRef<number | null>(null);

  // StrictMode-safe: attach when node is real
  useLayoutEffect(() => {
    if (!node) return;
    const el = node;

    const onScroll = () => {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setScrollTop(el.scrollTop);
      });
    };

    const ro = new ResizeObserver(() => setVh(el.clientHeight));
    ro.observe(el);
    setVh(el.clientHeight); // initial

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [node]);

  const rowsInView = vh ? Math.max(1, Math.ceil(vh / rowHeight)) : 1;
  const start = Math.max(0, Math.min(count, Math.floor(scrollTop / rowHeight) - overscan));
  const end   = Math.max(0, Math.min(count, start + rowsInView + overscan * 2));
  const offY  = start * rowHeight;
  const total = count * rowHeight;

  useImperativeHandle(ref, () => ({
    ensureVisible: (i: number, opts?: { bandRows?: number }) => {
      const el = node; if (!el) return;
      const band = Math.max(0, (opts?.bandRows ?? 2)) * rowHeight;
      const rowTop = i * rowHeight;
      const rowBot = rowTop + rowHeight;
      const vTop   = el.scrollTop + band;
      const vBot   = el.scrollTop + el.clientHeight - band;
      if (rowTop < vTop) {
        el.scrollTop = rowTop - band;     // nudge up just enough
      } else if (rowBot > vBot) {
        el.scrollTop = rowBot - el.clientHeight + band; // nudge down just enough
      }
    }
  }), [node, rowHeight]);

  const slice = useMemo(
    () => Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k),
    [start, end]
  );

  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[VL]', { scrollTop, vh, start, end, total, count });
  }

  return (
    <div
      ref={setNode}
      className={className}
      style={{ overflow: "auto", height: "100%", contain: "content", overflowAnchor: "none", ...style }}
    >
      <div style={{ height: total, position: "relative" }}>
        <div style={{ position: "absolute", inset: "0 0 auto 0", transform: `translateY(${offY}px)`, willChange: "transform" }}>
          {slice.map(i => children(i, { height: rowHeight, lineHeight: `${rowHeight}px` }))}
        </div>
      </div>
    </div>
  );
});